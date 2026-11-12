-- 1. Tabela para armazenar a chave mestra criptografada por usuário
create table if not exists public.user_vault_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_master_key text not null
);

-- RLS para esta tabela
alter table public.user_vault_keys enable row level security;

create policy "Usuários podem ler sua própria chave"
  on public.user_vault_keys for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Usuários podem inserir/atualizar sua própria chave"
  on public.user_vault_keys for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuários podem atualizar sua própria chave"
  on public.user_vault_keys for update
  to authenticated
  using (auth.uid() = user_id);
