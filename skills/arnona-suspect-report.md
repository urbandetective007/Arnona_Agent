---
name: arnona-suspect-report
description: >
  זיהוי עסקים החשודים בתשלום ארנונת מגורים במקום ארנונת עסקים – ירושלים.
  השתמש בסקיל הזה בכל פעם שיש שני קבצים: קובץ עסקים חשודים (עם עמודות שם העסק, כתובת, סוג עסק, קישור)
  וקובץ נכסי ארנונה (עם עמודות כתובת, שם בעל הנכס, מגורים או לא מגורים),
  והמשתמש רוצה לאמת אילו עסקים פועלים מנכסי מגורים ולייצר דוח אקסל מסווג.
  הסקיל מפיק קובץ Excel מעוצב עם דירוג חשד לכל עסק, שמות בעלי נכסים, ומספר יחידות בכתובת.
---

# דוח עסקים חשודים – ארנונה ירושלים

## מה הסקיל עושה

מקבל שני קבצי Excel:
1. **קובץ עסקים חשודים** – עסקים שנאספו מהאינטרנט, עם כתובות
2. **קובץ נכסי ארנונה** – כל נכסי העירייה עם סיווג מגורים / לא מגורים

מוצלב בין הקבצים לפי כתובת, מחשב דירוג חשד לכל עסק, ומייצר קובץ Excel מעוצב עם צבעי דירוג.

---

## קבצי קלט נדרשים

| קובץ | עמודות חובה |
|------|-------------|
| עסקים חשודים | `שם העסק`, `כתובת`, `סוג עסק`, `קישור למקור` |
| נכסי ארנונה  | `כתובת`, `שם בעל הנכס`, `מגורים או לא מגורים` |

---

## דירוגי חשד

| דירוג | תנאי | צבע שורה |
|-------|------|-----------|
| **גבוה** | כתובת נמצאה, כל היחידות מגורים | אדום קל `FFE0E0` |
| **בינוני** | כתובת נמצאה, כל היחידות מגורים, התאמה חלקית בשם | צהוב קל `FFFFF0` |
| **לא חשוד** | יש יחידת "לא מגורים" בכתובת, או שם עסק תואם שם בעל נכס | ירוק קל `E8F5E9` |
| **דרוש בדיקה** | כתובת לא נמצאה בנתוני העירייה | תכלת קל `D6F0FF` |

סדר הצגה בקובץ הפלט: גבוה → בינוני → לא חשוד → דרוש בדיקה

---

## עמודות פלט

1. שם העסק
2. סוג העסק
3. כתובת
4. כתובת תואמת (מהעירייה)
5. שמות בעלי נכסים באותה כתובת
6. מספר דירות בכתובת
7. דירוג חשד
8. פירוט החשד
9. סיבת אי-חשד
10. מקור המידע (URL)

---

## הוראות ביצוע

### שלב 1 – קרא את הקבצים והבן את המבנה

```python
import pandas as pd
arnona = pd.read_excel('<path_to_arnona>')
businesses = pd.read_excel('<path_to_businesses>')
print(arnona.columns.tolist())
print(businesses.columns.tolist())
print(arnona.head(3))
```

ודא שעמודות החובה קיימות. אם שמות עמודות שונים – התאם.

### שלב 2 – נרמול כתובות

פרסר כתובת לשם רחוב + מספר בית:

```python
import re

def parse_address(addr):
    addr = str(addr).strip()
    m = re.search(r'^(.*?)\s+(\d+[א-ת]?)\s*$', addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return addr, ''

arnona['street'], arnona['num'] = zip(*arnona['כתובת'].map(parse_address))
```

### שלב 3 – בנה מילון תיקוני כתובות

לפני ההתאמה, בדוק אם יש כתובות שאינן נמצאות ואולי צריכות תיקון שם רחוב.
בדוק עם:

```python
for addr in businesses['כתובת']:
    street, num = parse_address(addr)
    matches = arnona[(arnona['street'] == street) & (arnona['num'] == num)]
    if len(matches) == 0:
        # נסה לאתר וריאנטים קרובים
        candidates = arnona[arnona['street'].str.contains(street.split()[0], na=False)]['street'].unique()
        print(f"לא נמצא: {addr} | וריאנטים: {candidates[:5]}")
```

