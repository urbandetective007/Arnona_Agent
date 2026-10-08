'use client'

import { useEffect, useState } from 'react'

// Where the scanning agent is. The agent (the "Game" routine) walks the
// address list in Final_Project/Adresses.xlsx row by row — the list is sorted
// neighborhood by neighborhood — and after every run pushes the next row to
// scan to Final_Project/index ("index = N", 0-based over the data rows). Both
// files are public, so the site reads them straight from GitHub: there's no
// copy here to fall out of date.
//
// What this can't tell: when a given address was scanned. Status is derived
// from the pointer only, so it's as accurate as the index the agent pushes.

const REPO = 'urbandetective007/Final_Project'
const RAW = `https://raw.githubusercontent.com/${REPO}/main`
export const NO_NEIGHBORHOOD = 'ללא שכונה'
const CACHE_KEY = 'agent_progress_v2'
const CACHE_MS = 10 * 60 * 1000

export interface AgentBlock { name: string; start: number; count: number }

export interface AgentProgress {
  /** Next row the agent will scan (0-based); 0 after it wraps around. */
  index: number
  total: number
  nextAddress: string | null
  /** Runs of consecutive rows with the same neighborhood, in file order. */
  blocks: AgentBlock[]
}

export type NeighborhoodScan = {
  name: string
  count: number
  scanned: number
  status: 'done' | 'current' | 'pending'
  /** Position of the neighborhood's first row in the scan order. */
  order: number
}

/** Per-neighborhood scan state, in the order the agent goes through them. */
export function scanByNeighborhood(p: AgentProgress): NeighborhoodScan[] {
  const byName = new Map<string, NeighborhoodScan>()
  for (const b of p.blocks) {
    const scanned = Math.min(Math.max(p.index - b.start, 0), b.count)
    const row = byName.get(b.name) ?? { name: b.name, count: 0, scanned: 0, status: 'pending' as const, order: b.start }
    row.count += b.count
    row.scanned += scanned
    byName.set(b.name, row)
  }
  const current = p.blocks.find(b => p.index >= b.start && p.index < b.start + b.count)?.name
  return [...byName.values()]
    .map(r => ({ ...r, status: r.scanned >= r.count ? 'done' as const : r.name === current ? 'current' as const : 'pending' as const }))
    .sort((a, b) => a.order - b.order)
}

async function load(): Promise<AgentProgress> {
  const [indexText, xlsxBuf] = await Promise.all([
    fetch(`${RAW}/index`, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`index ${r.status}`); return r.text() }),
    fetch(`${RAW}/Adresses.xlsx`).then(r => { if (!r.ok) throw new Error(`Adresses.xlsx ${r.status}`); return r.arrayBuffer() }),
  ])
  const XLSX = await import('xlsx')
  const wb = XLSX.read(xlsxBuf, { type: 'array' })
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false })
  // Same rows the agent reads: skip the header, keep rows with an address.
  const data = rows.slice(1).filter(r => r[0] !== undefined && r[0] !== null && String(r[0]).trim())
  const blocks: AgentBlock[] = []
  data.forEach((r, i) => {
    const name = String(r[1] ?? '').trim() || NO_NEIGHBORHOOD
    const last = blocks[blocks.length - 1]
    if (last && last.name === name) last.count += 1
    else blocks.push({ name, start: i, count: 1 })
  })
  const m = indexText.match(/index\s*=\s*(\d+)/)
  let index = m ? Number(m[1]) : 0
  if (index >= data.length) index = 0   // the agent wraps the same way

  return { index, total: data.length, nextAddress: data[index] ? String(data[index][0]) : null, blocks }
}

export function useAgentProgress(): { progress: AgentProgress | null; error: boolean } {
  const [state, setState] = useState<{ progress: AgentProgress | null; error: boolean }>({ progress: null, error: false })
  useEffect(() => {
    let cancelled = false
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null') as { at: number; progress: AgentProgress } | null
      if (cached && Date.now() - cached.at < CACHE_MS) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time cache hydration on mount
        setState({ progress: cached.progress, error: false })
        return
      }
    } catch { /* no cache */ }
    load()
      .then(progress => {
        if (cancelled) return
        setState({ progress, error: false })
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), progress })) } catch { /* ignore */ }
      })
      .catch(() => { if (!cancelled) setState({ progress: null, error: true }) })
    return () => { cancelled = true }
  }, [])
  return state
}
