import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('E-mail ou senha incorretos.')
    setBusy(false)
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={handleSubmit}>
        <div className="brand">
          <img src="/logo.svg" alt="OmniPrisma" style={{ width: '36px', height: '36px' }} />
          OmniPrisma
        </div>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
