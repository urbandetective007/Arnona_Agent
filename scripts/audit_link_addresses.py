"""Audit: does the address on each business's links match its municipal address?

The agent once reported businesses it found at "מאה שערים N" (the main street)
under the municipal address "ב אונגר מאה שערים N" (בתי אונגרין) and rated them
"גבוה". This reads every link of every business, pulls the address the page
shows, and compares it with the business's address using the same rule as the
site (src/lib/links.ts) and the agent (business-address-lookup, section ד).

    python scripts/audit_link_addresses.py businesses.csv audit.csv updates.sql

businesses.csv: columns id, address, suspicion_rating, survey_result_detail,
link1, link2, link3 (e.g. exported from the businesses table).
Pages are fetched directly; if that fails and TAVILY_API_KEY is set, through
Tavily extract. Nothing is written to the database: updates.sql holds the
changes for review —
  - every link gets "(address on the page)" after the URL;
  - a business rated "גבוה" whose links show only other addresses becomes
    "דרוש בדיקה" (status unknown) with the reason in suspicion_detail.
Businesses that already have a survey result are not changed.
"""
import csv
import os
import re
import sys
import time

import requests

JERUSALEM = 'ירושלים'
PREFIXES = ('רחוב ', "רח' ", 'שדרות ', "שד' ", 'שד ', 'סמטת ', 'כיכר ', 'גן ', 'מעלה ', 'מורד ')
# "<street> <number>, ירושלים" — the street is Hebrew words (with ' " -), the
# number may carry a letter (12א).
ADDRESS_RE = re.compile(r"([א-ת][א-ת'\"׳״\- ]{1,40}?)\s+(\d{1,4})[א-ת]?\s*,?\s*" + JERUSALEM)
URL_RE = re.compile(r'https?://\S+', re.I)


def split_link(raw):
    text = (raw or '').strip()
    m = URL_RE.search(text)
    if not m:
        return '', ''
    rest = text[m.end():].strip()
    if rest.startswith('(') and rest.endswith(')'):
        rest = rest[1:-1]
    return m.group(0), rest.strip()


def street_and_number(address):
    a = (address or '').split(',')[0].strip()
    for p in PREFIXES:
        if a.startswith(p):
            a = a[len(p):]
            break
    a = re.sub(r"[\"'״׳`]", '', a)
    a = re.sub(r'[-–־]', ' ', a)
    a = re.sub(r'\s+(דירה|דיר|דר|יח|יחידה|קומה)\s+\d+.*$', '', a)
    m = re.match(r'^(.*?)\s*(\d+)', a)
    if not m or not m.group(1).strip():
        return None
    words = sorted(w for w in m.group(1).split() if w not in ('רח', 'רחוב', JERUSALEM))
    return ' '.join(words), m.group(2)


def mismatch(site_address, address):
    site, own = street_and_number(site_address), street_and_number(address)
    if not site or not own:
        return False
    return site != own


def page_text(url):
    try:
        r = requests.get(url, timeout=20, headers={'User-Agent': 'Mozilla/5.0'})
        if r.ok and r.text:
            return re.sub(r'<[^>]+>', ' ', r.text)
    except requests.RequestException:
        pass
    key = os.environ.get('TAVILY_API_KEY')
    if not key:
        return ''
    try:
        r = requests.post('https://api.tavily.com/extract', timeout=60,
                          json={'urls': [url], 'format': 'text'},
                          headers={'Authorization': f'Bearer {key}'})
        results = r.json().get('results') or []
        return results[0].get('raw_content', '') if results else ''
    except (requests.RequestException, ValueError):
        return ''


def site_address(text, address):
    """The address the page shows: the one matching the business, else the first."""
    found = [f'{m.group(1).strip()} {m.group(2)}' for m in ADDRESS_RE.finditer(text)]
    for a in found:
        if not mismatch(a, address):
            return a
    return found[0] if found else ''


def sql(s):
    return "'" + s.replace("'", "''") + "'"


def main(src, out_csv, out_sql):
    rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
    report, updates = [], []
    for i, b in enumerate(rows, 1):
        links, seen = {}, []
        for col in ('link1', 'link2', 'link3'):
            url, written = split_link(b.get(col))
            if not url:
                continue
            addr = written or site_address(page_text(url), b['address'])
            time.sleep(0.5)
            links[col] = (url, addr)
            seen.append(addr)
            report.append({'id': b['id'], 'address': b['address'], 'link': col, 'url': url,
                           'site_address': addr or '(לא נמצאה)',
                           'match': '' if not addr else ('לא' if mismatch(addr, b['address']) else 'כן')})
        print(f'{i}/{len(rows)} {b["address"]}: {[a for _, a in links.values()]}', file=sys.stderr)
        if b.get('survey_result_detail'):
            continue
        sets = [f"{col} = {sql(f'{url} ({addr})')}" for col, (url, addr) in links.items() if addr]
        known = [a for a in seen if a]
        if b.get('suspicion_rating') == 'גבוה' and known and all(mismatch(a, b['address']) for a in known):
            sets += ["suspicion_rating = 'דרוש בדיקה'", "arnona_status = 'unknown'",
                     f"suspicion_detail = {sql(f'כתובת בקישור: {known[0]} ≠ כתובת עירונית: ' + b['address'])}"]
        if sets:
            updates.append(f"update businesses set {', '.join(sets)} where id = {sql(b['id'])} and survey_result_detail is null;")

    with open(out_csv, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['id', 'address', 'link', 'url', 'site_address', 'match'])
        w.writeheader()
        w.writerows(report)
    with open(out_sql, 'w', encoding='utf-8') as f:
        f.write('\n'.join(updates) + '\n')
    print(f'{len(report)} links checked, {sum(r["match"] == "לא" for r in report)} with another address; '
          f'{len(updates)} updates in {out_sql}', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
