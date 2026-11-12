-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  access_method text,     -- acesso via (anydesk, remotedesktop, cloud...)
  email text,
  anydesk text,
  vpn text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  filial text,            -- cargo / função
  sector text,            -- setor
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_company_id_idx on contacts(company_id);

-- Segurança: só usuários logados acessam os dados
alter table companies enable row level security;
alter table contacts  enable row level security;

drop policy if exists "usuarios logados gerenciam empresas" on companies;
drop policy if exists "usuarios logados gerenciam contatos" on contacts;

create policy "usuarios logados gerenciam empresas"
  on companies for all to authenticated
  using (true) with check (true);

create policy "usuarios logados gerenciam contatos"
  on contacts for all to authenticated
  using (true) with check (true);
