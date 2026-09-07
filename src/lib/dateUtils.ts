export function formatDate(value: string): string {
  if (!value) return ''
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})T/)
  if (iso) {
    const [, y, m, d] = iso
    return `${parseInt(d)}.${parseInt(m)}.${y}`
  }
  return value
}

// Hebrew relative time ("לפני 22 דקות") for activity feeds. Falls back to
// a plain date once the gap is more than a week, since "לפני 9 ימים" stops
// being useful information at that point.
export function timeAgo(value: string): string {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return value
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))

  if (seconds < 60) return 'לפני רגע'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `לפני ${minutes} דקות`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `לפני ${hours} שעות`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'אתמול'
  if (days < 7) return `לפני ${days} ימים`
  return formatDate(value)
}
