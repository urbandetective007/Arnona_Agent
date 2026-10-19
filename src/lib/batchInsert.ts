import { supabase } from './supabase'

// Inserting thousands of rows in one request can exceed the database's
// statement timeout (8s for signed-in users — and every business row runs the
// type-normalizing trigger), failing the whole upload. Rows are sent in
// batches instead, with progress and retries.
//
// Rows are inserted with "on conflict do nothing" on the primary key, so a
// batch that is sent again (a retry, or the employee resuming after an error)
// never creates duplicates.

const DEFAULT_BATCH_SIZE = 500
const MIN_BATCH_SIZE = 25
const ATTEMPTS = 3

/** Postgres "statement timeout": the batch was too slow, send smaller ones. */
const STATEMENT_TIMEOUT = '57014'

export class BatchInsertError extends Error {
  /** Rows saved before the failure. */
  saved: number
  constructor(message: string, saved: number) {
    super(message)
    this.saved = saved
  }
}

export interface InsertInBatchesOptions {
  batchSize?: number
  /** Called after every saved batch. */
  onProgress?: (saved: number, total: number) => void
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Inserts rows (keyed by `id`) in batches. Throws BatchInsertError if a batch keeps failing. */
export async function insertInBatches(
  table: string, rows: Record<string, unknown>[], { batchSize = DEFAULT_BATCH_SIZE, onProgress }: InsertInBatchesOptions = {},
): Promise<void> {
  let size = batchSize
  let saved = 0
  while (saved < rows.length) {
    const batch = rows.slice(saved, saved + size)
    let lastError = ''
    let timedOut = false
    let ok = false
    for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
      const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
      if (!error) { ok = true; break }
      lastError = error.message
      timedOut = error.code === STATEMENT_TIMEOUT
      if (timedOut && size > MIN_BATCH_SIZE) break
      if (attempt < ATTEMPTS) await wait(1000 * 2 ** (attempt - 1))
    }
    if (!ok) {
      if (timedOut && size > MIN_BATCH_SIZE) { size = Math.max(MIN_BATCH_SIZE, Math.floor(size / 2)); continue }
      throw new BatchInsertError(lastError, saved)
    }
    saved += batch.length
    onProgress?.(saved, rows.length)
  }
}
