---
name: arnona-upload
description: >
  דחיפת דוח נכסים חשודים ל-GitHub כדי שGitHub Actions יעלה אותו ל-Supabase.
  בשימוש בCCR Routine כדי למנוע בעיות עם Egress Gateway.
---

# arnona-upload — דחיפה ל-GitHub (Upload handled by GitHub Actions)

## מה הסקיל עושה

**כבר לא** ישירות upload לSupabase (בגלל Anthropic Egress Gateway restrictions).

במקום זאת:
1. קובץ הדוח כבר ב-`/tmp/report_final.xlsx`
2. דחוף את הקובץ ל-GitHub `reports/` folder
3. GitHub Actions workflow יזוהה את התוספת
4. GA יריץ את upload_to_supabase.py מ-GitHub's servers
5. GA יעלה את הנתונים ל-Supabase בהצלחה

## זרימה

1. **Report ממתינה ב:** `/tmp/report_final.xlsx`
2. **דחוף ל-GitHub:** `reports/דוח נכסים חשודים [DATE].xlsx`
3. **GitHub Actions detects:** Push ל-`reports/` folder
4. **GA runs:** `.github/workflows/upload-arnona.yml`
5. **GA uploads:** ישירות ל-Supabase (מ-GitHub's IP)
6. **Website updates:** https://urbandetective007.github.io/Arnona_Agent/

## הוראות ל-CCR Routine

**בסוף pipeline, הroutine צריך:**

1. **קרוא את הקובץ בתוך Python script**
2. **שלח ל-GitHub API** עם base64 encoding
3. **GitHub commit עדכון** יתרחש אוטומטית
4. **GitHub Actions** יזוהה ויריץ את workflow

**Python script:**

```python
import requests
import base64
import os
from datetime import datetime

# GitHub config (token will be read from environment)
GITHUB_TOKEN = os.environ.get('GITHUBB_TOKEN_PAT')  # Note: double B due to GitHub naming restrictions
if not GITHUB_TOKEN:
    raise ValueError("GITHUBB_TOKEN_PAT environment variable not set")
REPO = "urbandetective007/Arnona_Agent"
BRANCH = "main"
TODAY = datetime.now().strftime('%d.%m.%Y')

# Read files
with open('/tmp/report_final.xlsx', 'rb') as f:
    report_content = base64.b64encode(f.read()).decode()

with open('/tmp/businesses.xlsx', 'rb') as f:
    businesses_content = base64.b64encode(f.read()).decode()

# GitHub API headers
headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

# Upload דוח
report_path = f"reports/דוח נכסים חשודים {TODAY}.xlsx"
requests.put(
    f"https://api.github.com/repos/{REPO}/contents/{report_path}",
    json={
        "message": f"Auto: Arnona report {TODAY}",
        "content": report_content,
        "branch": BRANCH
    },
    headers=headers
).raise_for_status()

# Upload businesses
businesses_path = f"reports/עסקים חשודים מהאינטרנט {TODAY}.xlsx"
requests.put(
    f"https://api.github.com/repos/{REPO}/contents/{businesses_path}",
    json={
        "message": f"Auto: Businesses list {TODAY}",
        "content": businesses_content,
        "branch": BRANCH
    },
    headers=headers
).raise_for_status()

print("✅ Files uploaded to GitHub")
print("GitHub Actions will now upload to Supabase...")
```

**הroutine צריך להריץ את זה, ו-GitHub Actions יתעורר בעצמו!**

## מה GitHub Actions עושה

**Workflow file:** `.github/workflows/upload-arnona.yml`

כשקובץ חדש מופיע ב-`reports/` ודחוף ל-main:

1. ✅ GA מזהה את ה-push
2. ✅ GA מורידה את הrepo
3. ✅ GA מוצאת את הדוח העדכני
4. ✅ GA קוראת את הסודות (SUPABASE_URL, SUPABASE_KEY) מGitHub Secrets
5. ✅ GA מריצה את `upload-arnona.yml` script
6. ✅ Script מפרסר את Excel
7. ✅ Script בודקה כפולים ב-Supabase
8. ✅ Script מעלה עסקים חדשים בלבד
9. ✅ דוח מעודכן בSupabase
10. ✅ Website עדכון בעצמו

**כל זה בלי התערבות אנושית!** 🤖
