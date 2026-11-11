import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { decryptText, deriveKey, encryptText, newSalt } from '../crypto'

const CHECK_TEXT = 'omni-prisma-cofre-ok'
const VaultContext = createContext(null)
export const useVault = () => useContext(VaultContext)

export default function VaultGate({ children }) {
  const [config, setConfig] = useState(undefined) // undefined = carregando, null = não existe
  const [key, setKey] = useState(null)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('vault_config')
      .select('*')
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setConfig(data)
      })
  }, [])

  const api = useMemo(
    () =>
      key && {
        encrypt: (text) => encryptText(key, text),
        decrypt: (value) => decryptText(key, value),
        lock: () => setKey(null),
      },
    [key]
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (config === null) {
        if (pass.length < 8) throw new Error('Use pelo menos 8 caracteres.')
        if (pass !== confirm) throw new Error('As senhas não conferem.')
        const salt = newSalt()
        const k = await deriveKey(pass, salt)
        const check_value = await encryptText(k, CHECK_TEXT)
        const { error } = await supabase.from('vault_config').insert({ id: 1, salt, check_value })
        if (error) throw new Error(error.message)
        setConfig({ salt, check_value })
        setKey(k)
      } else {
        const k = await deriveKey(pass, config.salt)
        let ok = false
        try {
          ok = (await decryptText(k, config.check_value)) === CHECK_TEXT
        } catch {
          ok = false
        }
        if (!ok) throw new Error('Senha mestra incorreta.')
        setKey(k)
      }
      setPass('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (api) return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
  if (config === undefined && !error) return null

  const creating = config === null

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          {creating ? 'Criar senha mestra' : 'Desbloquear cofre'}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {creating
            ? 'Ela protege as senhas de AnyDesk e VPN. Compartilhe só com quem da equipe precisa ver essas senhas. Se ela for perdida, as senhas salvas não podem ser recuperadas.'
            : 'Digite a senha mestra para ver e salvar senhas de AnyDesk e VPN.'}
        </p>
        <label>
          Senha mestra
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoFocus
            required
          />
        </label>
        {creating && (
          <label>
            Repita a senha mestra
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </label>
        )}
        {error && <div className="alert">{error}</div>}
        <button className="btn primary full" disabled={busy || config === undefined}>
          {busy ? 'Aguarde…' : creating ? 'Criar cofre' : 'Desbloquear'}
        </button>
        <button type="button" className="btn link" onClick={() => supabase.auth.signOut()}>
          Sair
        </button>
      </form>
    </div>
  )
}
