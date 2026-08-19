export function formatDate(value: string): string {
  if (!value) return ''
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})T/)
  if (iso) {
    const [, y, m, d] = iso
    return `${parseInt(d)}.${parseInt(m)}.${y}`
  }
  return value
}
