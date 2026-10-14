import type { SurveyReport, SurveyReportFile } from './types'
import { insertReport, uploadReportFile, saveReportFiles, type ReportDraft } from './surveyReports'

// Field reports filled in without signal wait here (IndexedDB, on the phone)
// and are sent when the connection is back. Files are stored as-is (Blob),
// so photos survive the app being closed. A report that was half-sent keeps
// its server id, so a retry only finishes the missing files — never a
// duplicate report.

const DB = 'arnona-offline'
const STORE = 'reports'

export interface QueuedFile { localId: string; file: Blob; name: string; type: string; group: SurveyReportFile['group'] }
export interface QueuedReport {
  id: string
  businessId: string
  businessName: string
  draft: ReportDraft
  files: QueuedFile[]
  queuedAt: number
  /** Set once the report row exists on the server. */
  serverReport?: SurveyReport
  /** Files already uploaded, by localId. */
  uploaded?: Record<string, SurveyReportFile>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(req.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

export async function listQueued(): Promise<QueuedReport[]> {
  try { return await tx('readonly', s => s.getAll() as IDBRequest<QueuedReport[]>) } catch { return [] }
}

export async function enqueueReport(item: Omit<QueuedReport, 'id' | 'queuedAt'>): Promise<void> {
  const record: QueuedReport = { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, queuedAt: Date.now() }
  await tx('readwrite', s => s.put(record))
  notify()
}

/** True when an error means "no connection" rather than "the server refused". */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(msg)
}

let flushing: Promise<number> | null = null

/** Sends every queued report. Returns how many were sent. Safe to call repeatedly. */
export function flushQueue(): Promise<number> {
  if (flushing) return flushing
  flushing = (async () => {
    let sent = 0
    for (const item of await listQueued()) {
      try {
        const report = item.serverReport ?? await insertReport(item.draft)
        item.serverReport = report
        item.uploaded = item.uploaded ?? {}
        await tx('readwrite', s => s.put(item))
        let i = 0
        for (const f of item.files) {
          i += 1
          if (item.uploaded[f.localId]) continue
          const file = new File([f.file], f.name, { type: f.type })
          item.uploaded[f.localId] = await uploadReportFile(report, file, i, f.group)
          await tx('readwrite', s => s.put(item))
        }
        const records = item.files.map(f => item.uploaded![f.localId]).filter(Boolean)
        if (records.length) await saveReportFiles(report.id, records)
        await tx('readwrite', s => s.delete(item.id))
        sent += 1
      } catch (e) {
        if (isNetworkError(e)) break // still offline — try again later
        // A server refusal: leave it queued and move on; it shows as pending.
      }
    }
    notify()
    return sent
  })().finally(() => { flushing = null })
  return flushing
}

// Lets the page refresh its "waiting to send" banner when the queue changes.
const listeners = new Set<() => void>()
export function onQueueChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
function notify() { listeners.forEach(fn => fn()) }
