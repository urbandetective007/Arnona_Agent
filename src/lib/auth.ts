import { supabase } from './supabase'

export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return data.session !== null
}

export async function login(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? error.message : null
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}
