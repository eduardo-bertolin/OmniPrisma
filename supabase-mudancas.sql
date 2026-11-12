-- =============================================================================
-- MUDANÇAS NO BANCO EXISTENTE (Supabase > SQL Editor > New query > Run)
-- Rode cada comando separadamente, na ordem.
-- Todos são idempotentes: pode rodar de novo sem quebrar nada.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- COMANDO 1 — Backup dos dados e passagem do CNPJ/Telefone para as observações
-- -----------------------------------------------------------------------------
create table if not exists companies_backup_2026 as
  select id, name, to_jsonb(c) - 'id' - 'name' as dados, created_at
  from companies c;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'companies' and column_name = 'document'
  ) and exists (
    select 1 from information_schema.columns
    where table_name = 'companies' and column_name = 'phone'
  ) then
    update companies
    set notes = trim(
      coalesce(notes, '') ||
      case when coalesce(notes, '') = '' then '' else E'\n' end ||
      'CNPJ: ' || coalesce(document, '') ||
      case when coalesce(phone, '') = '' then '' else E'\nTelefone: ' || phone end
    )
    where document is not null or phone is not null;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- COMANDO 2 — Empresas: remove as colunas CNPJ e Telefone, cria "acesso via"
-- -----------------------------------------------------------------------------
alter table companies add column if not exists access_method text;

alter table companies drop column if exists document;
alter table companies drop column if exists phone;


-- -----------------------------------------------------------------------------
-- COMANDO 3 — Contatos: cria a coluna "setor"
-- -----------------------------------------------------------------------------
alter table contacts add column if not exists sector text;


-- -----------------------------------------------------------------------------
-- COMANDO 4 — Cofre por usuário (abre com o login, sem senha mestra)
-- -----------------------------------------------------------------------------
alter table companies add column if not exists anydesk_password text;
alter table companies add column if not exists vpn_password text;

create table if not exists user_vault_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  salt text not null,
  created_at timestamptz not null default now()
);

alter table user_vault_keys enable row level security;

drop policy if exists "usuarios leem o proprio cofre" on user_vault_keys;
drop policy if exists "usuarios criam o proprio cofre" on user_vault_keys;
drop policy if exists "usuarios atualizam o proprio cofre" on user_vault_keys;

create policy "usuarios leem o proprio cofre"
  on user_vault_keys for select to authenticated
  using (auth.uid() = user_id);

create policy "usuarios criam o proprio cofre"
  on user_vault_keys for insert to authenticated
  with check (auth.uid() = user_id);

create policy "usuarios atualizam o proprio cofre"
  on user_vault_keys for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =============================================================================
-- OPCIONAL — remover a tabela antiga da senha mestra (depois de migrar as
-- senhas com o script scripts/migrate-cofre.mjs):
--
--   drop table if exists vault_config;
-- =============================================================================
