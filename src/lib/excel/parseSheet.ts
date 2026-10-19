import * as XLSX from 'xlsx'

// Reads the first sheet of an uploaded report. Runs inside a Web Worker (see
// parseInWorker.ts) so a big file never freezes the page.
//
// Excel often records a sheet's range as far larger than its data — e.g. a
// fill or border applied to whole columns makes the range A1:Z1048576. Read
// as-is, that turns a 500-row file into a million empty rows (and the browser
// into "Page unresponsive"). So the range is first cut down to the cells that
// actually hold a value, and blank rows are skipped.

/** Header that marks the header row; files without it are rejected. */
export const HEADER_MARKER = 'שם העסק'

export interface ParsedSheet {
  headers: string[]
  /** Data rows below the header row, blank rows left out. */
  rows: string[][]
  /** Excel row number (1-based, as shown in Excel) of each entry in `rows`. */
  rowNumbers: number[]
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || String(v).trim() === ''
}

/** The range of cells that hold a value, or null for an empty sheet. */
function usedRange(ws: XLSX.WorkSheet): XLSX.Range | null {
  const data = ws['!data']
  if (!data) return null
  let lastRow = -1
  let lastCol = -1
  data.forEach((row, r) => {
    if (!row) return
    row.forEach((cell, c) => {
      if (cell && !isBlank(cell.v)) {
        if (r > lastRow) lastRow = r
        if (c > lastCol) lastCol = c
      }
    })
  })
  return lastRow < 0 ? null : { s: { r: 0, c: 0 }, e: { r: lastRow, c: lastCol } }
}

export function parseSheet(buffer: ArrayBuffer): ParsedSheet {
  const wb = XLSX.read(buffer, { dense: true, cellStyles: false, cellFormula: false, cellHTML: false, cellNF: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const range = ws && usedRange(ws)
  if (!range) throw new Error('הקובץ ריק — לא נמצאו נתונים בגיליון הראשון')
  ws['!ref'] = XLSX.utils.encode_range(range)

  const all = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', blankrows: true })
  const hIdx = all.findIndex(row => row.some(c => String(c).trim() === HEADER_MARKER))
  if (hIdx === -1) throw new Error(`לא נמצאה עמודת "${HEADER_MARKER}" — ודא שהקובץ במבנה הנכון`)

  const headers = all[hIdx].map(h => String(h).trim())
  const rows: string[][] = []
  const rowNumbers: number[] = []
  for (let i = hIdx + 1; i < all.length; i++) {
    const row = all[i]
    if (!row.some(c => !isBlank(c))) continue
    rows.push(row.map(c => String(c)))
    rowNumbers.push(i + 1)
  }
  return { headers, rows, rowNumbers }
}