הוסף תיקונים ידניים למילון:
```python
address_corrections = {
    'שם כתובת מקורי': ('שם רחוב מתוקן', 'מספר'),
    # ...
}
```

### שלב 4 – פונקציית התאמה + בדיקת שם

```python
def find_matches(biz_address, arnona_df, corrections):
    biz_address = str(biz_address).strip()
    if biz_address in corrections:
        street, num = corrections[biz_address]
    else:
        street, num = parse_address(biz_address)
    matches = arnona_df[(arnona_df['street'] == street) & (arnona_df['num'] == num)]
    if len(matches) > 0:
        return matches['כתובת'].iloc[0], matches
    return None, pd.DataFrame()

def check_name_match(biz_name, owners_list):
    """מחזיר True אם מילה מהשם (>2 תווים) מופיעה בשם בעל נכס"""
    biz_words = {w for w in re.findall(r'[א-ת]+', str(biz_name)) if len(w) > 2}
    for owner in owners_list:
        owner_words = set(re.findall(r'[א-ת]+', str(owner)))
        if biz_words & owner_words:
            return True, owner.strip()
    return False, None
```

### שלב 5 – חשב דירוג לכל עסק

```python
results = []
for _, biz in businesses.iterrows():
    biz_name = biz['שם העסק']
    biz_addr = biz['כתובת']

    matched_addr, matches = find_matches(biz_addr, arnona, address_corrections)
    owners_clean = [str(o).strip() for o in matches['שם בעל הנכס'].tolist()] if len(matches) > 0 else []
    num_units = len(matches)

    if num_units == 0:
        rating = 'דרוש בדיקה'
        detail = f'כתובת "{biz_addr}" לא נמצאה בנתוני העירייה.'
        no_suspect_reason = ''
    else:
        types = matches['מגורים או לא מגורים'].value_counts().to_dict()
        has_non_res = 'לא מגורים' in types
        name_match, matched_owner = check_name_match(biz_name, owners_clean)

        if has_non_res or name_match:
            rating = 'לא חשוד'
            detail = ''
            reasons = []
            if has_non_res:
                reasons.append(f'קיימות {types["לא מגורים"]} יחידות "לא מגורים" מתוך {num_units}')
            if name_match:
                reasons.append(f'שם העסק תואם לבעל נכס: "{matched_owner}"')
            no_suspect_reason = '; '.join(reasons)
        else:
            rating = 'גבוה'
            detail = (f'כל {num_units} היחידות מסווגות "מגורים". '
                      f'העסק עשוי לפעול מדירת מגורים ללא סיווג מתאים.')
            no_suspect_reason = ''

    results.append({
        'שם העסק': biz_name,
        'סוג העסק': biz['סוג עסק'],
        'כתובת': biz_addr,
        'כתובת תואמת (מהעירייה)': matched_addr or 'לא נמצאה',
        'שמות בעלי נכסים באותה כתובת': ', '.join(owners_clean),
        'מספר דירות בכתובת': num_units or 'לא ידוע',
        'דירוג חשד': rating,
        'פירוט החשד': detail,
        'סיבת אי-חשד': no_suspect_reason,
        'מקור המידע (URL)': biz['קישור למקור'],
    })
```

### שלב 6 – מיון

```python
order = {'גבוה': 0, 'בינוני': 1, 'לא חשוד': 2, 'דרוש בדיקה': 3}
df_out = pd.DataFrame(results)
df_out['_sort'] = df_out['דירוג חשד'].map(order)
df_out = df_out.sort_values('_sort').drop(columns=['_sort']).reset_index(drop=True)
```

### שלב 7 – בנה קובץ Excel מעוצב

ראה `scripts/build_excel.py` להפעלה ישירה, או הכנס את הלוגיקה הבאה:

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = 'דוח נכסים חשודים'
ws.sheet_view.rightToLeft = True

COLS = list(df_out.columns)
NUM_COLS = len(COLS)

# צבעים
COLOR_HEADER_BG = '1F3864'
COLOR_HEADER_FG = 'FFFFFF'
rating_colors = {
    'גבוה':        ('C00000', 'FFE0E0'),
    'בינוני':      ('B8860B', 'FFFFF0'),
    'לא חשוד':     ('006400', 'E8F5E9'),
    'דרוש בדיקה': ('005F8A', 'D6F0FF'),
}

