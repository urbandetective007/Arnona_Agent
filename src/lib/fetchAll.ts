import { supabase } from './supabase'

// Supabase returns at most 1,000 rows per request, so a plain select('*')
// silently drops everything after the first 1,000. These helpers read a whole
// table in pages instead.

export const PAGE_SIZE = 1000

export interface FetchAllOptions<T> {
  /** Columns to read. Must include `orderBy`. Default: all. */
  select?: string
  /** Unique column the pages are cut by (keyset pagination). Default: id. */
  orderBy?: string
  pageSize?: number
  /**
   * Called after every page with everything loaded so far, the table's total
   * row count (null if it can't be counted) and whether more pages follow.
   */
  onPage?: (rowsSoFar: T[], total: number | null, hasMore: boolean) => void
}

/** Number of rows in the table, or null if it can't be counted. */
export async function countRows(table: string): Promise<number | null> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return error ? null : count
}

/**
 * Every row of a table, read in pages. Pages are cut by "orderBy greater than
 * the last row of the previous page" rather than by offset, so rows added or
 * deleted while loading can't make a row appear twice or be skipped.
 * Throws if any page fails.
 */
export async function fetchAllRows<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  { select = '*', orderBy = 'id', pageSize = PAGE_SIZE, onPage }: FetchAllOptions<T> = {},
): Promise<T[]> {
  const total = onPage ? await countRows(table) : null
  const rows: T[] = []
  let last: unknown = null
  for (;;) {
    let query = supabase.from(table).select(select).order(orderBy).limit(pageSize)
    if (last !== null) query = query.gt(orderBy, last as string | number)
    const { data, error } = await query
    if (error) throw new Error(`${table}: ${error.message}`)
    const page = (data ?? []) as unknown as T[]
    rows.push(...page)
    const hasMore = page.length === pageSize
    onPage?.(rows, total, hasMore)
    if (!hasMore) return rows
    last = page[page.length - 1][orderBy]
  }
}
