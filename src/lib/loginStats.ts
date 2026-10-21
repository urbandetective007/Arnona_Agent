import type { Business } from './types'

const KEY = 'arnonet-login-stats'

/** Totals shown on the login screen's status line. */
export interface LoginStats { total: number; high: number }

// The login screen runs before sign-in, when the database can't be read
// (every table is closed to anonymous visitors), so it shows the totals
// this device saw on its last signed-in visit. Nothing is shown on a device
// that hasn't signed in yet.
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
