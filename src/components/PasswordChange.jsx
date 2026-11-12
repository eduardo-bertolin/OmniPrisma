import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PasswordChange({ user, onComplete, isSettings = false }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) return setError('A senha deve ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')

    setBusy(true)
    setError('')

    try {
      // 1. Atualiza a senha no Auth do Supabase
      const { error: authError } = await supabase.auth.updateUser({ password })
      if (authError) throw authError

      // 2. Marca no perfil que a senha foi trocada
      const { error: profError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          must_change_password: false,
          email: user.email 
        })
      
      if (profError) throw profError

      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div className="card-head">
        <h2>{isSettings ? 'Alterar Senha' : 'Nova Senha'}</h2>
        {isSettings && (
          <button type="button" className="btn" onClick={onComplete}>
            Voltar
          </button>
        )}
      </div>
      
      {!isSettings && (
        <p className="muted small" style={{ marginBottom: '16px' }}>
          Este é seu primeiro acesso. Por segurança, você deve cadastrar uma nova senha pessoal.
        </p>
      )}

      <label>
        Nova Senha
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
        />
      </label>
      <label>
        Confirmar Senha
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </label>
      {error && <div className="alert">{error}</div>}
      <button className="btn primary full" disabled={busy} style={{ marginTop: '16px' }}>
        {busy ? 'Salvando…' : 'Salvar Senha'}
      </button>
    </form>
  )
}
