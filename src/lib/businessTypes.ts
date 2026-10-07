'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// The closed list of business types lives in Supabase (business_types). It
// is closed in that every business.type is on it — and it grows by itself:
// a database trigger on businesses rewrites known variants to their list
// entry and adds any new type to the list, whether an employee typed it or
// the agent's report brought it (see supabase/migrations/20261007_business_types.sql).

export type BusinessTypeSource = 'initial' | 'employee' | 'agent'

export interface BusinessType {
  name: string
  source: BusinessTypeSource
  createdAt: string
}

export const BUSINESS_TYPE_SOURCE_LABEL: Record<BusinessTypeSource, string> = {
  initial: 'רשימה מקורית',
  employee: 'נוסף ע״י עובד',
  agent: 'נוסף ע״י הסוכן',
}

// How long a type added after the initial list counts as "new" in the UI.
export const NEW_TYPE_DAYS = 30

export function isNewType(t: BusinessType, now: number): boolean {
  if (t.source === 'initial') return false
  const added = new Date(t.createdAt).getTime()
  return !Number.isNaN(added) && now - added <= NEW_TYPE_DAYS * 86400000
}

export function useBusinessTypes(): { types: BusinessType[]; loading: boolean } {
  const [types, setTypes] = useState<BusinessType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('business_types')
      .select('name, source, created_at')
      .then(({ data }) => {
        if (cancelled) return
        if (data) {
          setTypes(
            data
              .map(r => ({ name: r.name as string, source: r.source as BusinessTypeSource, createdAt: r.created_at as string }))
              .sort((a, b) => a.name.localeCompare(b.name, 'he'))
          )
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { types, loading }
}
