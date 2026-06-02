---
name: arnona-upload
description: >
  העלאת קובץ Excel "דוח נכסים חשודים" מעיריית ירושלים לבסיס הנתונים של סוכן ארנונה ב-Supabase.
  השתמש בסקיל הזה בכל פעם שהמשתמש מבקש להעלות / לייבא / לטעון קובץ Excel של ארנונה,
  נכסים חשודים, דוח יומי, או כל אזכור של "דוח נכסים חשודים", "להעלות לסופאבייס", "לעדכן את הבסיס".
  הסקיל מפרסר את הקובץ, בודק כפולים מול Supabase, ומעלה רשומות חדשות בלבד.
---

# arnona-upload — העלאת דוח נכסים חשודים ל-Supabase

## מה הסקיל עושה

1. מקבל נתיב לקובץ Excel
2. מאתר את שורת הכותרת שמכילה `שם העסק` (כולל שורות לפניה)
3. מנרמל שמות עמודות (מטפל בשבירות שורה `\n`)
4. פורסר את כל השורות לרשומות
5. שולף מ-Supabase את כל הזוגות `name|address` הקיימים
6. מדלג על כפולים
7. יוצר רשומת `upload_sessions`
8. מעלה את `businesses` החדשים
9. מדווח: כמה נוספו, כמה דולגו

> ⚠️ **חשוב:** הסקיל מיועד לריצה ב-Claude Code בלבד (לא Claude Chat).
> Claude Code רץ על המחשב המקומי ויכול להתחבר ל-Supabase ישירות.

---

## קונפיגורציה קבועה

```python
SUPABASE_URL = "https://mcsygsqfyuaexxxwsgem.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jc3lnc3FmeXVhZXh4eHdzZ2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Njk1MTIsImV4cCI6MjA5NDE0NTUxMn0.Hu6t2PLjE_D113NMQEGvEv8QGhqN6udKNO9McqK3ST8"
```

---

## מבנה טבלאות Supabase

### `businesses`
| עמודה | סוג | הערות |
|---|---|---|
| id | uuid | אוטומטי |
| name | text | שם העסק |
| type | text | סוג העסק |
| address | text | כתובת מהקובץ |
| matched_address | text | כתובת תואמת |
| property_owners | text | שמות בעלי נכסים |
| unit_count | text | מס' דירות |
| suspicion_rating | text | דירוג חשד |
| suspicion_detail | text | פירוט החשד |
| no_suspicion_reason | text | סיבת אי-חשד |
| link | text | מקור/URL |
| arnona_status | text | suspicious / ok / unknown |
| upload_date | timestamptz | אוטומטי (now()) |
| upload_session_id | uuid | FK → upload_sessions.id |

### `upload_sessions`
| עמודה | סוג | הערות |
|---|---|---|
| id | uuid | אוטומטי |
| file_name | text | שם הקובץ |
| upload_date | timestamptz | אוטומטי |
| total_count | int | סה"כ שורות שהועלו |
| suspicious_count | int | כמה suspicious |
| ok_count | int | כמה ok |
| unknown_count | int | כמה unknown |
| skipped_count | int | כמה שורות דולגו (כפולים) |
| business_ids | text[] | מערך של UUIDs |

---

## מיפוי `arnona_status`

```python
def map_status(val):
    v = (val or "").strip()
    if v in ("גבוה", "בינוני"):
        return "suspicious"
    if v == "לא חשוד":
        return "ok"
    return "unknown"
```

---

## נרמול שמות עמודות

קבצי Excel מהעירייה מכילים לעיתים שבירות שורה (`\n`) בשמות העמודות:
- `כתובת תואמת\n(מהעירייה)` במקום `כתובת תואמת`
- `שמות בעלי נכסים\nבאותה כתובת`
- `מס' דירות\nבכתובת`
- `מקור המידע\n(URL)`

הסקריפט מטפל בזה עם `normalize_col` ו-`COL_ALIASES`.

---

## סקריפט Python מלא

הרץ את הסקריפט הבא. **התאם את `EXCEL_PATH`** לנתיב שסיפק המשתמש.

