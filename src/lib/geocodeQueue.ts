import {
  geocodeAddress,
  type LocationEntry, type LocationMap, type NominatimResult,
} from './geocode'

// A queue that places addresses one at a time (Nominatim allows about one
// request per second) and hands results out in batches for saving. Used by
// the map (runs while the page is open) and the upload page (runs right
// after an upload). Knows nothing about Supabase — persistence is injected —
// so it can be tested with a fake `search`.
//
// Temporary failures (rate limiting, network) are never recorded as "not
// found": the address goes back on the queue and the worker backs off.

export interface GeocodeItem {
  /** Address key, see cleanAddress. */
  key: string
  /** Center of the property's neighborhood, to pick the right one among same-named streets. */
  near?: { lat: number; lon: number } | null
}

export interface GeocodeQueueOptions {
  search: (query: string) => Promise<NominatimResult[]>
  /** Persists a batch of finished results. May throw; unsaved results stay buffered and are retried. */
  save: (rows: { key: string; entry: LocationEntry }[]) => Promise<void>
  /** Called for every finished address. */
  onResult?: (key: string, entry: LocationEntry) => void
  /** Called after every finished address. */
  onProgress?: (progress: { done: number; total: number }) => void
  /** Pause between requests. */
  delayMs?: number
  /** First wait after a temporary failure; doubles up to backoffMaxMs. */
  backoffStartMs?: number
  backoffMaxMs?: number
  /** Give up (leaving items pending) after this many failures in a row. Default: never. */
  maxConsecutiveFailures?: number
  /** Save after this many finished addresses (and always when idle or stopped). */
  flushEvery?: number
}

export interface GeocodeQueue {
  /** Queues addresses not seen before by this queue; restarts the worker if idle. */
  add: (items: GeocodeItem[]) => void
  /** Stops the worker, saving what is finished. */
  stop: () => Promise<void>
  /** Resolves when the queue is empty or gave up (or was stopped). */
  whenIdle: () => Promise<void>
  /** Results so far. */
  results: () => LocationMap
  /** Addresses still waiting (not yet looked up). */
  pending: () => GeocodeItem[]
}

export function createGeocodeQueue(opts: GeocodeQueueOptions): GeocodeQueue {
  const delayMs = opts.delayMs ?? 1100
  const backoffStartMs = opts.backoffStartMs ?? 30_000
  const backoffMaxMs = opts.backoffMaxMs ?? 300_000
  const maxFailures = opts.maxConsecutiveFailures ?? Infinity
  const flushEvery = opts.flushEvery ?? 5

  const queue: GeocodeItem[] = []
  const seen = new Set<string>()
  const results: LocationMap = {}
  let unsaved: { key: string; entry: LocationEntry }[] = []
  let running = false
  let stopped = false
  let done = 0
  let total = 0
  let idleWaiters: (() => void)[] = []
  let wake: (() => void) | null = null

  const sleep = (ms: number) => new Promise<void>(resolve => {
    const timer = setTimeout(() => { wake = null; resolve() }, ms)
    wake = () => { clearTimeout(timer); wake = null; resolve() }
  })

  async function flush() {
    if (unsaved.length === 0) return
    const batch = unsaved
    unsaved = []
    try {
      await opts.save(batch)
    } catch (e) {
      console.warn('Saving locations failed; will retry with the next batch', e)
      unsaved = [...batch, ...unsaved]
    }
  }

  async function worker() {
    let failures = 0
    let backoff = backoffStartMs
    while (queue.length > 0 && !stopped) {
      const item = queue.shift()!
      let entry: LocationEntry
      try {
        const coords = await geocodeAddress(item.key, { search: opts.search, delayMs }, item.near)
        entry = coords
          ? { lat: coords.lat, lon: coords.lon, precision: coords.precision ?? 'exact' }
          : { missingAt: Date.now() }
        failures = 0
        backoff = backoffStartMs
      } catch {
        queue.push(item)
        if (++failures >= maxFailures) break
        await sleep(backoff)
        backoff = Math.min(backoff * 2, backoffMaxMs)
        continue
      }
      results[item.key] = entry
      unsaved.push({ key: item.key, entry })
      done++
      opts.onResult?.(item.key, entry)
      opts.onProgress?.({ done, total })
      if (unsaved.length >= flushEvery) await flush()
      if (queue.length > 0 && !stopped) await sleep(delayMs)
    }
    await flush()
  }

  function start() {
    if (running || stopped || queue.length === 0) return
    running = true
    worker().finally(() => {
      running = false
      const waiters = idleWaiters
      idleWaiters = []
      waiters.forEach(r => r())
    })
  }

  return {
    add(items) {
      for (const item of items) {
        if (seen.has(item.key)) continue
        seen.add(item.key)
        queue.push(item)
        total++
      }
      start()
    },
    async stop() {
      stopped = true
      wake?.()
      if (running) await new Promise<void>(resolve => idleWaiters.push(resolve))
      else await flush()
    },
    whenIdle() {
      return running ? new Promise<void>(resolve => idleWaiters.push(resolve)) : Promise.resolve()
    },
    results: () => results,
    pending: () => [...queue],
  }
}
