---
name: arnona-upload
description: >
  דחיפת דוח נכסים חשודים ל-GitHub (main) כדי שGitHub Actions יעלה אותו ל-Supabase.
  בשימוש בCCR Routine כדי למנוע בעיות עם Egress Gateway.
---

# arnona-upload — דחיפה ל-GitHub main (Upload handled by GitHub Actions)

## מה הסקיל עושה

1. קובץ הדוח כבר ב-`/tmp/report_final.xlsx`
2. דחוף ישירות ל-**main branch** ב-GitHub, תיקיית `reports/`
3. GitHub Actions workflow (`upload-arnona.yml`) יזהה את ה-push ל-main
4. GA יעלה את הנתונים ל-Supabase

## מעקב אינדקס — `reports/arnona_next_index.txt`

קובץ אחד פשוט עם מספר אחד:

```
903
```

**בתחילת כל ריצה** — קרא את האינדקס:

```python
import requests

url = "https://raw.githubusercontent.com/urbandetective007/Arnona_Agent/main/reports/arnona_next_index.txt"
start_index = int(requests.get(url, timeout=10).text.strip())
```

או אם הרppo כבר cloned:

```python
with open("/tmp/repo/reports/arnona_next_index.txt") as f:
    start_index = int(f.read().strip())
```

**בסוף כל ריצה** — עדכן את האינדקס עם המספר הבא:

```bash
echo "NEXT_INDEX" > reports/arnona_next_index.txt
```

## מה עולה ל-main בכל ריצה

שני קבצים בלבד:

| קובץ | תוכן |
|------|-------|
| `reports/arnona_next_index.txt` | המספר הבא שממנו להתחיל |
| `reports/דוח נכסים חשודים DD.MM.YYYY.xlsx` | דוח הריצה הנוכחית |

**לא עולה:** `__PROGRESS__*`, קבצי txt ישנים, שום דבר אחר.

## הוראות לסוף pipeline (CCR Routine)

```bash
cd /tmp/repo
git checkout main
git pull origin main --ff-only

# עדכן אינדקס (החלף NEXT_INDEX במספר הבא לסריקה)
echo "${NEXT_INDEX}" > reports/arnona_next_index.txt

# העתק דוח
cp /tmp/report_final.xlsx "reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"

# commit + push
git add reports/arnona_next_index.txt
git add "reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
git commit -m "pipeline: arnona idx ${NEXT_INDEX}, $(date +%d.%m.%Y)"
git push origin main
```

## הוראות לסוף pipeline (Claude Code Interactive Session)

```bash
cd /home/user/Arnona_Agent
git checkout main && git pull origin main --ff-only

echo "NEXT_INDEX" > reports/arnona_next_index.txt
git add reports/arnona_next_index.txt
git add "reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
git commit -m "pipeline: arnona idx NEXT_INDEX, $(date +%d.%m.%Y)"
git push origin main
```

## מה GitHub Actions עושה

כשקובץ `*.xlsx` חדש מופיע ב-`reports/` ודחוף ל-main:

1. `upload-arnona.yml` מופעל
2. GA מוצאת את הדוח העדכני
3. GA מעלה עסקים חדשים ל-Supabase (בדיקת כפולים אוטומטית)
4. Website מתעדכן
