import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { decryptText, deriveKey, encryptText, newKey, fromB64 } from '../crypto'

const VaultContext = createContext(null)
export const useVault = () => useContext(VaultContext)

export default function VaultProvider({ user, children }) {
  const [api, setApi] = useState(null)
  const [error, setError] = useState('')
  const [checkingVault, setCheckingVault] = useState(true)

  useEffect(() => {
    if (!user) return
    let alive = true

    async function setupVault() {
      try {
        console.log('Setting up vault for user:', user.id)
        
        // Deriva a chave de proteção APENAS do user.id (transparência total)
        const saltB64 = btoa(user.id)
        console.log('Salt:', saltB64)
        const protectionKey = await deriveKey(user.id, saltB64)
        console.log('Protection key derived')

        // Tenta buscar a chave mestra
        let { data, error: fetchError } = await supabase
          .from('user_vault_keys')
          .select('encrypted_master_key')
          .eq('user_id', user.id)
          .maybeSingle()

        if (fetchError) throw fetchError
        console.log('Vault data:', data)

        // Se não existir, inicializa automaticamente
        if (!data) {
          console.log('Initializing new vault...')
          const masterKeyString = newKey()
          const encryptedMasterKey = await encryptText(protectionKey, masterKeyString)
          
          const { error: insertError } = await supabase.from('user_vault_keys').insert({
            user_id: user.id,
            encrypted_master_key: encryptedMasterKey,
            salt: 'legacy',
            created_at: new Date().toISOString()
          })
          if (insertError) throw insertError
          data = { encrypted_master_key: encryptedMasterKey }
          console.log('Vault initialized')
        }

        // Descriptografa a chave mestra
        const masterKeyBase64 = await decryptText(protectionKey, data.encrypted_master_key)
        console.log('Master key decrypted')

        if (alive) {
          const masterKeyBytes = fromB64(masterKeyBase64)
          const key = await crypto.subtle.importKey('raw', masterKeyBytes, 'AES-GCM', false, ['encrypt', 'decrypt'])

          setApi({
            encrypt: (text) => encryptText(key, text),
            decrypt: (value) => decryptText(key, value),
          })
          setCheckingVault(false)
        }
      } catch (err) {
        if (alive) {
          console.error('Erro ao processar cofre:', err)
          setError('Falha ao acessar o cofre: ' + err.message)
          setCheckingVault(false)
        }
      }
    }

    setupVault()
    return () => { alive = false }
  }, [user])

  if (checkingVault) return <div className="login-wrap">Acessando cofre...</div>
  if (error) return <div className="login-wrap"><div className="card alert">{error}</div></div>
  if (!api) return <div className="login-wrap">Processando...</div>

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}
