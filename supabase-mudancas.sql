-- Adicionar colunas de controle de ponto e refeitório
alter table public.companies add column has_rh boolean default false;
alter table public.companies add column has_sp boolean default false;
-- Adicionar coluna de usuário VPN
alter table public.companies add column vpn_user text;