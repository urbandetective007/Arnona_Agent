---
name: arnona-upload
description: >
  דחיפת דוח נכסים חשודים ל-GitHub (main) כדי שGitHub Actions יעלה אותו ל-Supabase.
  בשימוש בCCR Routine כדי למנוע בעיות עם Egress Gateway.
---

# arnona-upload — דחיפה ל-GitHub main (Upload handled by GitHub Actions)

## מה הסקיל עושה

**כבר לא** ישירות upload לSupabase (בגלל Anthropic Egress Gateway restrictions).

במקום זאת:
1. קובץ הדוח כבר ב-`/tmp/report_final.xlsx`
2. דחוף ישירות ל-**main branch** ב-GitHub, תיקיית `reports/`
3. GitHub Actions workflow (`upload-arnona.yml`) יזהה את ה-push ל-main
4. GA יעלה את הנתונים ל-Supabase בהצלחה

## ⚠️ כללים חשובים

| מה | לאן |
|----|-----|
| `דוח נכסים חשודים *.xlsx` | ✅ main branch → `reports/` |
| `עסקים חשודים מהאינטרנט *.xlsx` | ✅ main branch → `reports/` |
| `__PROGRESS__*` (כל סוג) | ❌ **לא** מועלה ל-repo כלל — רק ל-Supabase |

## זרימה

1. **Report ממתינה ב:** `/tmp/report_final.xlsx`
2. **דחוף ישירות ל-main:** `reports/דוח נכסים חשודים [DATE].xlsx`
3. **GitHub Actions detects:** Push ל-main עם `reports/*.xlsx`
4. **GA runs:** `.github/workflows/upload-arnona.yml`
5. **GA uploads:** ישירות ל-Supabase (מ-GitHub's IP)
6. **Website updates:** https://urbandetective007.github.io/Arnona_Agent/

## הוראות ל-CCR Routine

**בסוף pipeline, רק עשה את זה:**

```bash
# 1. עבור ל-main
cd /tmp/repo
git checkout main
git pull origin main --ff-only

# 2. העתק רק קבצי האקסל האמיתיים
cp /tmp/report_final.xlsx "/tmp/repo/reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
# (אם יש גם קובץ עסקים:)
# cp /tmp/businesses.xlsx "/tmp/repo/reports/עסקים חשודים מהאינטרנט $(date +%d.%m.%Y).xlsx"

# 3. commit + push ישירות ל-main
git add "reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
git commit -m "pipeline: arnona report $(date +%d.%m.%Y)"
git push origin main
```

**לא להוסיף** קבצי `__PROGRESS__` ל-`git add`.  
מחוון ההתקדמות נשמר **רק ב-Supabase** (טבלת `upload_sessions`), לא ב-repo.

**זהו!**

`upload-arnona.yml` workflow עולה אוטומטית ל-Supabase בזיהוי ה-push.

## הוראות ל-Claude Code Interactive Session

כשאינך ב-CCR Routine אלא בסשן אינטראקטיבי:

```bash
cd /home/user/Arnona_Agent

# וודא שאתה על main
git checkout main
git pull origin main --ff-only

# הוסף רק את קובץ הדוח
git add "reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
git commit -m "pipeline: arnona report $(date +%d.%m.%Y)"
git push origin main
```

## מה GitHub Actions עושה

**Workflow file:** `.github/workflows/upload-arnona.yml`

כשקובץ `*.xlsx` חדש מופיע ב-`reports/` ודחוף ל-main:

1. ✅ GA מזהה את ה-push
2. ✅ GA מורידה את הrepo
3. ✅ GA מוצאת את הדוח העדכני
4. ✅ GA קוראת את הסודות (SUPABASE_URL, SUPABASE_KEY) מGitHub Secrets
5. ✅ Script מפרסר את Excel
6. ✅ Script בודקת כפולים ב-Supabase
7. ✅ Script מעלה עסקים חדשים בלבד
8. ✅ דוח מעודכן בSupabase
9. ✅ Website מתעדכן אוטומטית

**כל זה בלי התערבות אנושית!**
