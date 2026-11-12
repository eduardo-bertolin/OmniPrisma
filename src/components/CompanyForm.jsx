import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useVault } from './VaultProvider'

const ACCESS_OPTIONS = ['AnyDesk', 'Remote Desktop', 'RDP', 'Cloud', 'VPN', 'SSH', 'TeamViewer']

export default function CompanyForm({ initial, onSaved, onCancel }) {
  const vault = useVault()
  const [form, setForm] = useState({
    name: initial?.name || '',
    access_method: initial?.access_method || '',
    email: initial?.email || '',
    anydesk: initial?.anydesk || '',
    anydesk_password: '',
    vpn: initial?.vpn || '',
    vpn_password: '',
    notes: initial?.notes || '',
  })
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Ao editar, descriptografa as senhas atuais para preencher o formulário
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const a = initial?.anydesk_password ? await vault.decrypt(initial.anydesk_password) : ''
        const v = initial?.vpn_password ? await vault.decrypt(initial.vpn_password) : ''
        if (alive) setForm((f) => ({ ...f, anydesk_password: a, vpn_password: v }))
      } catch {
        if (alive) setError('Não foi possível descriptografar as senhas salvas.')
        return
      }
      if (alive) setReady(true)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const payload = {
      ...form,
      anydesk_password: form.anydesk_password ? await vault.encrypt(form.anydesk_password) : null,
      vpn_password: form.vpn_password ? await vault.encrypt(form.vpn_password) : null,
    }

    const query = initial
      ? supabase.from('companies').update(payload).eq('id', initial.id).select().single()
      : supabase.from('companies').insert(payload).select().single()

    const { data, error } = await query
    setBusy(false)
    if (error) return setError(error.message)
    onSaved(data.id)
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-head">
        <h2>{initial ? 'Editar empresa' : 'Nova empresa'}</h2>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>

      <div className="form-grid">
        <label>
          Nome da empresa
          <input value={form.name} onChange={set('name')} required autoFocus />
        </label>
        <label>
          Acesso via
          <input
            list="access-methods"
            value={form.access_method}
            onChange={set('access_method')}
            placeholder="AnyDesk, Remote Desktop, Cloud…"
          />
          <datalist id="access-methods">
            {ACCESS_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={set('email')} />
        </label>
        <label>
          Número do AnyDesk
          <input value={form.anydesk} onChange={set('anydesk')} />
        </label>
        <label>
          Senha do AnyDesk (criptografada)
          <input
            type="password"
            autoComplete="new-password"
            value={form.anydesk_password}
            onChange={set('anydesk_password')}
          />
        </label>
        <label>
          VPN utilizada
          <input value={form.vpn} onChange={set('vpn')} />
        </label>
        <label>
          Senha da VPN (criptografada)
          <input
            type="password"
            autoComplete="new-password"
            value={form.vpn_password}
            onChange={set('vpn_password')}
          />
        </label>
        <label className="span2">
          Observações
          <textarea
            rows="4"
            value={form.notes}
            onChange={set('notes')}
          />
        </label>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="actions">
        <button className="btn primary" disabled={busy || !ready}>
          {busy ? 'Salvando…' : 'Salvar empresa'}
        </button>
      </div>
    </form>
  )
}