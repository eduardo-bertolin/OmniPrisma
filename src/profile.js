import { supabase } from './supabaseClient'

// Garante que o usuário logado tenha um perfil (papel admin ou não).
export async function ensureProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (data) return data

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, email: user.email })
    .select()
    .single()

  if (insertError) {
    // Outra aba pode ter criado o perfil antes.
    const { data: again } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (again) return again
    throw insertError
  }

  return created
}
