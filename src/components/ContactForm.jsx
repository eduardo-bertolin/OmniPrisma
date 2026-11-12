import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ContactForm({ companyId, initial, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    filial: initial?.filial || '',
    sector: initial?.sector || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    notes: initial?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const { error } = initial
      ? await supabase.from('contacts').update(form).eq('id', initial.id)
      : await supabase.from('contacts').insert({ ...form, company_id: companyId })

    setBusy(false)
    if (error) return setError(error.message)
    onSaved()
  }

  return (
    <form className="subform" onSubmit={handleSubmit}>
      <div className="grid">
        <label>
          Nome
          <input value={form.name} onChange={set('name')} required autoFocus />
        </label>
        <label>
          Filial
          <input value={form.filial} onChange={set('filial')} />
        </label>
        <label>
          Setor
          <input value={form.sector} onChange={set('sector')} placeholder="Ex.: Financeiro, TI…" />
        </label>
        <label>
          Telefone
          <input value={form.phone} onChange={set('phone')} />
        </label>
        <label>
          E-mail
          <input type="email" value={form.email} onChange={set('email')} />
        </label>
        <label className="span2">
          Informações adicionais
          <textarea rows="3" value={form.notes} onChange={set('notes')} />
        </label>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button className="btn primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar contato'}
        </button>
      </div>
    </form>
  )
}
