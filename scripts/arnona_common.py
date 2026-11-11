"""Shared helpers for the agent's upload path (the GitHub workflow
.github/workflows/upload-arnona.yml and scripts/upload_to_supabase*.py).

Mirrors the website's logic so an agent upload ends up the same as a browser
upload:
  * links: up to 5 columns "קישור 1".."קישור 5" -> link1..link5 (older reports
    with a single "מקור המידע (URL)" column -> link1). The site never read the
    old `link` column, which is why agent rows showed no links.
  * neighborhood: decided by the street (data/street_neighborhoods.json plus the
    employees' corrections in street_neighborhood_overrides), the report's
    column only as a fallback — same as src/lib/streetNeighborhoods.ts.
"""
import json
import re
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ---------------------------------------------------------------- neighborhoods
_REG = json.loads((DATA / "jerusalem_neighborhoods.json").read_text(encoding="utf-8"))
_CANON = set(_REG["neighborhoods"])
_ALIASES = _REG["aliases"]
_CLEAR = set(_REG["clearValues"])


def normalize_neighborhood(raw):
    v = (raw or "").strip()
    if not v or v in _CLEAR:
        return None
    if v in _CANON:
        return v
    return _ALIASES.get(v)


# Same as streetKey() in src/lib/streetNeighborhoods.ts.
_KEY_PREFIXES = ["שכ ", "שכונת ", "דרך ", "רחוב ", "שדרות ", "שד ", "הרבנית ", "הרב ", "האדמור ", "רבי ", "ר "]
# Same as cleanAddress() in src/lib/geocode.ts.
_ADDR_PREFIXES = ["רחוב ", "רח' ", "שדרות ", "שד' ", "שד ", "סמטת ", "כיכר ", "גן ", "מעלה ", "מורד "]


def street_key(street):
    s = re.sub(r"[\"'`׳״’]", "", street or "").replace("-", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+סמ\s*\d+$", "", s).strip()
    for p in _KEY_PREFIXES:
        if s.startswith(p):
            s = s[len(p):]
    return " ".join(sorted(w for w in s.split(" ") if w))


def parse_address(address):
    """(street, house number or None) — same as cleanAddress + parseAddress in geocode.ts."""
    base = (address or "").split(",")[0].strip()
    for p in _ADDR_PREFIXES:
        if base.startswith(p):
            base = base[len(p):]
            break
    base = re.sub(r"\s+", " ", base).strip()
    base = re.sub(r"\s+(דירה|דיר|דר|יח'|יחידה|קומה)\s+\d+.*", "", base).strip()
    m = re.match(r"^(.*?\D)\s*(\d+)(?:\s*[א-ת]|\s*/\s*[\dא-ת]+)?(?:\s+.*)?$", base)
    if not m:
        return base.strip(), None
    return m.group(1).strip(), (None if m.group(2) == "0" else m.group(2))


class StreetTable:
    def __init__(self, overrides=None):
        t = json.loads((DATA / "street_neighborhoods.json").read_text(encoding="utf-8"))
        self.streets = t["streets"]
        self.houses = t.get("houses", {})
        for o in overrides or []:
            self.streets[o["street_key"]] = [o["neighborhood"]]
            self.houses.pop(o["street_key"], None)

    def _resolve(self, key):
        if key in self.streets:
            return key
        if len(key) < 3:
            return None
        words = key.split(" ")
        partial = [k for k in self.streets if all(w in k.split(" ") for w in words)]
        return partial[0] if len(partial) == 1 else None

    def neighborhood(self, address, file_value=None):
        """Neighborhood for an address: by street (and house number) first,
        the report's own value when it is one of the street's neighborhoods or
        the street is unknown. Returns (neighborhood or None, changed: bool)."""
        file_n = normalize_neighborhood(file_value)
        street, number = parse_address(address)
        key = self._resolve(street_key(street)) if street else None
        if not key:
            return file_n, False
        if number and self.houses.get(key, {}).get(number):
            chosen = self.houses[key][number]
        else:
            options = self.streets[key]
            chosen = file_n if file_n in options else options[0]
        return chosen, bool(file_n and file_n != chosen)


def fetch_overrides(supabase_url, headers):
    """Employees' street corrections. Missing table (migration not applied) -> none."""
    try:
        r = requests.get(f"{supabase_url}/rest/v1/street_neighborhood_overrides?select=street_key,neighborhood",
                         headers=headers, timeout=10)
        return r.json() if r.ok else []
    except requests.RequestException:
        return []


def has_column(supabase_url, headers, table, column):
    try:
        r = requests.get(f"{supabase_url}/rest/v1/{table}?select={column}&limit=1", headers=headers, timeout=10)
        return r.ok
    except requests.RequestException:
        return False


# ------------------------------------------------------------------------ links
LINK_COLUMNS = ["קישור 1", "קישור 2", "קישור 3", "קישור 4", "קישור 5",
                "קישור מקור 1", "קישור מקור 2", "קישור מקור 3", "קישור מקור 4", "קישור מקור 5"]
LEGACY_LINK_COLUMNS = ["מקור המידע (URL)", "מקור/URL", "מקור המידע", "קישור"]


def extract_links(get):
    """`get(header)` returns a cell's text or None. Returns up to 5 distinct links."""
    links = []
    for h in LINK_COLUMNS + LEGACY_LINK_COLUMNS:
        v = (get(h) or "").strip()
        if v and v not in links:
            links.append(v)
    return links[:5]


def link_fields(links, allow_extra=True):
    """link1..link5 for the DB row. Without the link4/link5 columns (migration
    not applied yet) only the first three are sent."""
    n = 5 if allow_extra else 3
    padded = (list(links) + [None] * 5)[:n]
    return {f"link{i + 1}": padded[i] for i in range(n)}
