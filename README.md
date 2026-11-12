# Omni Prisma

CRUD interno de empresas e contatos (React + Vite + Supabase).

## Como rodar

1. Crie um projeto em https://supabase.com
2. No painel: SQL Editor > cole o conteúdo de `supabase.sql` > Run, e depois o de `supabase-cofre.sql` > Run
   - Se o banco já existe, rode `supabase-mudancas.sql` (cada bloco é um comando independente)
3. No painel: Authentication > Users > Add user (crie seu e-mail e senha, marque "Auto Confirm User")
4. No painel: Project Settings > API > copie "Project URL" e a chave "anon public"
5. Copie `.env.example` para `.env` e preencha as duas variáveis
6. No terminal:

       npm install
       npm run dev

7. Abra http://localhost:5173 e entre com o usuário criado no passo 3

## Cadastros

- **Empresa**: nome, acesso via (AnyDesk, Remote Desktop, Cloud...), e-mail, número/senha do
  AnyDesk, VPN utilizada/senha e observações. Não tem mais CNPJ e telefone.
- **Contato**: nome, filial, setor, telefone, e-mail e informações adicionais.

## Criptografia das senhas

- As senhas de AnyDesk e VPN são criptografadas no navegador (AES-256-GCM) antes de ir ao Supabase.
- O cofre é aberto pelo **próprio login**: não existe senha mestra nem tela de desbloqueio.
- Cada usuário tem um "salt" guardado em `user_vault_keys` e a chave é derivada do id dele,
  então a mesma conta abre sempre as mesmas senhas, inclusive depois de atualizar a página.
- Quem entra no painel do Supabase com acesso ao banco ainda consegue ler o texto criptografado;
  o que a criptografia protege é o conteúdo em si, não o acesso ao banco.
- Em produção o site precisa estar em HTTPS (em localhost funciona normalmente).

### Migrar senhas salvas com a antiga senha mestra

Se o banco já tinha senhas gravadas com a senha mestra, recriptografe-as com:

    $env:SUPABASE_EMAIL="voce@empresa.com"
    $env:SUPABASE_PASS="sua senha de login"
    $env:MASTER_PASSWORD="sua senha mestra antiga"
    node scripts/migrate-cofre.mjs

Depois disso a tabela antiga pode ser removida: `drop table if exists vault_config;`
