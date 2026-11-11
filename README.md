# Omni Prisma

CRUD interno de empresas e contatos (React + Vite + Supabase).

## Como rodar

1. Crie um projeto em https://supabase.com
2. No painel: SQL Editor > cole o conteúdo de `supabase.sql` > Run, e depois o de `supabase-cofre.sql` > Run
3. No painel: Authentication > Users > Add user (crie seu e-mail e senha, marque "Auto Confirm User")
4. No painel: Project Settings > API > copie "Project URL" e a chave "anon public"
5. Copie `.env.example` para `.env` e preencha as duas variáveis
6. No terminal:

       npm install
       npm run dev

7. Abra http://localhost:5173 e entre com o usuário criado no passo 3

## Criptografia das senhas

- As senhas de AnyDesk e VPN são criptografadas no navegador (AES-256-GCM) antes de ir ao Supabase.
- Na primeira entrada o sistema pede para criar uma **senha mestra**; depois, cada sessão pede essa senha.
- A senha mestra não é guardada em lugar nenhum. Se for perdida, as senhas salvas não podem ser recuperadas.
- Ao atualizar a página o cofre bloqueia de novo (a chave fica só na memória).
- Em produção o site precisa estar em HTTPS (em localhost funciona normalmente).
