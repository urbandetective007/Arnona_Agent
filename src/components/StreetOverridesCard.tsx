'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Business } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { setCache } from '@/lib/cache'
import { JERUSALEM_NEIGHBORHOODS } from '@/lib/neighborhoods'
import {
  loadBaseStreetTable, fetchStreetOverrides, applyOverrides, invalidateStreetTable,
  neighborhoodsForAddress, resolveKey, streetKey, streetKeyOfAddress,
  type StreetTable, type StreetOverride,
} from '@/lib/streetNeighborhoods'
import { Card, Button, Input, Select, toast, Badge } from '@/components/ui'

const SORTED_NEIGHBORHOODS = [...JERUSALEM_NEIGHBORHOODS].sort((a, b) => a.localeCompare(b, 'he'))

// Lets a city employee fix which neighborhood a street belongs to — once, for
// the street as a whole — instead of correcting property after property. The
// correction is used by manual entry, Excel uploads and the agent's upload
// workflow. Existing properties change only if the employee asks to.
export function StreetOverridesCard({ businesses, setBusinesses }: {
  businesses: Business[]
  setBusinesses: (b: Business[]) => void
}) {
  const [base, setBase] = useState<StreetTable | null>(null)
  const [overrides, setOverrides] = useState<StreetOverride[]>([])
  const [loadError, setLoadError] = useState('')
  const [street, setStreet] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [saving, setSaving] = useState(false)
  // Street just corrected, offered for updating the properties already on it.
  const [justSaved, setJustSaved] = useState<{ key: string; label: string; neighborhood: string } | null>(null)

  useEffect(() => {
    loadBaseStreetTable().then(setBase)
    fetchStreetOverrides().then(setOverrides).catch(() => setLoadError('טבלת התיקונים עדיין לא קיימת במסד הנתונים — יש להריץ את המיגרציה 20261111_links_and_street_overrides.sql'))
  }, [])

  const table = useMemo(() => (base ? applyOverrides(base, overrides) : null), [base, overrides])
  const streetNames = useMemo(() => (base ? [...new Set(Object.values(base.names))].sort((a, b) => a.localeCompare(b, 'he')) : []), [base])

  // What the typed street resolves to, and its current neighborhood(s).
  const current = useMemo(() => {
    const typed = street.trim()
    if (!table || typed.length < 2) return null
    const hit = resolveKey(table, streetKey(typed))
    const match = neighborhoodsForAddress(table, typed)
    return {
      key: hit && hit.match !== 'close' ? hit.key : streetKey(typed),
      label: match.street && hit?.match !== 'close' ? match.street : typed,
      options: hit?.match !== 'close' ? match.options : [],
      known: !!hit && hit.match !== 'close',
    }
  }, [street, table])

  const affected = useMemo(() => {
    if (!justSaved || !table) return []
    return businesses.filter(b => b.neighborhood !== justSaved.neighborhood && streetKeyOfAddress(table, b.address) === justSaved.key)
  }, [justSaved, table, businesses])

  async function save() {
    if (!current || !neighborhood) return
    setSaving(true)
    const row = { street_key: current.key, street_label: current.label, neighborhood, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('street_neighborhood_overrides').upsert(row)
    setSaving(false)
    if (error) { toast('השמירה נכשלה: ' + error.message, 'info'); return }
    invalidateStreetTable()
    setOverrides(list => [...list.filter(o => o.streetKey !== row.street_key), { streetKey: row.street_key, streetLabel: row.street_label, neighborhood, updatedAt: row.updated_at }]
      .sort((a, b) => a.streetLabel.localeCompare(b.streetLabel, 'he')))
    setJustSaved({ key: row.street_key, label: row.street_label, neighborhood })
    setStreet('')
    setNeighborhood('')
    toast(`הרחוב ${row.street_label} שויך לשכונת ${neighborhood}`)
  }

  async function remove(o: StreetOverride) {
    const { error } = await supabase.from('street_neighborhood_overrides').delete().eq('street_key', o.streetKey)
    if (error) { toast('המחיקה נכשלה: ' + error.message, 'info'); return }
    invalidateStreetTable()
    setOverrides(list => list.filter(x => x.streetKey !== o.streetKey))
    if (justSaved?.key === o.streetKey) setJustSaved(null)
  }

  async function updateExisting() {
    if (!justSaved || affected.length === 0) return
    setSaving(true)
    const ids = affected.map(b => b.id)
    const { error } = await supabase.from('businesses').update({ neighborhood: justSaved.neighborhood }).in('id', ids)
    setSaving(false)
    if (error) { toast('העדכון נכשל: ' + error.message, 'info'); return }
    const idSet = new Set(ids)
    const next = businesses.map(b => (idSet.has(b.id) ? { ...b, neighborhood: justSaved.neighborhood } : b))
    setBusinesses(next)
    setCache('businesses', next)
    toast(`עודכנו ${ids.length} נכסים`)
    setJustSaved(null)
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[14.5px] font-bold text-ink">שיוך רחובות לשכונות</span>
        <span className="text-[11.5px] text-subtle">תיקון כללי לרחוב — חל על כל הנכסים החדשים ברחוב</span>
      </div>
      <p className="text-[12.5px] text-charcoal mb-4">
        רחוב ששויך לשכונה הלא נכונה? בחרו את הרחוב ואת השכונה הנכונה. מעכשיו כל נכס חדש ברחוב (הוספה ידנית, קובץ אקסל או הסוכן) ישויך לשכונה הזו.
      </p>

      {loadError ? (
        <p className="text-[12.5px] text-high">{loadError}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-start">
            <div>
              <label className="block text-[12px] font-semibold text-charcoal mb-1">רחוב</label>
              <Input value={street} onChange={e => setStreet(e.target.value)} list="street-names" placeholder="למשל: אבולעפיה" className="w-full" autoComplete="off" />
              <datalist id="street-names">
                {streetNames.map(n => <option key={n} value={n} />)}
              </datalist>
              {current && (
                <p className="mt-1.5 text-[12px] text-charcoal">
                  {current.known
                    ? <>כיום: <strong className="font-semibold text-ink">{current.label}</strong> ← {current.options.join(' / ') || '—'}</>
                    : 'רחוב שלא מופיע ברשימה — יתווסף כרחוב חדש'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-charcoal mb-1">שכונה נכונה</label>
              <Select value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="w-full">
                <option value="">בחרו שכונה</option>
                {SORTED_NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
            </div>
            <Button onClick={save} disabled={!current || !neighborhood || saving} className="md:mt-[22px]">שמירה</Button>
          </div>

          {justSaved && affected.length > 0 && (
            <div className="mt-4 rounded-lg bg-brand/[0.06] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[12.5px] text-ink">
                ברחוב {justSaved.label} יש <strong className="num">{affected.length}</strong> נכסים קיימים עם שכונה אחרת. לעדכן גם אותם ל{justSaved.neighborhood}?
              </span>
              <div className="flex gap-2">
                <Button onClick={updateExisting} disabled={saving}>עדכון הנכסים הקיימים</Button>
                <Button variant="ghost" onClick={() => setJustSaved(null)}>לא עכשיו</Button>
              </div>
            </div>
          )}

          {overrides.length > 0 && (
            <div className="mt-5 pt-4 border-t border-hairline">
              <div className="text-[12.5px] font-semibold text-charcoal mb-2">תיקונים שהוגדרו ({overrides.length})</div>
              <div className="flex flex-wrap gap-2">
                {overrides.map(o => (
                  <span key={o.streetKey} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[12.5px] text-ink">
                    {o.streetLabel} <span className="text-subtle">←</span> <Badge tone="neutral">{o.neighborhood}</Badge>
                    <button type="button" onClick={() => remove(o)} aria-label={`מחיקת התיקון של ${o.streetLabel}`} className="text-subtle hover:text-high">
                      <Trash2 size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
