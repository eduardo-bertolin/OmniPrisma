import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { decryptText, deriveKey, encryptText, newSalt } from '../crypto'

const VaultContext = createContext(null)
export const useVault = () => useContext(VaultContext)

export default function VaultProvider({ user, password, children }) {
  const [api, setApi] = useState(null)
  const [error, setError] = useState('')
  const [needsInit, setNeedsInit] = useState(false)
  const [inputPassword, setInputPassword] = useState('')
  const [submittedPassword, setSubmittedPassword] = useState(password)

  async function initializeVault() {
    console.log("DEBUG: Iniciando initializeVault...");
    alert("Iniciando inicialização do cofre...");
    try {
      console.log("DEBUG: password atual:", submittedPassword);
      // 1. Gera uma chave mestra aleatória forte
      const masterKeyString = newSalt()
      
      // 2. Deriva a chave de proteção da senha do usuário
      const protectionKey = await deriveKey(submittedPassword, user.id)
      
      // 3. Criptografa a chave mestra com a chave de proteção
      const encryptedMasterKey = await encryptText(protectionKey, masterKeyString)
      
      // 4. Salva no banco
      const { error } = await supabase.from('user_vault_keys').insert({
        user_id: user.id,
        encrypted_master_key: encryptedMasterKey
      })
      
      if (error) {
        console.error("DEBUG: Erro Supabase:", error);
        throw error
      }
      
      // 5. Recarrega o cofre
      window.location.reload()
    } catch (err) {
      console.error("DEBUG: Erro capturado:", err);
      setError('Falha ao inicializar cofre: ' + err.message)
    }
  }

  useEffect(() => {
    let alive = true
    async function setup() {
      try {
        const { data, error } = await supabase
          .from('user_vault_keys')
          .select('encrypted_master_key')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        if (!data) {
          setNeedsInit(true)
          return
        }

        const decryptionKey = await deriveKey(submittedPassword, user.id)
        const masterKey = await decryptText(decryptionKey, data.encrypted_master_key)

        if (alive) {
          // Importa a chave mestra como chave AES
          const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(masterKey), 'AES-GCM', false, ['encrypt', 'decrypt'])

          setApi({
            encrypt: (text) => encryptText(key, text),
            decrypt: (value) => decryptText(key, value),
          })
          setError('')
        }
      } catch (err) {
        if (alive) setError('Falha ao abrir cofre: senha incorreta ou chave corrompida.')
      }
    }

    if (user && submittedPassword) setup()
    
    return () => { alive = false }
  }, [user, submittedPassword])

  if (!submittedPassword) return (
    <div className="login-wrap">
      <form className="card login" onSubmit={(e) => { e.preventDefault(); setSubmittedPassword(inputPassword) }}>
        <h2>Desbloquear Cofre</h2>
        <label>
          Senha da sua conta
          <input type="password" onChange={(e) => setInputPassword(e.target.value)} autoFocus required autoComplete="new-password" />
        </label>
        <button className="btn primary full" type="submit">Desbloquear</button>
      </form>
    </div>
  )

  if (needsInit) return (
    <div className="login-wrap">
      <div className="card login">
        <h2>Inicializar Cofre</h2>
        <p>Parece que o cofre ainda não foi configurado para este usuário.</p>
        <button className="btn primary full" onClick={initializeVault}>Criar Cofre Agora</button>
      </div>
    </div>
  )

  if (error) return <div className="login-wrap"><div className="card alert">{error} <button onClick={() => setSubmittedPassword('')} className="btn link">Tentar novamente</button></div></div>
  if (!api) return <div className="login-wrap">Abrindo cofre...</div>

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}