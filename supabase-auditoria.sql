-- =============================================================================
-- AUDITORIA, EXCLUSÃO LÓGICA (LIXEIRA) E PAPEL DE ADMIN
-- Rode cada comando separadamente, na ordem. Todos são idempotentes.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- COMANDO 1 — Colunas de exclusão lógica nas tabelas
-- -----------------------------------------------------------------------------
alter table companies add column if not exists deleted_at timestamptz;
alter table companies add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table contacts add column if not exists deleted_at timestamptz;
alter table contacts add column if not exists deleted_by uuid references auth.users(id) on delete set null;


-- -----------------------------------------------------------------------------
-- COMANDO 2 — Perfis dos usuários (quem é admin)
-- -----------------------------------------------------------------------------
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Todo usuário novo ganha um perfil. O primeiro usuário do banco já entra como admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, is_admin)
  values (new.id, new.email, not exists (select 1 from public.profiles))
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- COMANDO 3 — Função que verifica se o usuário atual é admin
-- -----------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = auth.uid()),
    false
  );
$$;


-- -----------------------------------------------------------------------------
-- COMANDO 4 — Tabela de auditoria
-- -----------------------------------------------------------------------------
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  action text not null,            -- insert | update | delete | restore | purge
  entity text not null,            -- companies | contacts
  entity_id uuid,
  entity_name text,
  company_id uuid,
  company_name text,
  details jsonb
);

create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists audit_log_entity_idx on audit_log(entity, entity_id);

alter table audit_log enable row level security;

drop policy if exists "usuarios logados leem auditoria" on audit_log;
create policy "usuarios logados leem auditoria"
  on audit_log for select to authenticated using (true);


-- -----------------------------------------------------------------------------
-- COMANDO 5 — Triggers de auditoria (registram tudo que muda no banco)
-- -----------------------------------------------------------------------------
create or replace function public.audit_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_action text;
  v_entity text := tg_table_name;
  v_row jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_details jsonb;
  v_name text;
  v_company_id uuid;
  v_company_name text;
begin
  select u.email into v_email from auth.users u where u.id = v_user;

  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_row := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_row := to_jsonb(new);
    if new.deleted_at is not null and old.deleted_at is null then
      v_action := 'delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      v_action := 'restore';
    else
      v_action := 'update';
    end if;

    select coalesce(
      jsonb_object_agg(o.key, jsonb_build_object('antes', o.value, 'depois', n.value)),
      '{}'::jsonb
    )
    into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
    where o.value is distinct from n.value
      and o.key not in ('updated_at', 'deleted_by');
  else
    v_action := 'purge';
    v_row := to_jsonb(old);
  end if;

  -- Senhas nunca entram na auditoria: só marcamos que mudaram.
  if v_changes ? 'anydesk_password' then
    v_changes := (v_changes - 'anydesk_password')
      || jsonb_build_object('anydesk_password', '{"alterado": true}'::jsonb);
  end if;
  if v_changes ? 'vpn_password' then
    v_changes := (v_changes - 'vpn_password')
      || jsonb_build_object('vpn_password', '{"alterado": true}'::jsonb);
  end if;

  if v_row ? 'anydesk_password' then
    if v_row->>'anydesk_password' is not null then
      v_row := v_row || jsonb_build_object('anydesk_password', '(criptografado)');
    else
      v_row := v_row - 'anydesk_password';
    end if;
  end if;
  if v_row ? 'vpn_password' then
    if v_row->>'vpn_password' is not null then
      v_row := v_row || jsonb_build_object('vpn_password', '(criptografado)');
    else
      v_row := v_row - 'vpn_password';
    end if;
  end if;

  v_name := v_row->>'name';
  v_company_id := nullif(v_row->>'company_id', '')::uuid;

  if v_entity = 'contacts' and v_company_id is not null then
    select c.name into v_company_name from companies c where c.id = v_company_id;
  end if;

  v_details := case
    when v_action = 'update' then v_changes
    else v_row - 'id' - 'created_at' - 'deleted_at' - 'deleted_by'
  end;

  insert into audit_log (
    user_id, user_email, action, entity, entity_id,
    entity_name, company_id, company_name, details
  ) values (
    v_user, v_email, v_action, v_entity, (v_row->>'id')::uuid,
    v_name, v_company_id, v_company_name, v_details
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_companies on companies;
create trigger trg_audit_companies
  after insert or update or delete on companies
  for each row execute function public.audit_changes();

drop trigger if exists trg_audit_contacts on contacts;
create trigger trg_audit_contacts
  after insert or update or delete on contacts
  for each row execute function public.audit_changes();


-- -----------------------------------------------------------------------------
-- COMANDO 6 — Trigger que preenche quem fez a exclusão lógica
-- -----------------------------------------------------------------------------
create or replace function public.set_deleted_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is null then
    new.deleted_by := null;
  elsif old.deleted_at is null or old.deleted_at is distinct from new.deleted_at then
    new.deleted_by := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_set_deleted_by_companies on companies;
create trigger trg_set_deleted_by_companies
  before update on companies
  for each row execute function public.set_deleted_by();

drop trigger if exists trg_set_deleted_by_contacts on contacts;
create trigger trg_set_deleted_by_contacts
  before update on contacts
  for each row execute function public.set_deleted_by();


-- -----------------------------------------------------------------------------
-- COMANDO 7 — Regras de acesso: só admin exclui de vez
-- -----------------------------------------------------------------------------
drop policy if exists "usuarios logados gerenciam empresas" on companies;
drop policy if exists "usuarios logados gerenciam contatos" on contacts;

create policy "usuarios logados leem empresas"
  on companies for select to authenticated using (true);
create policy "usuarios logados criam empresas"
  on companies for insert to authenticated with check (true);
create policy "usuarios logados editam empresas"
  on companies for update to authenticated using (true) with check (true);
create policy "admins excluem empresas"
  on companies for delete to authenticated using (public.is_admin());

create policy "usuarios logados leem contatos"
  on contacts for select to authenticated using (true);
create policy "usuarios logados criam contatos"
  on contacts for insert to authenticated with check (true);
create policy "usuarios logados editam contatos"
  on contacts for update to authenticated using (true) with check (true);
create policy "admins excluem contatos"
  on contacts for delete to authenticated using (public.is_admin());

drop policy if exists "usuarios leem perfis" on profiles;
drop policy if exists "usuarios criam perfis" on profiles;
drop policy if exists "admins editam perfis" on profiles;
drop policy if exists "admins excluem perfis" on profiles;

create policy "usuarios leem perfis"
  on profiles for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
create policy "usuarios criam perfis"
  on profiles for insert to authenticated with check (user_id = auth.uid());
create policy "admins editam perfis"
  on profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins excluem perfis"
  on profiles for delete to authenticated using (public.is_admin());


-- -----------------------------------------------------------------------------
-- COMANDO 8 — Cria os perfis dos usuários que já existiam e define o admin
-- Troque o e-mail abaixo pelo seu.
-- -----------------------------------------------------------------------------
insert into profiles (user_id, email)
select id, email from auth.users
on conflict (user_id) do update set email = excluded.email;

update profiles set is_admin = true where email = 'SEU-EMAIL-AQUI@empresa.com';
