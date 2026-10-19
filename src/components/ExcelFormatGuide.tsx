'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Download, FileQuestion } from 'lucide-react'
import { FIELD_DEFS, FORMAT_RULES, downloadTemplate } from '@/lib/uploadFormat'
import { JERUSALEM_NEIGHBORHOODS } from '@/lib/neighborhoods'
import { Badge, Button, Input } from '@/components/ui'

// How an uploaded report must look, shown above the upload drop zone — so an
// employee preparing her own file knows the columns and rules before
// uploading, and can download a ready template.

const SORTED_NEIGHBORHOODS = [...JERUSALEM_NEIGHBORHOODS].sort((a, b) => a.localeCompare(b, 'he'))
const PREVIEW_FIELDS = FIELD_DEFS.filter(fd => ['name', 'address', 'neighborhood', 'type', 'suspicionRating', 'link1'].includes(fd.key))

export const FORMAT_GUIDE_ID = 'excel-format-guide'

function NeighborhoodList() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => SORTED_NEIGHBORHOODS.filter(n => n.includes(query.trim())), [query])
  return (
    <div className="mt-4">
      <button type="button" onClick={() => setOpen(o => !o)} className="text-[12.5px] font-semibold text-brand hover:text-brand-deep inline-flex items-center gap-1">
        <ChevronDown size={14} strokeWidth={2.2} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'הסתרת רשימת השכונות' : <>הצגת רשימת השכונות המותרות (<span className="num">{SORTED_NEIGHBORHOODS.length}</span>)</>}
      </button>
      {open && (
        <div className="mt-2">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="חיפוש שכונה" className="w-full sm:w-64" />
          <div className="mt-2 max-h-48 overflow-auto flex flex-wrap gap-1.5">
            {shown.map(n => <span key={n} className="px-2 py-0.5 rounded-md bg-canvas border border-hairline text-[12px] text-charcoal">{n}</span>)}
            {shown.length === 0 && <span className="text-[12px] text-subtle">לא נמצאה שכונה בשם הזה</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function ExcelFormatGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [downloading, setDownloading] = useState(false)

  async function onDownload() {
    setDownloading(true)
    try { await downloadTemplate() } finally { setDownloading(false) }
  }

  return (
    <div id={FORMAT_GUIDE_ID} className="rounded-xl bg-brand/[0.05] border border-brand/20 mb-4 scroll-mt-4">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => onOpenChange(!open)} aria-expanded={open} className="flex-1 flex items-center gap-2.5 text-start min-w-0">
          <FileQuestion size={18} className="text-brand shrink-0" strokeWidth={1.9} />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold text-ink">איך להכין את קובץ האקסל?</span>
            {!open && <span className="block text-[12px] text-graphite mt-0.5">העמודות הנדרשות, הכללים החשובים ותבנית מוכנה להורדה</span>}
          </span>
          <ChevronDown size={17} strokeWidth={2.2} className={`text-graphite shrink-0 ms-auto transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-brand/15 pt-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-3.5">
            <p className="text-[12.5px] text-charcoal">הכי פשוט: הורידו את התבנית, מלאו שורה לכל עסק בגיליון הראשון, והעלו אותה.</p>
            <Button onClick={onDownload} disabled={downloading} icon={<Download size={15} strokeWidth={2} />} className="shrink-0">
              {downloading ? 'מכין…' : 'הורדת קובץ תבנית'}
            </Button>
          </div>

          <p className="text-[13px] font-bold text-ink mb-1.5">כללים חשובים</p>
          <ul className="flex flex-col gap-1 text-[12.5px] text-charcoal list-disc ps-5">
            {FORMAT_RULES.map(r => <li key={r}>{r}</li>)}
          </ul>

          <p className="text-[13px] font-bold text-ink mt-4 mb-1.5">כך נראית תחילת הגיליון</p>
          <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full border-collapse text-[12px] whitespace-nowrap">
              <thead>
                <tr className="bg-canvas">
                  {PREVIEW_FIELDS.map(fd => (
                    <th key={fd.key} className="text-start px-3 py-2 font-bold text-ink border-b border-hairline">
                      {fd.label}{fd.required && <span className="text-high"> *</span>}
                    </th>
                  ))}
                  <th className="text-start px-3 py-2 font-normal text-subtle border-b border-hairline">…</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {PREVIEW_FIELDS.map(fd => <td key={fd.key} className="px-3 py-2 text-charcoal">{fd.example}</td>)}
                  <td className="px-3 py-2 text-subtle">…</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[13px] font-bold text-ink mt-4 mb-1.5">כל העמודות</p>
          <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-canvas border-b border-hairline">
                  <th className="text-start px-3 py-2 font-semibold text-graphite">כותרת העמודה</th>
                  <th className="text-start px-3 py-2 font-semibold text-graphite">חובה?</th>
                  <th className="text-start px-3 py-2 font-semibold text-graphite">מה למלא</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {FIELD_DEFS.map(fd => (
                  <tr key={fd.key}>
                    <td className="px-3 py-2 font-semibold text-ink whitespace-nowrap">{fd.label}</td>
                    <td className="px-3 py-2">{fd.required ? <Badge tone="high">חובה</Badge> : <span className="text-subtle">רשות</span>}</td>
                    <td className="px-3 py-2 text-charcoal">{fd.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-subtle mt-2">סדר העמודות לא משנה, ואפשר להשמיט עמודות רשות. כותרת שנכתבה אחרת אפשר לשייך ידנית בשלב &quot;מיפוי עמודות&quot;.</p>

          <NeighborhoodList />
        </div>
      )}
    </div>
  )
}
