import { normalizeAddress } from './addressUtils'

// A business link may carry the address its page shows, in parentheses after
// the URL — "https://www.d.co.il/80218901/41760/ (מאה שערים 5, ירושלים)" —
// so the employee can compare it with the municipal address without opening
// the link. The agent writes them this way; older links are a bare URL.

export interface SplitLink {
  /** The URL alone (empty if the text has none). */
  url: string
  /** The address in parentheses after the URL, or '' if there is none. */
  siteAddress: string
}

export function splitLink(raw: string | null | undefined): SplitLink {
  const text = (raw ?? '').trim()
  const m = text.match(/https?:\/\/\S+/i)
  if (!m) return { url: '', siteAddress: '' }
  const rest = text.slice((m.index ?? 0) + m[0].length).trim()
  const paren = rest.match(/^\(([\s\S]*)\)$/)
  return { url: m[0], siteAddress: (paren ? paren[1] : rest).trim() }
}

/** Street words (any order) and house number, or null if there is no number. */
function streetAndNumber(address: string): { words: string[]; number: string } | null {
  const cleaned = normalizeAddress(address.split(',')[0])
    .replace(/["'״׳`]/g, '')
    .replace(/[-–־]/g, ' ')
    .replace(/\s+(דירה|דיר|דר|יח|יחידה|קומה)\s+\d+.*$/, '')
  const m = cleaned.match(/^(.*?)\s*(\d+)/)
  if (!m || !m[1].trim()) return null
  const words = m[1].split(/\s+/).filter(w => w && w !== 'רח' && w !== 'רחוב' && w !== 'ירושלים')
  return { words: words.sort(), number: m[2] }
}

/**
 * True when the address on the link's page is clearly not the business's
 * municipal address: a different house number, or a street that isn't the
 * same words (in any order — "האוזנר גדעון" is "גדעון האוזנר"). E.g.
 * "מאה שערים 5" on the page vs. "ב אונגר מאה שערים 5" in the municipal list.
 * An address that can't be read is not called a mismatch.
 */
export function siteAddressMismatch(siteAddress: string, businessAddress: string): boolean {
  const site = streetAndNumber(siteAddress)
  const own = streetAndNumber(businessAddress)
  if (!site || !own) return false
  return site.number !== own.number || site.words.join(' ') !== own.words.join(' ')
}
