// Builds data/jerusalem_neighborhood_centers.json — a center point for every
// neighborhood in data/jerusalem_neighborhoods.json. The map uses these to
// (1) show a property at the center of its neighborhood when its street can't
// be found, and (2) flag pins that sit far from the neighborhood written in
// their record. Neighborhoods don't move, so this is run once (and again only
// if the registry changes); entries already in the file are kept, so
// hand-corrected centers survive a re-run. (Four were filled in by hand from OSM
// under another spelling: שיח' ג'ראח, סילואן, רמת רחל; קרית הלאום is approximate.)
//
// Usage:  node scripts/neighborhood-centers.mjs
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so fetch uses HTTPS_PROXY.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geocodeArea, nominatimSearchUrl, RateLimitError } from '../src/lib/geocode.ts'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REGISTRY = path.join(ROOT, 'data', 'jerusalem_neighborhoods.json')
const OUT = path.join(ROOT, 'data', 'jerusalem_neighborhood_centers.json')
const USER_AGENT = 'ArnonaAgentProject/1.0 (Jerusalem municipality property map)'
const DELAY_MS = 1300
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function search(query) {
  const res = await fetch(nominatimSearchUrl(query), { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he' } })
  if (res.status === 429) throw new RateLimitError('429')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function withRetry(fn) {
  let wait = 30_000
  for (;;) {
    try { return await fn() } catch (e) {
      console.warn(`  temporary failure (${e.message}) — retrying in ${wait / 1000}s`)
      await sleep(wait)
      wait = Math.min(wait * 2, 300_000)
    }
  }
}

const names = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).neighborhoods
const centers = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const unresolved = []

for (const [i, name] of names.entries()) {
  if (centers[name]) continue
  process.stdout.write(`[${i + 1}/${names.length}] ${name} … `)
  const c = await withRetry(() => geocodeArea(name, { search, delayMs: DELAY_MS }))
  await sleep(DELAY_MS)
  if (c) { centers[name] = { lat: c.lat, lon: c.lon }; console.log('ok') }
  else { unresolved.push(name); console.log('NOT FOUND') }
}

const sorted = Object.fromEntries(names.filter(n => centers[n]).map(n => [n, centers[n]]))
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n')
console.log(`\nWrote ${Object.keys(sorted).length}/${names.length} centers to ${OUT}`)
if (unresolved.length) console.log('Not found — add these by hand:\n  ' + unresolved.join('\n  '))
