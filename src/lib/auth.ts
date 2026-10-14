import { supabase } from './supabase'

export async function login(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? error.message : null
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  // The offline copy of the data (service worker cache) stays on the device
  // otherwise — clear it so the next person on this phone starts clean.
  try {
    if (typeof caches !== 'undefined') await Promise.all((await caches.keys()).map(k => caches.delete(k)))
  } catch { /* ignore */ }
}
