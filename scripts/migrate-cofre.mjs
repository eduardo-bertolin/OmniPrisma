// Recriptografa as senhas que foram salvas com a antiga "senha mestra" para a
// chave nova (derivada do usuário logado).
//
// Uso (PowerShell):
//   $env:SUPABASE_EMAIL="voce@empresa.com"
//   $env:SUPABASE_PASS="sua senha de login"
//   $env:MASTER_PASSWORD="sua senha mestra antiga"
//   node scripts/migrate-cofre.mjs
//
// As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são lidas do .env.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { deriveKey, decryptText, encryptText, newSalt } from '../src/crypto.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readDotEnv() {
  try {
    return Object.fromEntries(
      readFileSync(join(root, '.env'), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')]
        })
    )
  } catch {
    return {}
  }
}

const env = { ...readDotEnv(), ...process.env }

const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
const email = env.SUPABASE_EMAIL
const pass = env.SUPABASE_PASS
const master = env.MASTER_PASSWORD

if (!url || !anonKey || !email || !pass) {
  console.error('Faltam variáveis. Defina SUPABASE_EMAIL e SUPABASE_PASS e confira o .env.')
  process.exit(1)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password: pass,
})
if (authError) {
  console.error('Falha no login:', authError.message)
  process.exit(1)
}
const userId = auth.user.id
console.log(`Logado como ${auth.user.email} (${userId})`)

// Sal da chave nova (o app cria sozinho, mas o script garante que exista)
let { data: vaultRow } = await supabase
  .from('user_vault_keys')
  .select('salt')
  .eq('user_id', userId)
  .maybeSingle()

if (!vaultRow?.salt) {
  const salt = newSalt()
  const { error } = await supabase.from('user_vault_keys').insert({ user_id: userId, salt })
  if (error) {
    console.error('Falha ao criar o sal do cofre:', error.message)
    process.exit(1)
  }
  vaultRow = { salt }
}

const newKey = await deriveKey(`omni-prisma:${userId}`, vaultRow.salt)

// Chave antiga (senha mestra)
let oldKey = null
if (master) {
  const { data: oldConfig } = await supabase.from('vault_config').select('*').maybeSingle()
  if (oldConfig?.salt) {
    oldKey = await deriveKey(master, oldConfig.salt)
    console.log('Senha mestra antiga carregada.')
  } else {
    console.log('Aviso: não existe cofre antigo (vault_config) para ler.')
  }
} else {
  console.log('Aviso: MASTER_PASSWORD não informada — só tento migrar senhas já no formato novo.')
}

const { data: companies, error: compError } = await supabase
  .from('companies')
  .select('id, name, anydesk_password, vpn_password')

if (compError) {
  console.error('Falha ao ler as empresas:', compError.message)
  process.exit(1)
}

let migrated = 0
let skipped = 0
let failed = 0

for (const company of companies) {
  const patch = {}

  for (const column of ['anydesk_password', 'vpn_password']) {
    const value = company[column]
    if (!value) continue

    try {
      await decryptText(newKey, value)
      skipped++
      continue // já está na chave nova
    } catch {
      // tenta a chave antiga
    }

    if (!oldKey) {
      failed++
      console.log(`  ! ${company.name}: senha em ${column} não pôde ser lida (sem chave antiga)`)
      continue
    }

    try {
      const plain = await decryptText(oldKey, value)
      patch[column] = await encryptText(newKey, plain)
      migrated++
    } catch {
      failed++
      console.log(`  ! ${company.name}: senha em ${column} não pôde ser descriptografada`)
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('companies').update(patch).eq('id', company.id)
    if (error) {
      failed++
      console.error(`  ! ${company.name}: falha ao gravar — ${error.message}`)
    }
  }
}

console.log('\nResumo:')
console.log(`  senhas migradas: ${migrated}`)
console.log(`  senhas já novas: ${skipped}`)
console.log(`  senhas com erro: ${failed}`)

if (failed === 0) {
  console.log('\nTudo certo. Agora pode rodar (opcional) no Supabase: drop table if exists vault_config;')
}
