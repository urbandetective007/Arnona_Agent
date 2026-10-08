#!/usr/bin/env python3
"""Build the street → neighborhood table the website uses (data/street_neighborhoods.json).

The site fills in the neighborhood when an employee types an address by hand,
and the one-off backfill of businesses without a neighborhood uses the same
table. It is built from the data assign_neighborhoods.py already keeps:

  * data/address_cache.csv           — every address the agent's list holds,
                                       with the neighborhood decided for it;
  * data/overrides.json "streets"    — streets fixed by hand;
  * data/municipal_streets_2020.xlsx — the municipality's street list, for
                                       streets the address list doesn't have.

Output, keyed by the street key (see street_key below, mirrored in
src/lib/streetNeighborhoods.ts):

  {"streets": {"<key>": ["most common neighborhood", "other", ...]},
   "houses":  {"<key>": {"<house number>": "neighborhood"}}}

"houses" is kept only for streets that cross neighborhoods, so a known house
number still gets its exact neighborhood.

Usage:  python3 build_street_index.py [OUT.json]
"""
import collections
import csv
import json
import re
import sys
from pathlib import Path

from assign_neighborhoods import (DATA, Names, StreetIndex, clean, drop_alley, drop_prefix, load_registry_file,
                                  norm, sorted_words, street_of)

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE.parents[1] / 'data' / 'street_neighborhoods.json'


def street_key(street):
    """Spelling-, prefix- and word-order-insensitive: 'הרב שמעון אגסי' == 'אגסי שמעון'."""
    return sorted_words(drop_prefix(drop_alley(norm(street))))


def house_number(address):
    m = re.search(r'\s(\d+)\S*$', clean(address))
    return m.group(1) if m else None


def main():
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    registry = load_registry_file('jerusalem_neighborhoods.json')
    canon = set(registry['neighborhoods'])
    overrides = json.loads((DATA / 'overrides.json').read_text(encoding='utf-8'))
    names = Names(registry, overrides.get('name_map', {}))

    counts = collections.defaultdict(collections.Counter)
    houses = collections.defaultdict(dict)
    with (DATA / 'address_cache.csv').open(encoding='utf-8', newline='') as f:
        for row in csv.DictReader(f):
            hood = row['neighborhood'].strip()
            if hood not in canon:
                continue
            key = street_key(street_of(row['address']))
            if not key:
                continue
            counts[key][hood] += 1
            n = house_number(row['address'])
            if n:
                houses[key][n] = hood

    # Streets fixed by hand win over what the address list says.
    fixed = {}
    for street, value in overrides.get('streets', {}).items():
        opts = [o.strip() for o in value.split(' / ') if o.strip() in canon]
        if opts:
            fixed[street_key(street)] = opts

    # Municipal list: only for streets the address list doesn't cover.
    municipal = collections.defaultdict(collections.Counter)
    for level_key, counter in StreetIndex(DATA / 'municipal_streets_2020.xlsx').idx['words'].items():
        for raw, n in counter.items():
            for hood in names.to_registry(raw, count_unknown=False):
                municipal[level_key][hood] += n

    streets = {}
    for key, c in counts.items():
        streets[key] = [h for h, _ in c.most_common()]
    for key, c in municipal.items():
        if key not in streets:
            streets[key] = [h for h, _ in c.most_common()]
    streets.update(fixed)

    multi = {k for k, v in streets.items() if len(v) > 1}
    table = {
        'streets': dict(sorted(streets.items())),
        'houses': {k: dict(sorted(houses[k].items(), key=lambda kv: int(kv[0]))) for k in sorted(multi) if houses.get(k)},
    }
    out_path.write_text(json.dumps(table, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(streets)} streets ({len(multi)} in several neighborhoods) → {out_path} '
          f'({out_path.stat().st_size // 1024} KB)', file=sys.stderr)


if __name__ == '__main__':
    main()
