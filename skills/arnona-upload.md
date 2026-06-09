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

**בסוף pipeline, רק עשה את זה:**

```bash
# 1. סדר את תיקיית reports בתוך /tmp/repo
mkdir -p /tmp/repo/reports

# 2. העתק את הדוחות לתיקיה
cp /tmp/report_final.xlsx "/tmp/repo/reports/דוח נכסים חשודים $(date +%d.%m.%Y).xlsx"
cp /tmp/businesses.xlsx "/tmp/repo/reports/עסקים חשודים מהאינטרנט $(date +%d.%m.%Y).xlsx"
```

**זהו!** 

GitHub Actions workflow `commit-reports.yml` **אוטומטית:**
1. ✅ בודקה כל 10 דקות אם יש קבצים חדשים
2. ✅ מדחיפה אותם ל-main branch
3. ✅ `upload-arnona.yml` workflow עולה ל-Supabase
4. ✅ Website מתעדכנת

**100% אוטומטי ללא token issues!** 🤖

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
