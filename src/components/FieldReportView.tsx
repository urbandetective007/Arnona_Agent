'use client'

import { useEffect, useState } from 'react'
import { ClipboardCheck, FileText, MapPin } from 'lucide-react'
import type { SurveyReport } from '@/lib/types'
import { formatDate } from '@/lib/dateUtils'
import { signedFileUrls } from '@/lib/surveyReports'

function formatMeters(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} ק״מ` : `${m} מ׳`
}

// The surveyor's latest field report for a property, as the office sees it
// in the expanded row: every answer, the files (private bucket → short-lived
// signed links) and where the surveyor was when reporting.
export function FieldReportView({ reports }: { reports: SurveyReport[] }) {
  const report = reports[0]
  const [urls, setUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    signedFileUrls(report.files.map(f => f.path)).then(u => { if (alive) setUrls(u) })
    return () => { alive = false }
  }, [report])

  const answers: [string, string][] = ([
    ['תאריך סקר', report.surveyDate ? formatDate(`${report.surveyDate}T00:00`) : ''],
    ['שם הסוקר/חוקר', report.surveyorName],
    ['ביקרתי בנכס ב', report.visitedAddress],
    ['מספר נכס בארנונה', report.arnonaPropertyNumber],
    ['שוחחתי עם', report.spokeWith],
    ['הנכס משמש בפועל כ', report.actualUse],
    ['תוצאת הסקר (לפי הסוקר)', report.surveyResult ?? ''],
    ['השימוש בנכס כפי שזוהה', report.useDescription],
    ['מידע על הבעלים והמחזיק', report.ownerInfo],
    ['מידע נוסף', report.extraInfo],
  ] as [string, string][]).filter(([, v]) => v)
  const long = new Set(['השימוש בנכס כפי שזוהה', 'מידע על הבעלים והמחזיק', 'מידע נוסף'])

  return (
    <div className="col-span-2 mt-1 p-4 rounded-xl bg-surface border border-clear/25">
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <ClipboardCheck size={16} className="text-clear" strokeWidth={2} />
        <span className="text-[14px] font-bold text-ink">דיווח מהשטח</span>
        <span className="text-[12px] text-subtle">
          נשלח {new Date(report.createdAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {reports.length > 1 && ` · ${reports.length} דיווחים, מוצג האחרון`}
        </span>
        {report.lat !== null && report.lon !== null && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${report.lat},${report.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:text-brand-deep"
          >
            <MapPin size={13} strokeWidth={2} />
            {report.distanceM !== null ? `דווח במרחק ${formatMeters(report.distanceM)} מהכתובת` : 'מיקום הדיווח'}
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[13px]">
        {answers.map(([label, value]) => (
          <div key={label} className={long.has(label) ? 'col-span-2' : ''}>
            <span className="font-semibold text-charcoal">{label}: </span>
            <span className="text-ink whitespace-pre-line">{value}</span>
          </div>
        ))}
      </div>
      {report.files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {report.files.map(f => {
            const url = urls[f.path]
            const isImage = f.type.startsWith('image/')
            return (
              <a
                key={f.path}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={f.name}
                className={`w-20 h-20 rounded-lg overflow-hidden border border-hairline bg-canvas flex items-center justify-center ${url ? '' : 'pointer-events-none opacity-60'}`}
              >
                {isImage && url
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                  ? <img src={url} alt={f.name} className="w-full h-full object-cover" />
                  : <span className="flex flex-col items-center gap-1 p-1 text-subtle"><FileText size={18} /><span className="text-[9.5px] leading-tight text-center break-all line-clamp-2">{f.name}</span></span>}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
