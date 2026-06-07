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

**בסוף pipeline, לפני סיום, הroutine צריך לעשות:**

```bash
# 1. סדר את הקבצים ב-repo
mkdir -p /tmp/repo/reports

# 2. העתק את הדוחות
cp /tmp/report_final.xlsx "/tmp/repo/reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
cp /tmp/businesses.xlsx "/tmp/repo/reports/עסקים חשודים מהאינטרנט $(date +%d.%m.%Y).xlsx"

# 3. דחוף ל-GitHub
cd /tmp/repo
git config user.name "CCR-Arnona-Agent"
git config user.email "ccr@anthropic.com"
git add reports/
git commit -m "Auto: Arnona report $(date +%d.%m.%Y)"
git push origin main
```

**זהו!** GitHub Actions ילכד את ה-push ויריץ את workflow `upload-arnona.yml` אוטומטית.

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
