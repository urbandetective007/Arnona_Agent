import type { Business } from './types'
import { supabase } from './supabase'

const KEY = 'arnonet-login-stats'

/** Totals shown on the login screen's status line. */
export interface LoginStats { total: number; high: number }

// The login screen runs before sign-in, when every table is closed to
// anonymous visitors. Live totals come from the login_stats() database
// function, which returns just these two counts
// (supabase/migrations/20261021_login_stats.sql). The totals this device saw
// last are kept too, so the line shows at once and survives a failed request.
export async function fetchLoginStats(): Promise<LoginStats | null> {
  const { data, error } = await supabase.rpc('login_stats')
  const row = Array.isArray(data) ? data[0] : null
  if (error || !row) return null
  const stats = { total: Number(row.total), high: Number(row.high) }
  if (stats.total > 0) {
    try { localStorage.setItem(KEY, JSON.stringify(stats)) } catch { /* storage unavailable */ }
  }
  return stats.total > 0 ? stats : null
}

export function saveLoginStats(businesses: Business[]): void {
  const stats: LoginStats = {
    total: businesses.length,
    high: businesses.filter(b => b.suspicionRating === 'גבוה').length,
  }
  try { localStorage.setItem(KEY, JSON.stringify(stats)) } catch { /* storage unavailable */ }
}

export function readLoginStats(): LoginStats | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<LoginStats>
    return typeof s.total === 'number' && typeof s.high === 'number' && s.total > 0 ? { total: s.total, high: s.high } : null
  } catch { return null }
}