thin  = Side(style='thin',   color='BDBDBD')
thick = Side(style='medium', color='9E9E9E')
border_all    = Border(left=thin,  right=thin,  top=thin,  bottom=thin)
border_header = Border(left=thick, right=thick, top=thick, bottom=thick)

# שורת כותרת (row 1)
ws.row_dimensions[1].height = 36
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=NUM_COLS)
tc = ws.cell(row=1, column=1)
tc.value = 'דוח עסקים חשודים בנכסי מגורים – עיריית ירושלים'
tc.font  = Font(name='Arial', bold=True, size=16, color=COLOR_HEADER_FG)
tc.fill  = PatternFill('solid', fgColor=COLOR_HEADER_BG)
tc.alignment = Alignment(horizontal='center', vertical='center', readingOrder=2)

# שורת סיכום (row 2)
counts = df_out['דירוג חשד'].value_counts()
ws.row_dimensions[2].height = 22
ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=NUM_COLS)
summary = (f'סה"כ עסקים שנבדקו: {len(df_out)}   |   '
           f'חשד גבוה: {counts.get("גבוה",0)}   |   '
           f'חשד בינוני: {counts.get("בינוני",0)}   |   '
           f'לא חשוד: {counts.get("לא חשוד",0)}   |   '
           f'דרוש בדיקה: {counts.get("דרוש בדיקה",0)}')
sc = ws.cell(row=2, column=1, value=summary)
sc.font  = Font(name='Arial', size=11, color='444444')
sc.fill  = PatternFill('solid', fgColor='E8EEFF')
sc.alignment = Alignment(horizontal='center', vertical='center', readingOrder=2)

# שורת כותרות עמודות (row 3)
header_display = {
    'שם העסק': 'שם העסק',
    'סוג העסק': 'סוג העסק',
    'כתובת': 'כתובת',
    'כתובת תואמת (מהעירייה)': 'כתובת תואמת\n(מהעירייה)',
    'שמות בעלי נכסים באותה כתובת': 'שמות בעלי נכסים\nבאותה כתובת',
    'מספר דירות בכתובת': "מס' דירות\nבכתובת",
    'דירוג חשד': 'דירוג חשד',
    'פירוט החשד': 'פירוט החשד',
    'סיבת אי-חשד': 'סיבת אי-חשד',
    'מקור המידע (URL)': 'מקור המידע\n(URL)',
}
ws.row_dimensions[3].height = 32
for c_idx, col in enumerate(COLS, start=1):
    cell = ws.cell(row=3, column=c_idx, value=header_display.get(col, col))
    cell.font  = Font(name='Arial', bold=True, size=11, color=COLOR_HEADER_FG)
    cell.fill  = PatternFill('solid', fgColor=COLOR_HEADER_BG)
    cell.alignment = Alignment(horizontal='center', vertical='center',
                                wrap_text=True, readingOrder=2)
    cell.border = border_header

# שורות נתונים (row 4+) – כל שורה בצבע הדירוג שלה
for r_idx, row in df_out.iterrows():
    excel_row = r_idx + 4
    ws.row_dimensions[excel_row].height = 52
    rating = row['דירוג חשד']
    fg, bg = rating_colors.get(rating, ('000000', 'FFFFFF'))

    for c_idx, col in enumerate(COLS, start=1):
        cell = ws.cell(row=excel_row, column=c_idx, value=row[col])
        cell.font   = Font(name='Arial', size=10)
        cell.border = border_all
        cell.fill   = PatternFill('solid', fgColor=bg)
        cell.alignment = Alignment(horizontal='right', vertical='top',
                                    wrap_text=True, readingOrder=2)
        if col == 'דירוג חשד':
            cell.font = Font(name='Arial', size=11, bold=True, color=fg)
            cell.alignment = Alignment(horizontal='center', vertical='center',
                                        wrap_text=False, readingOrder=2)

# רוחב עמודות
col_widths = {
    'שם העסק': 22, 'סוג העסק': 20, 'כתובת': 18,
    'כתובת תואמת (מהעירייה)': 18,
    'שמות בעלי נכסים באותה כתובת': 40,
    'מספר דירות בכתובת': 12, 'דירוג חשד': 13,
    'פירוט החשד': 48, 'סיבת אי-חשד': 40, 'מקור המידע (URL)': 30,
}
for c_idx, col in enumerate(COLS, start=1):
    ws.column_dimensions[get_column_letter(c_idx)].width = col_widths.get(col, 15)