```python
import sys
import subprocess

# התקנת חבילות חסרות
for pkg in ["openpyxl", "requests"]:
    try:
        __import__(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--quiet"])

import openpyxl
import requests
import uuid
import os
from datetime import datetime, timezone

# ── קונפיגורציה ──────────────────────────────────────────────────────────────
SUPABASE_URL = "https://mcsygsqfyuaexxxwsgem.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jc3lnc3FmeXVhZXh4eHdzZ2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1Njk1MTIsImV4cCI6MjA5NDE0NTUxMn0.Hu6t2PLjE_D113NMQEGvEv8QGhqN6udKNO9McqK3ST8"
EXCEL_PATH = r"REPLACE_WITH_USER_PATH"   # ← יש להחליף
# ─────────────────────────────────────────────────────────────────────────────

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def supabase_get(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()
    return r.json()

def supabase_post(table, payload):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.post(url, json=payload, headers=HEADERS)
    if not r.ok:
        raise RuntimeError(f"Supabase error {r.status_code}: {r.text}")
    return r.json()

def map_status(val):
    v = (val or "").strip()
    if v in ("גבוה", "בינוני"):
        return "suspicious"
    if v == "לא חשוד":
        return "ok"
    return "unknown"

def normalize_col(s):
    """נרמול שם עמודה: מאחד רווחים ושבירות שורה לרווח יחיד"""
    return " ".join(str(s).split()) if s else ""

# מיפוי שמות קנוניים → וריאציות אפשריות בקובץ
COL_ALIASES = {
    "כתובת תואמת":     ["כתובת תואמת (מהעירייה)", "כתובת תואמת"],
    "שמות בעלי נכסים": ["שמות בעלי נכסים באותה כתובת", "שמות בעלי נכסים"],
    "מס' דירות":       ["מס' דירות בכתובת", "מס' דירות"],
    "מקור/URL":        ["מקור המידע (URL)", "מקור/URL", "מקור המידע"],
}

def resolve_col(col_map, canonical_name):
    """מוצא את האינדקס של עמודה לפי שם קנוני, כולל וריאציות"""
    if canonical_name in col_map:
        return col_map[canonical_name]
    for alias in COL_ALIASES.get(canonical_name, []):
        if normalize_col(alias) in col_map:
            return col_map[normalize_col(alias)]
    return None

# ── 1. פרסור Excel ────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb.active

header_row_idx = None
for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
    normalized = [normalize_col(v) for v in row]
    if "שם העסק" in normalized:
        header_row_idx = i
        col_map = {normalize_col(v): j for j, v in enumerate(row) if v}
        break

if header_row_idx is None:
    raise ValueError("לא נמצאה שורת כותרת עם 'שם העסק'")

print(f"📋 שורת כותרת: שורה {header_row_idx}")
print(f"📋 עמודות שזוהו: {list(col_map.keys())}")

def col(row_vals, name):
    idx = resolve_col(col_map, name)
    if idx is None:
        return None
    v = row_vals[idx] if idx < len(row_vals) else None
    return str(v).strip() if v is not None else None

records = []
for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
    name = col(row, "שם העסק")
    if not name:
        continue
    records.append({
        "name":                name,
        "type":                col(row, "סוג העסק"),
        "address":             col(row, "כתובת"),
        "suspicion_rating":    col(row, "דירוג חשד"),
        "matched_address":     col(row, "כתובת תואמת"),
        "property_owners":     col(row, "שמות בעלי נכסים"),
        "unit_count":          col(row, "מס' דירות"),
        "suspicion_detail":    col(row, "פירוט החשד"),
        "no_suspicion_reason": col(row, "סיבת אי-חשד"),
        "link":                col(row, "מקור/URL"),
        "arnona_status":       map_status(col(row, "דירוג חשד")),
    })

print(f"✅ נמצאו {len(records)} שורות בקובץ")

# ── 2. שליפת כפולים קיימים ───────────────────────────────────────────────────
existing_raw = supabase_get("businesses", "select=name,address")
# בדיקה לפי שם בלבד (normalized) — כי אותו עסק יכול להופיע עם כתובת מעט שונה
existing_names_set = {r["name"].strip().lower() for r in existing_raw if r.get("name")}
print(f"📦 {len(existing_names_set)} עסקים קיימים ב-Supabase")

# סינון מול Supabase
new_records = [r for r in records if r["name"].strip().lower() not in existing_names_set]
skipped_supabase = len(records) - len(new_records)

# dedup פנימי — הסר כפולים בתוך הקובץ עצמו (אם אותו שם מופיע פעמיים)
seen = set()
deduped = []
for r in new_records:
    key = r["name"].strip().lower()
    if key not in seen:
        seen.add(key)
        deduped.append(r)
skipped_internal = len(new_records) - len(deduped)
new_records = deduped

skipped = skipped_supabase + skipped_internal
print(f"⏭  {skipped_supabase} כפולים מ-Supabase + {skipped_internal} כפולים פנימיים = {skipped} סה\"כ ידולגו")
print(f"✅ {len(new_records)} חדשים יועלו")

if not new_records:
    print("אין מה להעלות — כל הרשומות כבר קיימות.")
    sys.exit(0)

# ── 3. יצירת upload_session ───────────────────────────────────────────────────
file_name = os.path.basename(EXCEL_PATH)
session_id = str(uuid.uuid4())
now_iso = datetime.now(timezone.utc).isoformat()

status_counts = {"suspicious": 0, "ok": 0, "unknown": 0}
for r in new_records:
    status_counts[r["arnona_status"]] = status_counts.get(r["arnona_status"], 0) + 1

session_payload = {
    "id":               session_id,
    "file_name":        file_name,
    "upload_date":      now_iso,
    "total_count":      len(new_records),
    "suspicious_count": status_counts["suspicious"],
    "ok_count":         status_counts["ok"],
    "unknown_count":    status_counts["unknown"],
    "skipped_count":    skipped,
    "business_ids":     [],   # נעדכן אחרי ההכנסה
}
supabase_post("upload_sessions", session_payload)
print(f"📁 סשן נוצר: {session_id}")

# ── 4. העלאת businesses ───────────────────────────────────────────────────────
inserted_ids = []
BATCH = 50

for i in range(0, len(new_records), BATCH):
    batch = new_records[i:i + BATCH]
    payload = []
    for r in batch:
        row_id = str(uuid.uuid4())
        inserted_ids.append(row_id)
        payload.append({
            "id":                  row_id,
            "name":                r["name"],
            "type":                r["type"],
            "address":             r["address"],
            "matched_address":     r["matched_address"],
            "property_owners":     r["property_owners"],
            "unit_count":          r["unit_count"],
            "suspicion_rating":    r["suspicion_rating"],
            "suspicion_detail":    r["suspicion_detail"],
            "no_suspicion_reason": r["no_suspicion_reason"],
            "link":                r["link"],
            "arnona_status":       r["arnona_status"],
            "upload_date":         now_iso,
            "upload_session_id":   session_id,
        })
    supabase_post("businesses", payload)
    print(f"  ↑ batch {i//BATCH + 1}: {len(batch)} רשומות הועלו")

# ── 5. עדכון business_ids בסשן ────────────────────────────────────────────────
patch_headers = {**HEADERS, "Prefer": "return=minimal"}
r = requests.patch(
    f"{SUPABASE_URL}/rest/v1/upload_sessions?id=eq.{session_id}",
    json={"business_ids": inserted_ids},
    headers=patch_headers,
)
r.raise_for_status()

# ── 6. סיכום ─────────────────────────────────────────────────────────────────
print("\n══════════════════════════════════")
print(f"✅ הועלו:    {len(inserted_ids)} רשומות חדשות")
print(f"⏭  דולגו:    {skipped} כפולים")
print(f"📊 suspicious: {status_counts['suspicious']} | ok: {status_counts['ok']} | unknown: {status_counts['unknown']}")
print(f"🆔 session_id: {session_id}")
print("══════════════════════════════════")
```

