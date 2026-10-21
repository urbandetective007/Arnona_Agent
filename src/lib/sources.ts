import type { BadgeTone } from '@/components/ui'
import type { Business } from './types'

export type BusinessSource = Business['source']

// Where a business came from — one place for the labels and colors, so the
// table, filters, export, dashboard and neighborhoods chart always agree.
export const SOURCE_LABEL: Record<BusinessSource, string> = {
  excel: 'סוכן ארנונה',
  manual: 'הוזן ידנית',
  promotion: 'קידום עסקים',
}

export const SOURCE_OPTIONS: BusinessSource[] = ['excel', 'manual', 'promotion']

export const SOURCE_TONE: Record<BusinessSource, BadgeTone> = {
  excel: 'neutral',
  manual: 'mid',
  promotion: 'brand',
}

export const SOURCE_COLOR: Record<BusinessSource, string> = {
  excel: '#024ad8',
  manual: '#f59e0b',
  promotion: '#0f9d8a',
}

// Rows written before a source existed (or by the agent's upload script) have
// no value or 'excel' — both mean the agent.
export function parseSource(raw: unknown): BusinessSource {
  return raw === 'manual' || raw === 'promotion' ? raw : 'excel'
}
