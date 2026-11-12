import { useState } from 'react'
import { supabase } from '../supabaseClient'
import CompanyForm from './CompanyForm'
import ContactForm from './ContactForm'
import { useVault } from './VaultProvider'

function Info({ label, value }) {
  const [fading, setFading] = useState(false)

  async function copy() {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setFading(true)
    setTimeout(() => setFading(false), 600)
  }

  return (
    <div className="info">
      <dt>{label}</dt>
      <dd
        onClick={copy}
        style={{ cursor: 'pointer', display: 'inline-block' }}
        title="Clique para copiar"
        className={fading ? 'fade-copy' : ''}
      >
        {value || <span className="muted">—</span>}
      </dd>
    </div>
  )
}

function IconIndicator({ label, value, iconSrc, alt }) {
  const isNull = value === null || value === undefined;
  const checked = value === true;
  
  return (
    <div className="info">
      <dt>{label}</dt>
      <dd style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img 
          src={iconSrc} 
          alt={alt} 
          style={{ 
            width: '20px', 
            height: '20px',
            filter: isNull ? 'grayscale(100%) opacity(30%)' : (checked ? 'none' : 'grayscale(100%) opacity(50%)'),
            opacity: isNull ? 0.3 : (checked ? 1 : 0.5)
          }} 
        />
        <span style={{ 
          color: isNull ? 'var(--text-dim)' : (checked ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)'),
          fontWeight: 600,
          fontSize: '0.875rem'
        }}>
          {isNull ? '?' : (checked ? '✓' : '✗')}
        </span>
      </dd>
    </div>
  )
}



function SecretField({ label, encrypted }) {
  const vault = useVault()
  const [plain, setPlain] = useState(null)
  const [error, setError] = useState('')
  const [fading, setFading] = useState(false)

  async function reveal() {
    try {
      setPlain(await vault.decrypt(encrypted))
    } catch {
      setError('Falha ao descriptografar')
    }
  }

  async function copy() {
    try {
      const text = plain ?? (await vault.decrypt(encrypted))
      await navigator.clipboard.writeText(text)
      setFading(true)
      setTimeout(() => setFading(false), 600)
    } catch {
      setError('Falha ao copiar')
    }
  }

  return (
    <div className="info">
      <dt>{label}</dt>
      <dd>
        {!encrypted ? (
          <span className="muted">—</span>
        ) : (
          <span className="secret" onClick={copy} style={{ cursor: 'pointer' }} title="Clique para copiar">
            <span className={`mono ${fading ? 'fade-copy' : ''}`}>{plain ?? '••••••••'}</span>
            <button
              type="button"
              className="btn link"
              onClick={(e) => { e.stopPropagation(); plain === null ? reveal() : setPlain(null) }}
            >
              {plain === null ? 'Mostrar' : 'Ocultar'}
            </button>
          </span>
        )}
        {error && <span className="small" style={{ color: 'var(--danger)' }}> {error}</span>}
      </dd>
    </div>
  )
}

export default function CompanyDetail({ company, user, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [contactForm, setContactForm] = useState(null) // null | 'new' | id do contato

  async function deleteCompany() {
    if (!confirm(`Excluir "${company.name}" e todos os contatos dela?`)) return
    const { error } = await supabase
      .from('companies')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user.id 
      })
      .eq('id', company.id)
    if (error) return alert(error.message)
    onDeleted()
  }

  async function deleteContact(contact) {
    if (!confirm(`Excluir o contato "${contact.name}"?`)) return
    const { error } = await supabase
      .from('contacts')
      .update({ 
        deleted_at: new Date().toISOString(),
        deleted_by: user.id 
      })
      .eq('id', contact.id)
    if (error) return alert(error.message)
    onChanged()
  }

  if (editing) {
    return (
      <CompanyForm
        initial={company}
        onCancel={() => setEditing(false)}
        onSaved={async () => {
          await onChanged()
          setEditing(false)
        }}
      />
    )
  }

  const contacts = [...company.contacts].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="stack">
      <section className="card">
        <div className="card-head">
          <h2>{company.name}</h2>
          <div className="actions">
            <button className="btn link" onClick={() => setEditing(true)} title="Editar empresa" style={{ padding: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button className="btn link danger" onClick={deleteCompany} title="Excluir empresa" style={{ padding: '4px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <dl className="info-grid">
          <Info label="Acesso da Base via" value={company.access_method} />
          <Info label="AnyDesk" value={company.anydesk} />
          <SecretField label="Senha do AnyDesk" encrypted={company.anydesk_password} />
          <Info label="VPN" value={company.vpn} />
          <SecretField label="Senha da VPN" encrypted={company.vpn_password} />
          <Info label="E-mail" value={company.email} />
          <IconIndicator 
            label="Possui RH" 
            value={company.has_rh}
            iconSrc="/rh-cp.ico" 
            alt="RH/Controle Ponto" 
          />
          <IconIndicator 
            label="Possui SP" 
            value={company.has_sp}
            iconSrc="/sp.ico" 
            alt="Sistema de Ponto" 
          />
        </dl>

        {company.notes && (
          <>
            <h3>Observações</h3>
            <p className="notes">{company.notes}</p>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Contatos</h2>
          {contactForm === null && (
            <button className="btn primary" onClick={() => setContactForm('new')}>
              Novo contato
            </button>
          )}
        </div>

        {contactForm === 'new' && (
          <ContactForm
            companyId={company.id}
            onCancel={() => setContactForm(null)}
            onSaved={async () => {
              await onChanged()
              setContactForm(null)
            }}
          />
        )}

        {contacts.length === 0 && contactForm !== 'new' && (
          <p className="muted">Nenhum contato cadastrado nessa empresa.</p>
        )}

        {contacts.map((ct) =>
          contactForm === ct.id ? (
            <ContactForm
              key={ct.id}
              companyId={company.id}
              initial={ct}
              onCancel={() => setContactForm(null)}
              onSaved={async () => {
                await onChanged()
                setContactForm(null)
              }}
            />
          ) : (
            <div className="contact" key={ct.id}>
              <div>
                <strong>{ct.name}</strong>
                {(ct.filial || ct.sector) && (
                  <span className="muted">
                    {ct.filial ? ` · ${ct.filial}` : ''}
                    {ct.sector ? ` · Setor: ${ct.sector}` : ''}
                  </span>
                )}
                <div className="small">
                  {[ct.phone, ct.email].filter(Boolean).join('  |  ') || (
                    <span className="muted">Sem telefone ou e-mail</span>
                  )}
                </div>
                {ct.notes && <p className="notes small">{ct.notes}</p>}
              </div>
              <div className="actions">
                <button className="btn link" onClick={() => setContactForm(ct.id)} title="Editar contato" style={{ padding: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button className="btn link danger" onClick={() => deleteContact(ct)} title="Excluir contato" style={{ padding: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  )
}
