-- Adicionar colunas de controle de ponto e refeitório
alter table public.companies add column has_rh boolean default false;
alter table public.companies add column has_sp boolean default false;