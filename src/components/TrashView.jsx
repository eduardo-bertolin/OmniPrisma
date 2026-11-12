import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const fmt = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return date.toLocaleString('pt-BR')
}

export default function TrashView({ isAdmin, onChanged }) {
  const [companies, setCompanies] = useState([])
  const [contacts, setContacts] = useState([])
  const [companyNames, setCompanyNames] = useState({})
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [delCompanies, delContacts, allCompanies, allProfiles] = await Promise.all([
      supabase.from('companies').select('*').not('deleted_at', 'is', null).order('name'),
      supabase.from('contacts').select('*').not('deleted_at', 'is', null).order('name'),
      supabase.from('companies').select('id, name'),
      supabase.from('profiles').select('id, email'),
    ])

    if (delCompanies.error) setError(delCompanies.error.message)
    else if (delContacts.error) setError(delContacts.error.message)
    else {
      setError('')
      setCompanies(delCompanies.data || [])
      setContacts(delContacts.data || [])
    }

    const names = {}
    ;(allCompanies.data || []).forEach((c) => {
      names[c.id] = c.name
    })
    setCompanyNames(names)

    const map = {}
    ;(allProfiles.data || []).forEach((p) => {
      map[p.id] = p.email
    })
    setProfiles(map)

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const who = (userId) => {
    if (!userId) return 'sistema'
    return profiles[userId] || `usuário (${userId.substring(0, 5)})`
  }

  async function restoreCompany(company) {
    setBusy(true)
    const { error: err } = await supabase
      .from('companies')
      .update({ deleted_at: null })
      .eq('id', company.id)

    if (!err) {
      // Recupera os contatos que foram para a lixeira junto com a empresa.
      await supabase
        .from('contacts')
        .update({ deleted_at: null })
        .eq('company_id', company.id)
        .eq('deleted_at', company.deleted_at)
    }

    setBusy(false)
    if (err) return setError(err.message)
    await load()
    onChanged?.()
  }

  async function restoreContact(contact) {
    setBusy(true)
    const { error: err } = await supabase
      .from('contacts')
      .update({ deleted_at: null })
      .eq('id', contact.id)
    setBusy(false)
    if (err) return setError(err.message)
    await load()
    onChanged?.()
  }

  async function purgeCompany(company) {
    if (!confirm(`Excluir definitivamente a empresa "${company.name}" e todos os contatos dela?\n\nEssa ação não pode ser desfeita.`))
      return
    setBusy(true)
    const { error: err } = await supabase.from('companies').delete().eq('id', company.id)
    setBusy(false)
    if (err) return setError(err.message)
    await load()
    onChanged?.()
  }

  async function purgeContact(contact) {
    if (!confirm(`Excluir definitivamente o contato "${contact.name}"?\n\nEssa ação não pode ser desfeita.`))
      return
    setBusy(true)
    const { error: err } = await supabase.from('contacts').delete().eq('id', contact.id)
    setBusy(false)
    if (err) return setError(err.message)
    await load()
    onChanged?.()
  }

  async function emptyTrash() {
    if (!confirm('Excluir definitivamente tudo que está na lixeira?\n\nEssa ação não pode ser desfeita.'))
      return
    setBusy(true)
    setError('')

    const deletedCompanies = companies.map((c) => c.id)
    const deletedContacts = contacts.map((c) => c.id)

    // Apagar a empresa leva os contatos junto (on delete cascade).
    if (deletedCompanies.length) {
      const { error: err } = await supabase.from('companies').delete().in('id', deletedCompanies)
      if (err) {
        setBusy(false)
        return setError(err.message)
      }
    }

    const remaining = deletedContacts.filter((id) => !deletedCompanies.includes(id))
    if (remaining.length) {
      const { error: err } = await supabase.from('contacts').delete().in('id', remaining)
      if (err) {
        setBusy(false)
        return setError(err.message)
      }
    }

    setBusy(false)
    await load()
    onChanged?.()
  }

  const total = companies.length + contacts.length

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>Lixeira</h2>
          {isAdmin && total > 0 && (
            <button className="btn danger" onClick={emptyTrash} disabled={busy}>
              Esvaziar lixeira
            </button>
          )}
        </div>

        {error && <div className="alert">{error}</div>}

        <p className="muted small" style={{ marginTop: 0 }}>
          Nada é apagado na hora: empresas e contatos excluídos ficam guardados aqui e podem
          ser restaurados. {isAdmin
            ? 'Como administrador, você pode apagar definitivamente o conteúdo da lixeira.'
            : 'A exclusão definitiva é liberada apenas para contas de administrador.'}
        </p>

        {loading && <p className="muted">Carregando…</p>}
        {!loading && total === 0 && <p className="muted">A lixeira está vazia.</p>}
      </section>

      {companies.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3 style={{ margin: 0 }}>Empresas excluídas</h3>
          </div>
          {companies.map((company) => (
            <div className="trash-item" key={company.id}>
              <div>
                <strong>{company.name}</strong>
                <div className="small muted">
                  Excluída em {fmt(company.deleted_at)} por {who(company.deleted_by)}
                </div>
              </div>
              <div className="actions">
                <button className="btn link" onClick={() => restoreCompany(company)} disabled={busy} title="Restaurar empresa" style={{ padding: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V4"></path>
                    <path d="M1 19a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v6"></path>
                    <path d="M12 14l-3-3 3-3"></path>
                  </svg>
                </button>
                {isAdmin && (
                  <button className="btn link danger" onClick={() => purgeCompany(company)} disabled={busy} title="Excluir definitivamente" style={{ padding: '4px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {contacts.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h3 style={{ margin: 0 }}>Contatos excluídos</h3>
          </div>
          {contacts.map((contact) => (
            <div className="trash-item" key={contact.id}>
              <div>
                <strong>{contact.name}</strong>
                <div className="small muted">
                  {contact.company_id && `Empresa: ${companyNames[contact.company_id] || '—'} · `}
                  Excluído em {fmt(contact.deleted_at)} por {who(contact.deleted_by)}
                </div>
              </div>
              <div className="actions">
                <button className="btn link" onClick={() => restoreContact(contact)} disabled={busy} title="Restaurar contato" style={{ padding: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 4v6a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4V4"></path>
                    <path d="M1 19a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V4a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v6"></path>
                    <path d="M12 14l-3-3 3-3"></path>
                  </svg>
                </button>
                {isAdmin && (
                  <button className="btn link danger" onClick={() => purgeContact(contact)} disabled={busy} title="Excluir definitivamente" style={{ padding: '4px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
