'use client'

import { useMemo, useState } from 'react'
import { Input, Select } from '@/components/ui'
import type { BusinessType } from '@/lib/businessTypes'

const NEW_OPTION = '__new__'

// Business type picker over the closed list, with a way to add a type that
// isn't on it yet. A new type is saved as typed; the database adds it to the
// list. While typing, existing types with a similar name are offered so the
// list doesn't fill up with near-duplicates ("מרפאת עיניים" / "מרפאת עינים").
export function BusinessTypeField({ value, onChange, types }: {
  value: string
  onChange: (v: string) => void
  types: BusinessType[]
}) {
  const names = useMemo(() => types.map(t => t.name), [types])
  const onList = !value || names.includes(value)
  const [adding, setAdding] = useState(false)
  const showInput = adding || !onList

  const similar = useMemo(() => {
    const q = value.trim()
    if (!showInput || q.length < 2) return []
    const words = q.split(/[\s/,\-–]+/).filter(w => w.length >= 3)
    return names.filter(n => n !== q && (n.includes(q) || q.includes(n) || words.some(w => n.includes(w.slice(0, -1))))).slice(0, 4)
  }, [value, names, showInput])

  if (showInput) {
    return (
      <div>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="סוג עסק חדש"
            className="w-full"
            autoFocus={adding}
          />
          <button
            type="button"
            onClick={() => { setAdding(false); onChange('') }}
            className="shrink-0 px-3 text-[12.5px] font-semibold text-brand hover:text-brand-deep"
          >
            חזרה לרשימה
          </button>
        </div>
        {similar.length > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[12px] text-charcoal">
            <span>אולי התכוונת ל:</span>
            {similar.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => { setAdding(false); onChange(n) }}
                className="px-2 py-0.5 rounded-md bg-brand/[0.08] text-brand font-semibold hover:bg-brand/[0.14]"
              >
                {n}
              </button>
            ))}
          </div>
        ) : value.trim() && (
          <p className="mt-1.5 text-[12px] text-subtle">הסוג יתווסף לרשימה הסגורה עם השמירה.</p>
        )}
      </div>
    )
  }

  return (
    <Select
      value={value}
      onChange={e => {
        if (e.target.value === NEW_OPTION) { setAdding(true); onChange('') }
        else onChange(e.target.value)
      }}
      className="w-full"
    >
      <option value="">בחרו סוג עסק</option>
      {names.map(n => <option key={n} value={n}>{n}</option>)}
      <option value={NEW_OPTION}>+ סוג עסק חדש…</option>
    </Select>
  )
}
