import registry from '../../data/business_types.json'

// Closed list of business types. Manual entry and editing offer only these;
// uploaded reports are normalized through `aliases` so the agent's free-text
// variants ("עורכי דין", "משרד עורכי דין ✅") land on one entry.
export const BUSINESS_TYPES: string[] = registry.types

const CANONICAL = new Set<string>(registry.types)
const ALIASES: Record<string, string> = registry.aliases

// Returns the closed-list entry for a raw value, or the trimmed value itself
// when it matches nothing — an unknown type from a report is kept as written
// rather than dropped.
export function normalizeBusinessType(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed || CANONICAL.has(trimmed)) return trimmed
  return ALIASES[trimmed] ?? ALIASES[trimmed.replace(/\s*✅\s*/g, '').trim()] ?? trimmed
}