---

## הוראות שימוש לקלוד

1. **בקש מהמשתמש** את הנתיב המלא לקובץ Excel (אם לא סופק).
2. **בדוק אם הקובץ מועלה** — אם כן, הוא נמצא ב-`/mnt/user-data/uploads/`. השתמש בנתיב זה.
3. **הרץ את הסקריפט** דרך `bash_tool` עם `EXCEL_PATH` המתאים.
4. **הצג את הסיכום** למשתמש בעברית.

### טיפול בשגיאות נפוצות

| שגיאה | פתרון |
|---|---|
| `שורת כותרת לא נמצאה` | בדוק שהקובץ מכיל עמודה בשם בדיוק `שם העסק` |
| `401 Unauthorized` | בדוק שה-SUPABASE_KEY נכון |
| `403 Forbidden` | הסקריפט רץ מסביבה חסומה — יש להריץ ב-Claude Code בלבד |
| `409 Conflict` | כפיל ב-id — לא אמור לקרות כי הסקריפט מייצר UUID חדש |
| `openpyxl` לא מותקן | הסקריפט מתקין אוטומטית |

### קובץ Excel — שורת כותרת

הקובץ עשוי להכיל שורות כותרת לפני הנתונים (כגון כותרת הדוח, תאריך וכד').
הסקריפט סורק את כל השורות ומחפש את הראשונה שמכילה `שם העסק` (אחרי נרמול).

### אם המשתמש מבקש לראות את הנתונים לפני ההעלאה

הוסף לפני שלב 2 לולאת הדפסה שמציגה את 5 השורות הראשונות:
```python
print("\n🔎 5 שורות ראשונות:")
for r in records[:5]:
    print(f"  {r['name']} | {r['address']} | {r['arnona_status']}")
```
