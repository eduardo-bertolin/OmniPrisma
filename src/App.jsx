import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import CompanyForm from './components/CompanyForm'
import CompanyDetail from './components/CompanyDetail'
import TrashView from './components/TrashView'
import PasswordChange from './components/PasswordChange'
import VaultProvider from './components/VaultProvider'

const norm = (s) =>
  (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

function Workspace({ user }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [mustChange, setMustChange] = useState(false)
  const [view, setView] = useState('main')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase
        .from('companies')
        .select('*, contacts(*)')
        .is('deleted_at', null)
        .order('name'),
      supabase.from('profiles').select('role, must_change_password').eq('id', user.id).maybeSingle(),
    ])
    
    if (error) setError(error.message)
    else {
      setError('')
      setCompanies(data || [])
    }
    if (profile?.role === 'admin') setIsAdmin(true)
    if (profile?.must_change_password) setMustChange(true)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Busca em dados da empresa e dos contatos
  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return companies.map((c) => ({ company: c, matchedContact: null }))
    return companies
      .map((c) => {
        const companyText = norm(
          [c.name, c.access_method, c.anydesk, c.vpn, c.email, c.notes].join(' ')
        )
        const matchedContact = c.contacts.find((ct) =>
          norm([ct.name, ct.filial, ct.sector, ct.phone, ct.email, ct.notes].join(' ')).includes(q)
        )
        if (companyText.includes(q) || matchedContact) return { company: c, matchedContact }
        return null
      })
      .filter(Boolean)
  }, [companies, query])

  const selected = companies.find((c) => c.id === selectedId) || null

  async function handleSaved(id) {
    await load()
    setSelectedId(id)
    setCreating(false)
  }

  async function handleDeleted() {
    setSelectedId(null)
    await load()
  }

  // Renderização condicional SEM pular hooks - usa JSX condicional
  if (mustChange) {
    return <PasswordChange user={user} onComplete={() => setMustChange(false)} />
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand" onClick={() => setView('main')} style={{ cursor: 'pointer', marginBottom: '16px' }}>
          <img src="/logo.svg" alt="OmniPrisma" style={{ width: '40px', height: '40px' }} />
          OmniPrisma
        </div>

        <input
          className="search"
          type="search"
          placeholder="Buscar empresa, contato, acesso via…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          className="btn primary full"
          onClick={() => {
            setCreating(true)
            setSelectedId(null)
            setView('main')
          }}
        >
          Nova empresa
        </button>

        <div className="list">
          {view === 'main' && loading && <p className="muted pad">Carregando…</p>}
          {view === 'main' && !loading && results.length === 0 && (
            <p className="muted pad">
              {query ? 'Nada encontrado para essa busca.' : 'Nenhuma empresa ainda. Cadastre a primeira.'}
            </p>
          )}
          {view === 'main' && results.map(({ company, matchedContact }) => (
            <button
              key={company.id}
              className={'list-item' + (company.id === selectedId ? ' active' : '')}
              onClick={() => {
                setSelectedId(company.id)
                setCreating(false)
              }}
            >
              <strong>{company.name}</strong>
              <span className="muted small">
                {matchedContact
                  ? `Contato: ${matchedContact.name}`
                  : `${company.contacts.length} contato(s)`}
              </span>
            </button>
          ))}
        </div>

        <div className="user-box">
          <span className="small muted">
            {user.email}
            {isAdmin && (
              <svg 
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                style={{ color: 'var(--accent)', marginLeft: '8px', cursor: 'pointer', verticalAlign: 'middle' }}
                onClick={() => setView('trash')}
                title="Lixeira"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            )}
          </span>
          <span>
            <button className="btn link" onClick={() => supabase.auth.signOut()}>
              Sair
            </button>
          </span>
        </div>
      </aside>

      <main className="content">
        {error && <div className="alert">{error}</div>}

        {view === 'trash' ? (
          <TrashView isAdmin={isAdmin} onChanged={load} />
        ) : (
          <>
            {creating && (
              <CompanyForm onSaved={handleSaved} onCancel={() => setCreating(false)} />
            )}

            {!creating && selected && (
              <CompanyDetail
                key={selected.id}
                company={selected}
                user={user}
                onChanged={load}
                onDeleted={handleDeleted}
              />
            )}

            {!creating && !selected && (
              <div className="empty">
                <h2>Selecione uma empresa</h2>
                <p className="muted">
                  Escolha uma empresa na lista ao lado ou cadastre uma nova para ver os dados
                  técnicos e os contatos.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return null
  if (!session) return <Login />
  return (
    <VaultProvider user={session.user}>
      <Workspace user={session.user} />
    </VaultProvider>
  )
}