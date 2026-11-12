-- 1. Adicionar coluna user_id
alter table public.companies add column user_id uuid references auth.users(id);
alter table public.contacts add column user_id uuid references auth.users(id);

-- 2. Atualizar registros existentes para o admin (ID: 4668fa2d-7b05-486d-972f-0b0faa14ce80)
update public.companies set user_id = '4668fa2d-7b05-486d-972f-0b0faa14ce80' where user_id is null;
update public.contacts set user_id = '4668fa2d-7b05-486d-972f-0b0faa14ce80' where user_id is null;

-- 3. Tornar a coluna obrigatória (opcional, mas recomendado para integridade)
-- alter table public.companies alter column user_id set not null;
-- alter table public.contacts alter column user_id set not null;

-- 4. Corrigir políticas RLS
drop policy if exists "usuarios logados gerenciam empresas" on companies;
create policy "usuários apenas gerenciam suas empresas"
  on companies for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "usuarios logados gerenciam contatos" on contacts;
create policy "usuários apenas gerenciam seus contatos"
  on contacts for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
