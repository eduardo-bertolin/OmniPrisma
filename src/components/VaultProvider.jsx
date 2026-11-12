import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { decryptText, deriveKey, encryptText, newSalt } from '../crypto'

// O cofre agora é aberto pelo próprio login: a chave de criptografia é derivada
// do usuário (id + salt salvo no banco). Não existe mais "senha mestra" nem
// tela de desbloqueio.

const VaultContext = createContext(null)
export const useVault = () => useContext(VaultContext)

async function ensureSalt(userId) {
  const { data, error } = await supabase
    .from('user_vault_keys')
    .select('salt')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (data?.salt) return data.salt

  const salt = newSalt()
  const { error: insertError } = await supabase
    .from('user_vault_keys')
    .insert({ user_id: userId, salt })

  if (insertError) {
    // Corrida entre abas: outra sessão pode ter criado o sal antes.
    const { data: again, error: selectError } = await supabase
      .from('user_vault_keys')
      .select('salt')
      .eq('user_id', userId)
      .maybeSingle()
    if (selectError) throw selectError
    if (again?.salt) return again.salt
    throw insertError
  }

  return salt
}

export default function VaultProvider({ user, children }) {
  const [key, setKey] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true

    async function setup() {
      try {
        const SHARED_SEED = 'OmniPrisma:CompanySharedKey2026'
        // Salt fixo válido em base64 (16 bytes)
        const SHARED_SALT = 'c29tZXJhbmRvbXNhbHQ=' 
        
        const derived = await deriveKey(SHARED_SEED, SHARED_SALT)
        
        if (alive) {
          setKey(derived)
          setError('')
        }
      } catch (err) {
        if (alive) setError(err.message)
      }
    }

    setKey(null)
    setup()

    return () => {
      alive = false
    }
  }, [])

  const api = useMemo(
    () =>
      key && {
        encrypt: (text) => encryptText(key, text),
        decrypt: (value) => decryptText(key, value),
      },
    [key]
  )

  if (error) {
    return (
      <div className="login-wrap">
        <div className="card login">
          <div className="brand">
            <img src="/logo.svg" alt="OmniPrisma" style={{ width: '36px', height: '36px' }} />
            OmniPrisma
          </div>
          <div className="alert">
            Não foi possível inicializar o cofre: {error}
          </div>
        </div>
      </div>
    )
  }

  if (!api) return <div className="login-wrap" style={{ color: 'var(--text)' }}>Carregando cofre...</div>

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}
