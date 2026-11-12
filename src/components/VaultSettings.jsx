import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { decryptText, deriveKey, encryptText } from '../crypto'
import { toast } from 'react-toastify'
import { useVault } from './VaultProvider'

export default function VaultSettings({ user, onComplete }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (newPassword !== confirmPassword) return toast.error('As senhas não conferem.')
    
    setBusy(true)
    try {
      const { data } = await supabase
        .from('user_vault_keys')
        .select('encrypted_master_key')
        .eq('user_id', user.id)
        .single()
      
      const saltB64 = btoa(user.id)
      // Valida com a senha antiga informada
      const oldProtectionKey = await deriveKey(oldPassword, saltB64)
      const masterKeyBase64 = await decryptText(oldProtectionKey, data.encrypted_master_key)
      
      // Re-criptografa com a nova
      const newProtectionKey = await deriveKey(newPassword, saltB64)
      const newEncryptedMasterKey = await encryptText(newProtectionKey, masterKeyBase64)
      
      const { error } = await supabase
        .from('user_vault_keys')
        .update({ encrypted_master_key: newEncryptedMasterKey })
        .eq('user_id', user.id)
        
      if (error) throw error
      
      toast.success('Senha do cofre alterada com sucesso!')
      onComplete()
    } catch (err) {
      console.error(err)
      toast.error('Falha ao alterar senha do cofre: verifique a senha atual.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={handlePasswordChange} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div className="card-head" style={{ marginBottom: '16px' }}>
        <h2>Alterar Senha do Cofre</h2>
        <button type="button" className="btn" onClick={onComplete}>Voltar</button>
      </div>
      <label>
        Senha Atual
        <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} required autoFocus />
      </label>
      <label>
        Nova Senha
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </label>
      <label>
        Confirmar Nova Senha
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </label>
      <button className="btn primary full" type="submit" disabled={busy} style={{ marginTop: '16px' }}>
        {busy ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  )
}
