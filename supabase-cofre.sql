-- Rode no Supabase: SQL Editor > New query > Run
-- Adiciona campos de senha (guardados criptografados) e a tabela do cofre.
--
-- O cofre é aberto pelo próprio login do sistema: cada usuário tem um "salt"
-- próprio e a chave de criptografia é derivada do id dele. Não existe mais
-- senha mestra nem tela de desbloqueio.

alter table companies add column if not exists anydesk_password text;
alter table companies add column if not exists vpn_password text;

-- Um registro por usuário logado.
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

-- Instalação antiga: a tabela da senha mestra não é mais usada.
-- Rode o comando abaixo só se quiser apagar a tabela antiga:
-- drop table if exists vault_config;
