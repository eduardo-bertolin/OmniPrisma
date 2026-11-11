-- Rode no Supabase: SQL Editor > New query > Run
-- Adiciona campos de senha (guardados criptografados) e a tabela do cofre.

alter table companies add column if not exists anydesk_password text;
alter table companies add column if not exists vpn_password text;

-- Guarda apenas o "sal" e um texto de verificação criptografado.
-- A senha mestra NUNCA vai para o banco.
create table if not exists vault_config (
  id int primary key default 1 check (id = 1),
  salt text not null,
  check_value text not null,
  created_at timestamptz not null default now()
);

alter table vault_config enable row level security;

drop policy if exists "logados leem cofre" on vault_config;
drop policy if exists "logados criam cofre" on vault_config;

create policy "logados leem cofre"
  on vault_config for select to authenticated using (true);

-- Sem policy de update/delete: depois de criada, a configuração não pode ser alterada pelo app.
create policy "logados criam cofre"
  on vault_config for insert to authenticated with check (true);
