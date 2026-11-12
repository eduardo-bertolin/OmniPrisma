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
        const salt = await ensureSalt(user.id)
        const derived = await deriveKey(`OmniPrisma:${user.id}`, salt)
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
  }, [user.id])

  const api = useMemo(
    () =>
      key && {
        encrypt: (text) => encryptText(key, text),
        decrypt: (value) => decryptText(key, value),
      },
    [key]
  )

  if (error) {
    // Se o erro for de conflito (409), tenta ignorar e buscar novamente (o registro já existe)
    if (error.code === '23505') {
       // O insert falhou porque já existe, prossegue para tentar buscar o salt
    } else {
        const faltouTabela =
          error.includes('user_vault_keys') || error.includes('schema cache')

        return (
          <div className="login-wrap">
            <div className="card login">
              <div className="brand">
                <span className="brand-mark" aria-hidden="true" />
                OmniPrisma
              </div>
              <div className="alert">
                {faltouTabela ? (
                  <>
                    A tabela <strong>user_vault_keys</strong> ainda não existe no Supabase.
                    <br />
                    Rode o arquivo <strong>supabase-mudancas.sql</strong> (comando 4) no SQL Editor.
                  </>
                ) : (
                  <>Não foi possível abrir o cofre: {error}</>
                )}
              </div>
            </div>
          </div>
        )
    }
  }

  if (!api) return null

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}