ws.freeze_panes = 'A4'
ws.auto_filter.ref = f'A3:{get_column_letter(NUM_COLS)}3'
```

#### גיליון מקרא (גיליון שני)

```python
ws2 = wb.create_sheet('מקרא ומתודולוגיה')
ws2.sheet_view.rightToLeft = True
ws2.column_dimensions['A'].width = 20
ws2.column_dimensions['B'].width = 60

legend_data = [
    ('דוח עסקים חשודים בנכסי מגורים – מתודולוגיה', ''),
    ('', ''),
    ('דירוג חשד', 'הסבר'),
    ('גבוה',        'כתובת נמצאה, וכל הדירות מסווגות "מגורים". אין אף נכס "לא מגורים" בבניין.'),
    ('בינוני',      'כתובת נמצאה, כל הדירות "מגורים", אך ישנה התאמה חלקית בשם העסק/בעלים.'),
    ('לא חשוד',     'קיימת יחידה "לא מגורים" לפחות, או שם בעל הנכס תואם לשם העסק.'),
    ('דרוש בדיקה', 'כתובת לא נמצאה בנתוני העירייה – נדרשת בדיקה ידנית.'),
    ('', ''),
    ('סדר הצגה', 'גבוה → בינוני → לא חשוד → דרוש בדיקה'),
    ('', ''),
    ('מקורות נתונים', ''),
    ('שיטת התאמה', 'התאמת כתובות לפי שם רחוב + מספר בית (עם תיקונים ידניים לשמות שונים).'),
    ('בדיקת שם', 'אם מילה מהשם של העסק (>2 תווים) מופיעה בשם בעל נכס – הדירוג יורד ל"לא חשוד".'),
]

for r_idx, (a, b) in enumerate(legend_data, start=1):
    ca = ws2.cell(row=r_idx, column=1, value=a)
    cb = ws2.cell(row=r_idx, column=2, value=b)
    ws2.row_dimensions[r_idx].height = 22
    if r_idx == 1:
        ca.font  = Font(name='Arial', bold=True, size=14, color=COLOR_HEADER_FG)
        ca.fill  = PatternFill('solid', fgColor=COLOR_HEADER_BG)
        ws2.merge_cells(start_row=1, start_column=1, end_row=1, end_column=2)
        ca.alignment = Alignment(horizontal='center', readingOrder=2)
    elif a == 'דירוג חשד':
        for c in [ca, cb]:
            c.font = Font(name='Arial', bold=True, size=11)
            c.fill = PatternFill('solid', fgColor='D0D0D0')
    elif a in rating_colors:
        fg2, bg2 = rating_colors[a]
        ca.font  = Font(name='Arial', bold=True, color=fg2)
        ca.fill  = PatternFill('solid', fgColor=bg2)
        cb.fill  = PatternFill('solid', fgColor=bg2)
        cb.alignment = Alignment(wrap_text=True, readingOrder=2)
    elif a in ('מקורות נתונים',):
        ca.font = Font(name='Arial', bold=True, size=11)
        ca.fill = PatternFill('solid', fgColor='E0E8FF')
        ws2.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=2)
    else:
        ca.font = cb.font = Font(name='Arial', size=10)
        cb.alignment = Alignment(wrap_text=True, readingOrder=2)

wb.save(output_path)
```

---

## הפעלה ישירה

להפעלה מלאה של הסקריפט המוכן, ראה `scripts/build_excel.py`.
הפעל עם:

```bash
python scripts/build_excel.py \
  --arnona <path_to_arnona.xlsx> \
  --businesses <path_to_businesses.xlsx> \
  --output <output_path.xlsx>
```

---

## הערות חשובות

- **`Alignment(readingOrder=2)`** – חובה לכל תאי RTL (לא `reading_order`)
- **כתובות לא נמצאות** – בדוק אם שם הרחוב כולל "הרב", "שד", "שלומציון" בגרסאות שונות
- **בדיקת שם** – רגישה: כל מילה >2 תווים מספיקה. שמות פרטיים נפוצים (מתן, דוד) עלולים לגרום לתוצאות false positive – שקול להוסיף רשימת מילים להתעלמות
- **דירוג "בינוני"** – כרגע הלוגיקה לא מייצרת אותו אוטומטית; יש להוסיף תנאי מפורש אם רוצים לחלק בין גבוה לבינוני לפי קריטריון נוסף
