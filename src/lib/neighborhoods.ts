import registry from '../../data/jerusalem_neighborhoods.json'

const CANONICAL = new Set<string>(registry.neighborhoods)
const ALIASES: Record<string, string> = registry.aliases
const CLEAR_VALUES = new Set<string>(registry.clearValues)

export const JERUSALEM_NEIGHBORHOODS: string[] = registry.neighborhoods

export function normalizeNeighborhood(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (CLEAR_VALUES.has(trimmed)) return null
  if (CANONICAL.has(trimmed)) return trimmed
  if (ALIASES[trimmed]) return ALIASES[trimmed]
  return null
}
