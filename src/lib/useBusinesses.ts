'use client'

import { useEffect, useState } from 'react'
import type { Business, UploadSession } from './types'
import { dbToBusiness, dbToSession } from './supabase'
import { getCache, setCache } from './cache'
import { fetchAllRows } from './fetchAll'

/** `total` is null when the table's row count couldn't be read. */
export interface LoadingMore { loaded: number; total: number | null }

// Loads every business (and optionally every upload session) for a page.
// Supabase caps one request at 1,000 rows, so the data arrives in pages:
//  - first visit: the first page is shown at once and the rest is appended as
//    it arrives (`loadingMore` says how far along it is, so partial totals
//    aren't mistaken for final ones);
//  - later visits: the cached full list is shown at once and swapped for the
//    fresh full list only when every page has arrived — no flicker from a
//    partial list replacing a complete one.
// Reading sessionStorage in a lazy useState initializer would give the server
// (build-time prerender) and the client's first paint different values, so the
// cache is read inside an effect (client-only).
export function useBusinesses({ sessions: withSessions = false }: { sessions?: boolean } = {}) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [sessions, setSessions] = useState<UploadSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState<LoadingMore | null>(null)

  useEffect(() => {
    let cancelled = false
    const cachedB = getCache<Business[]>('businesses')
    const cachedS = getCache<UploadSession[]>('sessions')
    const haveCache = !!cachedB && (!withSessions || !!cachedS)
    if (haveCache) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount, not a cascading update
      setBusinesses(cachedB)
      if (withSessions) setSessions(cachedS!)
      setLoading(false)
    }

    ;(async () => {
      try {
        const sessionRows = withSessions ? fetchAllRows('upload_sessions') : null
        const rows = await fetchAllRows('businesses', {
          onPage: (soFar, total, hasMore) => {
            if (cancelled || haveCache) return
            setBusinesses(soFar.map(dbToBusiness))
            setLoading(false)
            setLoadingMore(hasMore ? { loaded: soFar.length, total } : null)
          },
        })
        if (cancelled) return
        const b = rows.map(dbToBusiness)
        setBusinesses(b)
        setCache('businesses', b)
        setLoadingMore(null)
        if (sessionRows) {
          const s = (await sessionRows).map(dbToSession)
          if (cancelled) return
          setSessions(s)
          setCache('sessions', s)
        }
      } catch (e) {
        console.error('Error loading data:', e)
      } finally {
        if (!cancelled) { setLoading(false); setLoadingMore(null) }
      }
    })()

    return () => { cancelled = true }
  }, [withSessions])

  return { businesses, setBusinesses, sessions, setSessions, loading, loadingMore }
}
