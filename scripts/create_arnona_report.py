"""
create_arnona_report.py
Cross-references businesses Excel with arnona (property tax) data
and produces a suspect-report Excel.

Expected to run from the repo root:
  python scripts/create_arnona_report.py \
      --businesses <path-to-businesses.xlsx> \
      --arnona     scripts/data/arnona_data.xlsx \
      --output     <path-to-output.xlsx>
"""
import sys
import subprocess

for pkg in ["openpyxl", "pandas"]:
    try:
        __import__(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--quiet"])

import argparse
import re
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import date

# ── CLI ──────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--businesses", required=True)
parser.add_argument("--arnona",     default="scripts/data/arnona_data.xlsx")
parser.add_argument("--output",     required=True)
args = parser.parse_args()

# ── Load files ────────────────────────────────────────────────────────────────
arnona     = pd.read_excel(args.arnona)
businesses = pd.read_excel(args.businesses)

# ── Parse addresses ───────────────────────────────────────────────────────────
def parse_address(addr):
    addr = str(addr).strip().split(',')[0].strip()
    m = re.search(r'^(.*?)\s+(\d+[א-ת]?)\s*$', addr)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return addr, ''

arnona['street'], arnona['num'] = zip(*arnona['כתובת'].map(parse_address))

# ── Address corrections ───────────────────────────────────────────────────────
address_corrections = {
    'הפלמ"ח 21':              ('הפלמח', '21'),
    "הרב אבידע 5":             ('אבידע', '5'),
    'בית"ר 2':                 ('ביתר', '2'),
    'דוד מרץ 33':              ('מרץ דוד', '33'),
    'שלומציון המלכה 7':        ('שלומציון', '7'),
    'אליעזר בן יהודה 10':      ('בן יהודה', '10'),
    "שד' הרצל 9":              ('שד הרצל', '9'),
    'בורכוב 63':               ('בורכוב', '63'),
    'יגאל אלון 35':            ('יגאל אלון', '35'),
    'גולדה מאיר 1':            ('גולדה מאיר', '1'),
    'יחזקאל 1':                ('יחזקאל', '1'),
    'יפו 33':                  ('יפו', '33'),
    'הכפיר 7':                 ('הכפיר', '7'),
    'עין כרם 54':              ('עין כרם', '54'),
    'דיסקין 9':                ('דיסקין', '9'),
    'יפו 216':                 ('יפו', '216'),
    'כנפי נשרים 62':           ('כנפי נשרים', '62'),
    'משה דיין 72':             ('משה דיין', '72'),
}

def find_matches(biz_address, arnona_df, corrections):
    raw = str(biz_address).strip().split(',')[0].strip()
    if raw in corrections:
        street, num = corrections[raw]
    else:
        street, num = parse_address(raw)
    matches = arnona_df[(arnona_df['street'] == street) & (arnona_df['num'] == num)]
    if len(matches) > 0:
        return matches['כתובת'].iloc[0], matches
    return None, pd.DataFrame()

COMMON_BIZ_WORDS = {
    'בית', 'של', 'ושות', 'משרד', 'מרפאת', 'מרפאה', 'רפואי', 'רופא',
    'ירושלים', 'עורכי', 'עורך', 'דין', 'חשבון', 'רואה', 'רואי',
    'שיניים', 'וטרינרי', 'וטרינרית', 'כללית', 'קרית', 'יובל',
    'סמייל', 'רמות', 'אלון', 'מרכז', 'רפואה', 'בריאות', 'קליניקה',
}

def check_name_match(biz_name, owners_list):
    biz_words = {w for w in re.findall(r'[א-ת]+', str(biz_name)) if len(w) > 2}
    biz_words -= COMMON_BIZ_WORDS
    if not biz_words:
        return False, None
    for owner in owners_list:
        owner_words = set(re.findall(r'[א-ת]+', str(owner)))
        if biz_words & owner_words:
            return True, str(owner).strip()
    return False, None

# ── Compute results ───────────────────────────────────────────────────────────
results = []
for _, biz in businesses.iterrows():
    biz_name = biz['שם העסק']
    biz_addr = biz['כתובת']
    biz_type = biz['סוג עסק']
    biz_url  = biz.get('קישור למקור', '')

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
        'סוג העסק': biz_type,
        'כתובת': biz_addr,
        'כתובת תואמת (מהעירייה)': matched_addr or 'לא נמצאה',
        'שמות בעלי נכסים באותה כתובת': ', '.join(owners_clean),
        'מספר דירות בכתובת': num_units if num_units > 0 else 'לא ידוע',
        'דירוג חשד': rating,
        'פירוט החשד': detail,
        'סיבת אי-חשד': no_suspect_reason,
        'מקור המידע (URL)': biz_url,
    })

# ── Sort ──────────────────────────────────────────────────────────────────────
order = {'גבוה': 0, 'בינוני': 1, 'לא חשוד': 2, 'דרוש בדיקה': 3}
df_out = pd.DataFrame(results)
df_out['_sort'] = df_out['דירוג חשד'].map(order)
df_out = df_out.sort_values('_sort').drop(columns=['_sort']).reset_index(drop=True)

# ── Build Excel ───────────────────────────────────────────────────────────────
wb = Workbook()
ws = wb.active
ws.title = 'דוח נכסים חשודים'
ws.sheet_view.rightToLeft = True

COLS = list(df_out.columns)
NUM_COLS = len(COLS)

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

ws.row_dimensions[1].height = 36
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=NUM_COLS)
tc = ws.cell(row=1, column=1)
tc.value = 'דוח עסקים חשודים בנכסי מגורים – עיריית ירושלים'
tc.font  = Font(name='Arial', bold=True, size=16, color=COLOR_HEADER_FG)
tc.fill  = PatternFill('solid', fgColor=COLOR_HEADER_BG)
tc.alignment = Alignment(horizontal='center', vertical='center', readingOrder=2)

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
    ('שיטת התאמה', 'התאמת כתובות לפי שם רחוב + מספר בית.'),
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
    elif a == 'מקורות נתונים':
        ca.font = Font(name='Arial', bold=True, size=11)
        ca.fill = PatternFill('solid', fgColor='E0E8FF')
        ws2.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=2)
    else:
        ca.font = cb.font = Font(name='Arial', size=10)
        cb.alignment = Alignment(wrap_text=True, readingOrder=2)

wb.save(args.output)
print(f"Saved report: {args.output}")
print(f"Total: {len(df_out)} | High: {counts.get('גבוה',0)} | Not suspect: {counts.get('לא חשוד',0)} | Needs check: {counts.get('דרוש בדיקה',0)}")
