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

function parseOnPage(buffer: ArrayBuffer): Promise<ParsedSheet> {
  return import('./parseSheet').then(m => m.parseSheet(buffer))
}

export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer()
  if (typeof Worker === 'undefined') return parseOnPage(buffer)

  let worker: Worker
  try {
    worker = new Worker(WORKER_URL)
  } catch {
    return parseOnPage(buffer)
  }

  return new Promise<ParsedSheet>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<ParseResponse>) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.sheet)
      else reject(new Error(e.data.message))
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
}
