import { parseSheet, type ParsedSheet } from './parseSheet'

// Web Worker entry: receives a file's bytes, answers with the parsed sheet or
// the (Hebrew) error message. Started by parseInWorker.ts.

export type ParseResponse = { ok: true; sheet: ParsedSheet } | { ok: false; message: string }

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ArrayBuffer>) => void) | null
  postMessage: (msg: ParseResponse) => void
}

scope.onmessage = e => {
  try {
    scope.postMessage({ ok: true, sheet: parseSheet(e.data) })
  } catch (err) {
    scope.postMessage({ ok: false, message: err instanceof Error ? err.message : 'שגיאה בקריאת הקובץ' })
  }
}
