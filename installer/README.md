# חבילת התקנה — ארנו-נט לעירייה חדשה

כל עירייה מקבלת **התקנה נפרדת משלה**: ריפו משלה, פרויקט Supabase משלה ואתר משלה.
אין שום נתון משותף בין עיריות. כל מה שקושר את האתר לעיר מסוימת נמצא בקובץ אחד, `city.config.json`.

> **סטטוס:** שלבים 1–2 ו-5–6 עובדים כבר עכשיו. שלב 3 (מסד הנתונים) עדיין **חסר**: ברפו יש
> רק את המיגרציה של `business_types`. לפני ההתקנה הראשונה צריך להוציא מ-Supabase של ירושלים
> את הסכמה המלאה (ראו `docs/PRODUCT_REVIEW.md`, סעיף 2).

---

## מה צריך מהעירייה לפני שמתחילים

| פריט | למה |
|---|---|
| שם העיר בעברית ובאנגלית | חיפוש כתובות במפה, כותרות |
| שם הגוף ("עיריית X", "אגף הארנונה") | מסך הכניסה, דוחות |
| רשימת שכונות רשמית (אם יש) | הרשימה הסגורה של שדה "שכונה" |
| קובץ רחובות / נכסי ארנונה (לשימוש פנימי בלבד) | השוואה בין עסקים לנכסי מגורים |
| מי המשתמשים ובאילו תפקידים | עובד עירייה / סוקר שטח / מנהל אגף |
| הסכם עיבוד מידע + אישור אבטחת מידע | נכסי ארנונה הם מידע אישי |

---

## שלב 1 — ריפו חדש

1. יוצרים ריפו **פרטי** חדש מהמוצר (לא ממה שנמצא בריפו של ירושלים, ראו "מה לא להעתיק" למטה).
2. `npm ci`

## שלב 2 — הגדרת העיר

1. פותחים פרויקט Supabase חדש (רצוי באזור `eu-central-1` או באזור שהעירייה דורשת).
   מעתיקים מ-Project Settings → API את ה-URL ואת ה-`anon` key.
2. מריצים:

```bash
NODE_USE_ENV_PROXY=1 node installer/new-city.mjs \
  --city-he "חיפה" --city-en "Haifa" \
  --municipality "עיריית חיפה" \
  --supabase-url https://xxxx.supabase.co --anon-key eyJ... \
  --base-path /<שם-הריפו> \
  --neighborhoods
```

הסקריפט כותב את `city.config.json` (מרכז המפה וגבולות העיר מגיעים מ-OpenStreetMap).
עם `--neighborhoods` הוא גם יוצר את רשימת השכונות ומרכזיהן מ-OpenStreetMap.

3. **בודקים את רשימת השכונות עם העירייה.** הרשימה שמגיעה מ-OSM היא רק נקודת התחלה.
   כתיבים חלופיים נכנסים ל-`aliases` ב-`data/neighborhoods.json`.
   לשכונה שאין לה מרכז מריצים: `node scripts/neighborhood-centers.mjs`

## שלב 3 — מסד נתונים

1. ב-Supabase → SQL Editor מריצים את כל הקבצים ב-`supabase/migrations/` לפי הסדר.
2. Authentication → Users: יוצרים שלושה משתמשים עם סיסמה לכל אחד:
   `employee@arnona-agent.internal`, `surveyor@arnona-agent.internal`, `manager@arnona-agent.internal`

## שלב 4 — סודות ב-GitHub

Settings → Secrets → Actions: `SUPABASE_URL` ו-`SUPABASE_KEY` (משמשים את ה-workflow שמעלה דוחות).
את ה-relay ב-Vercel (אם משתמשים בו) מגדירים עם `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY`.
**את ה-service role key לא שמים אף פעם בקוד או ב-`city.config.json`.**

## שלב 5 — פריסה

Settings → Pages → Source: GitHub Actions. כל push ל-`main` בונה ומפרסם את האתר.
הכתובת תהיה `https://<user>.github.io/<base-path>/`.

## שלב 6 — בדיקת קבלה

- [ ] במסך הכניסה מופיע שם העירייה הנכונה
- [ ] כל אחד משלושת התפקידים מצליח להתחבר
- [ ] העלאת קובץ לדוגמה (פורמט: `AGENT_EXCEL_FORMAT.md`) מצליחה
- [ ] המפה נפתחת על העיר הנכונה והכתובות מתמקמות בתוכה
- [ ] פילוח השכונות מציג את שכונות העיר

---

## מה לא להעתיק לעירייה חדשה

אלה נתונים של ירושלים ואסור שיגיעו להתקנה של עיר אחרת:

- `reports/`: דוחות עם שמות בעלי נכסים
- `scripts/data/`: קובצי נכסי ארנונה
- `public/arnona_lookup.json`, `public/geocoded_addresses.json`
- `tools/neighborhoods/data/`: רחובות ירושלים ומטמוני מיקום
- `data/neighborhoods.json`, `data/neighborhood_centers.json` (נוצרים מחדש בשלב 2)
- `skills/jerusalem-business-search.md` (צריך גרסה לעיר החדשה)
