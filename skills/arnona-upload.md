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

## סקריפט Python — עם Vercel Relay

**שימוש: ה-routine יריץ:**

```bash
python /tmp/repo/scripts/upload_to_supabase_relay.py \
  --report <path-to-report.xlsx> \
  --relay-url "https://arnona-agent-ks3j.vercel.app"
```

**הסקריפט עושה:**

1. מנתח את קובץ Excel
2. מעביר את הנתונים ל-Vercel relay function
3. ה-Vercel relay בתורו:
   - בודק כפולים מול Supabase
   - יוצר upload_sessions record
   - מעלה את businesses לSupabase

**יתרון:** ה-Vercel relay עוקף את בעיית ה-IP allowlist של CCR - הוא רץ מ-Vercel IPs שמאושרות ב-Supabase.

```python
#!/usr/bin/env python3
"""
upload_to_supabase_relay.py
Uploads report to Supabase via Vercel relay (CCR-friendly).
"""
import subprocess
import sys

for pkg in ["openpyxl", "requests"]:
    try:
        __import__(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--quiet"])

import argparse
import openpyxl
import requests
import uuid
import os
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
parser.add_argument("--report", required=True)
parser.add_argument("--relay-url", required=True)
args = parser.parse_args()

def map_status(val):
    v = (val or "").strip()
    if v in ("גבוה", "בינוני"):
        return "suspicious"
    if v == "לא חשוד":
        return "ok"
    return "unknown"

def normalize_col(s):
    return " ".join(str(s).split()) if s else ""

COL_ALIASES = {
    "כתובת תואמת":     ["כתובת תואמת (מהעירייה)", "כתובת תואמת"],
    "שמות בעלי נכסים": ["שמות בעלי נכסים באותה כתובת", "שמות בעלי נכסים"],
    "מס' דירות":       ["מס' דירות בכתובת", "מספר דירות בכתובת", "מס' דירות"],
    "מקור/URL":        ["מקור המידע (URL)", "מקור/URL", "מקור המידע"],
}

def resolve_col(col_map, canonical_name):
    if canonical_name in col_map:
        return col_map[canonical_name]
    for alias in COL_ALIASES.get(canonical_name, []):
        if normalize_col(alias) in col_map:
            return col_map[normalize_col(alias)]
    return None

# Parse Excel
wb = openpyxl.load_workbook(args.report, data_only=True)
ws = wb.active

header_row_idx = None
for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
    normalized = [normalize_col(v) for v in row]
    if "שם העסק" in normalized:
        header_row_idx = i
        col_map = {normalize_col(v): j for j, v in enumerate(row) if v}
        break

if header_row_idx is None:
    raise ValueError("Header row not found")

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

print(f"Total records: {len(records)}")

if not records:
    print("No records to upload.")
    sys.exit(0)

# Prepare for relay
file_name = os.path.basename(args.report)
session_id = str(uuid.uuid4())
now_iso = datetime.now(timezone.utc).isoformat()

status_counts = {"suspicious": 0, "ok": 0, "unknown": 0}
for r in records:
    status_counts[r["arnona_status"]] = status_counts.get(r["arnona_status"], 0) + 1

# Add IDs to records
for r in records:
    r["id"] = str(uuid.uuid4())

# Send to relay
print(f"Uploading {len(records)} records via relay...")
try:
    relay_response = requests.post(
        f"{args.relay_url.rstrip('/')}/api/upload",
        json={
            "session_id": session_id,
            "file_name": file_name,
            "businesses": records,
            "upload_date": now_iso,
            "status_counts": status_counts,
        },
        timeout=120,
    )
    relay_response.raise_for_status()
    result = relay_response.json()
    
    print(f"✅ Upload successful!")
    print(f"Uploaded: {result.get('uploaded', len(records))}")
    print(f"Skipped (duplicates): {result.get('skipped', 0)}")
    print(f"Session ID: {session_id}")
    print("DONE")
    
except requests.exceptions.RequestException as e:
    print(f"❌ Relay error: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Response: {e.response.text}")
    sys.exit(1)
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
