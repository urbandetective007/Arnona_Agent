// Sets this copy of the site up for a new city: writes city.config.json and,
// optionally, starts the city's neighborhood list from OpenStreetMap.
// Step 2 of installer/README.md — read that first.
//
// Usage:
//   node installer/new-city.mjs \
//     --city-he "חיפה" --city-en "Haifa" \
//     --municipality "עיריית חיפה" [--department "אגף הארנונה"] \
//     --supabase-url https://xxxx.supabase.co --anon-key eyJ... \
//     [--base-path /arnona-haifa] [--neighborhoods]
//
// The city's center and bounding box come from OpenStreetMap (Nominatim).
// With --neighborhoods, data/neighborhoods.json and data/neighborhood_centers.json
// are replaced by the neighborhoods OSM knows inside the city (Overpass) —
// a starting point the municipality should review, not a final list.
// Behind a proxy, run with NODE_USE_ENV_PROXY=1 so fetch uses HTTPS_PROXY.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CONFIG = path.join(ROOT, 'city.config.json')
const USER_AGENT = 'ArnonaAgentProject/1.0 (municipality installer)'

const { values: a } = parseArgs({
  options: {
    'city-he': { type: 'string' },
    'city-en': { type: 'string' },
    municipality: { type: 'string' },
    department: { type: 'string', default: 'אגף הארנונה' },
    'supabase-url': { type: 'string' },
    'anon-key': { type: 'string' },
    'base-path': { type: 'string', default: '/Arnona_Agent' },
    neighborhoods: { type: 'boolean', default: false },
  },
})

const required = ['city-he', 'city-en', 'municipality', 'supabase-url', 'anon-key']
const missing = required.filter(k => !a[k])
if (missing.length) {
  console.error(`Missing: ${missing.map(k => '--' + k).join(', ')}  (see the usage at the top of this file)`)
  process.exit(1)
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(a['supabase-url'])) {
  console.error('--supabase-url should look like https://<project>.supabase.co')
  process.exit(1)
}
if (a['base-path'] && !/^\/[A-Za-z0-9_-]+$/.test(a['base-path'])) {
  console.error('--base-path should look like /my-repo-name (or "" for a site served at the domain root)')
  process.exit(1)
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he', ...init.headers } })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  return res.json()
}

// ── 1. City center + bounding box ────────────────────────────────────────────
const params = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'il', addressdetails: '1', q: a['city-he'] })
const [hit] = await getJson(`https://nominatim.openstreetmap.org/search?${params}`)
if (!hit) {
  console.error(`OpenStreetMap doesn't know "${a['city-he']}" — check the spelling.`)
  process.exit(1)
}
const [south, north, west, east] = hit.boundingbox.map(Number)
// A little margin: OSM's box is the municipal boundary, and addresses on its edge still count.
const pad = 0.01
const r4 = n => Math.round(n * 10000) / 10000
const config = {
  _comment: 'Everything that ties this installation to one city. A new city = a new copy of this file (see installer/README.md). Read by the website, the scripts and the workflows.',
  city: {
    nameHe: a['city-he'],
    nameEn: a['city-en'],
    osmCityPattern: `${a['city-he']}|${a['city-en'].toLowerCase()}`,
  },
  org: { municipalityHe: a.municipality, departmentHe: a.department },
  map: {
    center: { lat: r4(Number(hit.lat)), lon: r4(Number(hit.lon)) },
    bounds: { south: r4(south - pad), north: r4(north + pad), west: r4(west - pad), east: r4(east + pad) },
  },
  supabase: { url: a['supabase-url'].replace(/\/$/, ''), anonKey: a['anon-key'] },
  deploy: { basePath: a['base-path'] },
}
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n')
console.log(`✓ city.config.json written (${hit.display_name})`)
console.log(`  center ${config.map.center.lat}, ${config.map.center.lon} · bounds ${JSON.stringify(config.map.bounds)}`)

// ── 2. Neighborhoods (optional) ──────────────────────────────────────────────
if (a.neighborhoods) {
  const relation = hit.osm_type === 'relation' ? hit.osm_id : null
  const area = relation
    ? `area(${3600000000 + Number(relation)})->.c;`
    : `area["name"="${a['city-he']}"]["boundary"="administrative"]->.c;`
  const query = `[out:json][timeout:90];${area}node(area.c)["place"~"^(suburb|quarter|neighbourhood)$"];out;`
  const data = await getJson('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  })
  const centers = {}
  for (const el of data.elements ?? []) {
    const name = (el.tags?.['name:he'] ?? el.tags?.name ?? '').trim()
    if (name && !centers[name]) centers[name] = { lat: r4(el.lat), lon: r4(el.lon) }
  }
  const names = Object.keys(centers).sort((x, y) => x.localeCompare(y, 'he'))
  const registry = {
    _comment: `Canonical ${a['city-en']} neighborhood registry. 'neighborhoods' is the closed list of valid values for Business.neighborhood. 'aliases' maps known variants to a canonical entry. 'clearValues' lists values that should be cleared to null instead of mapped. Generated from OpenStreetMap by installer/new-city.mjs — review it with the municipality.`,
    neighborhoods: names,
    aliases: {},
    clearValues: ['לא ידוע', 'לא ידועה', '-', a['city-he']],
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'neighborhoods.json'), JSON.stringify(registry, null, 2) + '\n')
  fs.writeFileSync(path.join(ROOT, 'data', 'neighborhood_centers.json'), JSON.stringify(centers, null, 2) + '\n')
  console.log(`✓ ${names.length} neighborhoods from OpenStreetMap → data/neighborhoods.json, data/neighborhood_centers.json`)
  if (names.length < 5) console.log('  Very few found — build the list with the municipality instead (see installer/README.md).')
}

console.log('\nNext: installer/README.md, step 3 (database).')
