// Bulk-locates addresses and writes SQL that stores them in the Supabase
// table address_locations. Day to day this isn't needed — the upload page
// locates new addresses automatically — but it is handy to (re)place a large
// list at once, e.g. after fixing many addresses.
//
// Usage:
//   node scripts/geocode-addresses.mjs <addresses-file> [out.sql]
//
// <addresses-file> has one property per line: "address¦neighborhood"
// (neighborhood may be empty). Export it from Supabase with:
//   select string_agg(address || '¦' || coalesce(neighborhood,''), E'\n')
//   from (select distinct address, neighborhood from businesses
//         where address is not null and address <> '') t
//
// Every address is placed with the same logic the map and the upload page use
// (src/lib/geocode.ts): inside Jerusalem only, house → street, choosing among
// same-named streets the one closest to the property's neighborhood. An
// address that can't be placed is stored as "not found" (the map then shows
// it at the center of its neighborhood). The SQL upserts, so running it again
// simply refreshes those rows — hand-placed (manual) rows are never changed;
// review it and run it in the Supabase SQL editor.
//
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so fetch uses HTTPS_PROXY.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanAddress, neighborhoodHint, geocodeAddress, nominatimSearchUrl, RateLimitError } from '../src/lib/geocode.ts'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', file), 'utf8'))
const registry = readJson('jerusalem_neighborhoods.json')
const centers = readJson('jerusalem_neighborhood_centers.json')

// Same rules as normalizeNeighborhood in src/lib/neighborhoods.ts.
function neighborhoodCenter(raw) {
  const name = (raw ?? '').trim()
  if (!name || registry.clearValues.includes(name)) return null
  const canonical = registry.neighborhoods.includes(name) ? name : registry.aliases[name]
  return (canonical && centers[canonical]) || null
}

const USER_AGENT = 'ArnonaAgentProject/1.0 (Jerusalem municipality property map)'
const DELAY_MS = 1300
const sleep = ms => new Promise(r => setTimeout(r, ms))

const [inputFile, outFile = 'address-locations.sql'] = process.argv.slice(2)
if (!inputFile) {
  console.error('Usage: node scripts/geocode-addresses.mjs <addresses-file> [out.sql]')
  process.exit(1)
}

async function search(query) {
  const res = await fetch(nominatimSearchUrl(query), { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he' } })
  if (res.status === 429) throw new RateLimitError('429')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Retries temporary failures (rate limiting, network) with backoff.
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

// One entry per clean address (the table's key); first non-empty hint wins.
const todo = new Map() // key → center of the property's neighborhood (or null)
for (const line of fs.readFileSync(inputFile, 'utf8').split('\n')) {
  if (!line.trim()) continue
  const [address, neighborhood = ''] = line.split('¦')
  const key = cleanAddress(address)
  if (!key) continue
  const near = neighborhoodCenter(neighborhoodHint(address, neighborhood))
  if (!todo.has(key) || (!todo.get(key) && near)) todo.set(key, near)
}

const sql = s => `'${s.replace(/'/g, "''")}'`
const rows = []
const stats = { exact: 0, street: 0, notFound: 0 }
const notFound = []

let i = 0
for (const [key, near] of todo) {
  i++
  process.stdout.write(`[${i}/${todo.size}] ${key} … `)
  const result = await withRetry(() => geocodeAddress(key, { search, delayMs: DELAY_MS }, near))
  await sleep(DELAY_MS)
  if (result) {
    stats[result.precision]++
    rows.push(`(${sql(key)}, ${result.lat}, ${result.lon}, ${sql(result.precision)}, 'placed')`)
    console.log(result.precision)
  } else {
    stats.notFound++
    notFound.push(key)
    rows.push(`(${sql(key)}, null, null, null, 'not_found')`)
    console.log('NOT FOUND')
  }
}

if (rows.length > 0) {
  fs.writeFileSync(outFile,
    'insert into public.address_locations (address_key, lat, lon, precision, status) values\n' +
    rows.join(',\n') + '\n' +
    'on conflict (address_key) do update set\n' +
    '  lat = excluded.lat, lon = excluded.lon, precision = excluded.precision,\n' +
    '  status = excluded.status, updated_at = now()\n' +
    "  where not address_locations.manual;\n")
}

console.log(`\nWrote ${rows.length} rows to ${outFile}`)
console.log(stats)
if (notFound.length) console.log('\nNot found:\n  ' + notFound.join('\n  '))
