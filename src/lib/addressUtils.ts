const PREFIXES = ['רחוב ', 'רח\' ', 'שדרות ', 'שד\' ', 'שד ', 'סמטת ', 'כיכר ', 'גן ', 'מעלה ', 'מורד ']

export function normalizeAddress(address: string): string {
  let normalized = address.trim()
  for (const prefix of PREFIXES) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.slice(prefix.length)
      break
    }
  }
  return normalized.replace(/\s+/g, ' ').trim()
}

export function lookupAddress(
  address: string,
  lookup: Record<string, boolean>
): 'suspicious' | 'ok' | 'unknown' {
  const normalized = normalizeAddress(address)

  // Direct match
  if (normalized in lookup) {
    return lookup[normalized] ? 'suspicious' : 'ok'
  }

  // Try without apartment number (e.g. "הלל 5 דירה 3" → "הלל 5")
  const withoutApt = normalized.replace(/\s+(דירה|דיר|דר|יח'|יחידה|קומה)\s+\d+.*/i, '').trim()
  if (withoutApt in lookup) {
    return lookup[withoutApt] ? 'suspicious' : 'ok'
  }

  return 'unknown'
}
