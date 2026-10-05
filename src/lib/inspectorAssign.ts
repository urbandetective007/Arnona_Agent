import { supabase } from './supabase'

// An `.in('id', ids)` filter puts every id in the request URL, which stops
// working once the list is a few hundred long — so large assignments are
// sent in chunks.
const CHUNK_SIZE = 100

/** Marks the businesses as sent to an inspector. Returns an error, or null on success. */
export async function markSentToInspector(ids: string[]): Promise<{ message: string } | null> {
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const { error } = await supabase
      .from('businesses')
      .update({ sent_to_inspector: 'נשלח לסוקר' })
      .in('id', ids.slice(i, i + CHUNK_SIZE))
    if (error) return error
  }
  return null
}
