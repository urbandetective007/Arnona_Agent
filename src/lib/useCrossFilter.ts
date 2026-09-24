'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'

// Power-BI-style cross-filtering for a single page.
//
// A page declares its "dimensions" — one accessor per clickable chart that
// maps an item to the category (or categories) it belongs to in that chart.
// Clicking a category selects it; every other chart and KPI on the page is
// then computed from `filtered`, while the clicked chart itself is computed
// from `filteredExcept(itsDim)` so it keeps showing all of its categories
// (the selected one highlighted, the rest dimmed) instead of collapsing.
//
// Adding cross-filtering to a new chart: add an accessor for it to the
// page's dimensions, compute the chart from `filteredExcept(dim)`, and
// spread `chartItemProps(cf, dim, value)` onto each bar / slice / legend row.
//
// Selections in different dimensions combine with AND; several values in
// the same dimension (Ctrl/Cmd+click) combine with OR. State is page-local.

export type Accessor<T> = (item: T) => string | string[] | null

export type Selection<D extends string> = Partial<Record<D, string[]>>

export interface CrossFilter<T, D extends string> {
  selection: Selection<D>
  toggle: (dim: D, value: string, additive?: boolean) => void
  clear: (dim?: D) => void
  hasSelection: (dim?: D) => boolean
  isSelected: (dim: D, value: string) => boolean
  filtered: T[]
  filteredExcept: (dim: D) => T[]
}

function matches<T>(item: T, accessor: Accessor<T>, values: string[]): boolean {
  const v = accessor(item)
  if (v === null) return false
  return Array.isArray(v) ? v.some(x => values.includes(x)) : values.includes(v)
}

export function useCrossFilter<T, D extends string>(
  items: T[],
  dimensions: Record<D, Accessor<T>>,
): CrossFilter<T, D> {
  const [selection, setSelection] = useState<Selection<D>>({})

  const toggle = useCallback((dim: D, value: string, additive = false) => {
    setSelection(prev => {
      const current = prev[dim] ?? []
      let nextValues: string[]
      if (additive) {
        nextValues = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      } else {
        nextValues = current.length === 1 && current[0] === value ? [] : [value]
      }
      const next = { ...prev }
      if (nextValues.length) next[dim] = nextValues
      else delete next[dim]
      return next
    })
  }, [])

  const clear = useCallback((dim?: D) => {
    if (dim === undefined) { setSelection({}); return }
    setSelection(prev => {
      if (!(dim in prev)) return prev
      const next = { ...prev }
      delete next[dim]
      return next
    })
  }, [])

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setSelection(prev => (Object.keys(prev).length ? {} : prev))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeDims = useMemo(
    () => (Object.keys(selection) as D[]).filter(d => (selection[d]?.length ?? 0) > 0),
    [selection],
  )

  const { filtered, exceptByDim } = useMemo(() => {
    const apply = (skip: D | null) => {
      const dims = activeDims.filter(d => d !== skip)
      if (dims.length === 0) return items
      return items.filter(item => dims.every(d => matches(item, dimensions[d], selection[d]!)))
    }
    const except = new Map<D, T[]>()
    activeDims.forEach(d => except.set(d, apply(d)))
    return { filtered: apply(null), exceptByDim: except }
    // `dimensions` is typically an inline object literal — its accessors are
    // pure functions of the item, so re-running on its identity is wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selection, activeDims])

  const filteredExcept = useCallback(
    (dim: D) => exceptByDim.get(dim) ?? filtered,
    [exceptByDim, filtered],
  )

  const hasSelection = useCallback(
    (dim?: D) => (dim === undefined ? activeDims.length > 0 : activeDims.includes(dim)),
    [activeDims],
  )

  const isSelected = useCallback(
    (dim: D, value: string) => selection[dim]?.includes(value) ?? false,
    [selection],
  )

  return { selection, toggle, clear, hasSelection, isSelected, filtered, filteredExcept }
}

// Shared click / keyboard / highlight behavior for one clickable chart item
// (bar, donut slice, legend row, funnel card). Works on HTML and SVG elements.
export function chartItemProps<T, D extends string>(
  cf: CrossFilter<T, D>,
  dim: D,
  value: string,
  label?: string,
) {
  const selected = cf.isSelected(dim, value)
  const dimmed = cf.hasSelection(dim) && !selected
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-pressed': selected,
    'aria-label': label,
    title: 'לחיצה לסינון הדף · Ctrl+לחיצה לבחירה מרובה',
    'data-selected': selected || undefined,
    onClick: (e: MouseEvent) => cf.toggle(dim, value, e.ctrlKey || e.metaKey),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        cf.toggle(dim, value, e.ctrlKey || e.metaKey)
      }
    },
    className: [
      'cursor-pointer transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-brand-light/60',
      dimmed ? 'opacity-35 hover:opacity-70' : 'hover:opacity-85',
    ].join(' '),
  }
}
