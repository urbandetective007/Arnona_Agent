import type { ParsedSheet } from './parseSheet'
import type { ParseResponse } from './parseWorker'

// Parses an uploaded Excel file off the main thread, so the page stays
// responsive however big the file is. Falls back to parsing on the page when
// the browser can't start the worker.
//
// The worker is bundled separately into public/workers/ by
// `npm run build:worker` (runs before dev and build): the app's bundler
// doesn't bundle `new Worker(new URL(...))` here, it only copies the source.
const WORKER_URL = '/Arnona_Agent/workers/parse-excel.js'

/**
 * A file that hasn't been read by then is given up on. Reading the bytes can
 * hang (a OneDrive file that isn't on the computer yet, a file Excel holds
 * open), and so can a worker that never answers — without a limit the file
 * would sit on "reading" forever and block the whole upload.
 */
export const PARSE_TIMEOUT_MS = 60_000

export const PARSE_TIMEOUT_MESSAGE =
  'קריאת הקובץ נתקעה — סגרו אותו באקסל/OneDrive (או הורידו אותו למחשב) ונסו שוב'

export class ParseCancelled extends Error {
  constructor() { super('הקריאה בוטלה') }
}

function parseOnPage(buffer: ArrayBuffer): Promise<ParsedSheet> {
  return import('./parseSheet').then(m => m.parseSheet(buffer))
}

function parse(file: File, signal: AbortSignal, onWorker: (w: Worker) => void): Promise<ParsedSheet> {
  return file.arrayBuffer().then(buffer => {
    if (signal.aborted) throw new ParseCancelled()
    if (typeof Worker === 'undefined') return parseOnPage(buffer)

    let worker: Worker
    try {
      worker = new Worker(WORKER_URL)
    } catch {
      return parseOnPage(buffer)
    }
    onWorker(worker)

    return new Promise<ParsedSheet>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<ParseResponse>) => {
        worker.terminate()
        if (e.data.ok) resolve(e.data.sheet)
        else reject(new Error(e.data.message))
      }
      worker.onmessageerror = () => {
        worker.terminate()
        reject(new Error('שגיאה בקריאת הקובץ'))
      }
      // The worker itself failed to load or crashed (not a bad file) — parse on
      // the page. The buffer is copied to the worker (not transferred) so it is
      // still here for this.
      worker.onerror = e => {
        e.preventDefault()
        worker.terminate()
        console.warn('Excel worker failed, parsing on the page instead', e.message)
        parseOnPage(buffer).then(resolve, reject)
      }
      worker.postMessage(buffer)
    })
  })
}

/**
 * Reads the file's first sheet. Rejects with PARSE_TIMEOUT_MESSAGE after
 * PARSE_TIMEOUT_MS, and with ParseCancelled as soon as `signal` aborts (the
 * employee removed the file) — either way the worker is stopped.
 */
export function parseExcelFile(file: File, signal: AbortSignal = new AbortController().signal): Promise<ParsedSheet> {
  let worker: Worker | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined

  const stop = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(PARSE_TIMEOUT_MESSAGE)), PARSE_TIMEOUT_MS)
    onAbort = () => reject(new ParseCancelled())
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })

  return Promise.race([parse(file, signal, w => { worker = w }), stop]).finally(() => {
    clearTimeout(timer)
    if (onAbort) signal.removeEventListener('abort', onAbort)
    ;(worker as Worker | null)?.terminate()
  })
}
