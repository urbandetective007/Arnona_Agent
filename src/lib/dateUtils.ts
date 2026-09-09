// `uploadDate` is normally a full ISO datetime, but some existing records
// were written as a `D.M.YYYY` string (`toLocaleDateString('he-IL')`) —
// ambiguous under the native Date constructor: "8.9.2026" silently parses
// as August 9th, and any day above 12 fails to parse at all. This reads
// either format correctly instead of silently mis-parsing or dropping it.
export function parseUploadDate(value: string): Date | null {
  if (!value) return null
  const dmy = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dmy) {
    const [, day, month, year] = dmy
    const d = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

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
