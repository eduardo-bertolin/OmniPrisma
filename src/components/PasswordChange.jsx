import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PasswordChange({ user, onComplete }) {
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

      // 2. Marca no perfil que a senha foi trocada (usando upsert para garantir que o registro exista)
      console.log('Tentando upsert do perfil para user:', user.id)
      const { data, error: profError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          must_change_password: false,
          email: user.email 
        })
      
      console.log('Resultado do upsert:', { data, profError })
      if (profError) throw profError

      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Nova Senha
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Este é seu primeiro acesso. Por segurança, você deve cadastrar uma nova senha pessoal.
        </p>
        <label>
          Nova Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Confirmar Senha
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert">{error}</div>}
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar e Acessar'}
        </button>
      </form>
    </div>
  )
}
