import { useState } from 'react'
import { supabase } from '../supabaseClient'
import CompanyForm from './CompanyForm'
import ContactForm from './ContactForm'
import { useVault } from './VaultGate'

function Info({ label, value }) {
  return (
    <div className="info">
      <dt>{label}</dt>
      <dd>{value || <span className="muted">—</span>}</dd>
    </div>
  )
}

function SecretField({ label, encrypted }) {
  const vault = useVault()
  const [plain, setPlain] = useState(null)
  const [error, setError] = useState('')

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
          <span className="secret">
            <span className="mono">{plain ?? '••••••••'}</span>
            <button
              type="button"
              className="btn link"
              onClick={plain === null ? reveal : () => setPlain(null)}
            >
              {plain === null ? 'Mostrar' : 'Ocultar'}
            </button>
            <button type="button" className="btn link" onClick={copy}>
              Copiar
            </button>
          </span>
        )}
        {error && <span className="small" style={{ color: 'var(--danger)' }}> {error}</span>}
      </dd>
    </div>
  )
}

export default function CompanyDetail({ company, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [contactForm, setContactForm] = useState(null) // null | 'new' | id do contato

  async function deleteCompany() {
    if (!confirm(`Excluir "${company.name}" e todos os contatos dela?`)) return
    const { error } = await supabase.from('companies').delete().eq('id', company.id)
    if (error) return alert(error.message)
    onDeleted()
  }

  async function deleteContact(contact) {
    if (!confirm(`Excluir o contato "${contact.name}"?`)) return
    const { error } = await supabase.from('contacts').delete().eq('id', contact.id)
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
            <button className="btn" onClick={() => setEditing(true)}>
              Editar
            </button>
            <button className="btn danger" onClick={deleteCompany}>
              Excluir
            </button>
          </div>
        </div>

        <dl className="info-grid">
          <Info label="AnyDesk" value={company.anydesk} />
          <SecretField label="Senha do AnyDesk" encrypted={company.anydesk_password} />
          <Info label="VPN" value={company.vpn} />
          <SecretField label="Senha da VPN" encrypted={company.vpn_password} />
          <Info label="CNPJ" value={company.document} />
          <Info label="Telefone" value={company.phone} />
          <Info label="E-mail" value={company.email} />
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
                {ct.role && <span className="muted"> · {ct.role}</span>}
                <div className="small">
                  {[ct.phone, ct.email].filter(Boolean).join('  |  ') || (
                    <span className="muted">Sem telefone ou e-mail</span>
                  )}
                </div>
                {ct.notes && <p className="notes small">{ct.notes}</p>}
              </div>
              <div className="actions">
                <button className="btn" onClick={() => setContactForm(ct.id)}>
                  Editar
                </button>
                <button className="btn danger" onClick={() => deleteContact(ct)}>
                  Excluir
                </button>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  )
}
