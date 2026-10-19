import { JERUSALEM_NEIGHBORHOODS } from './neighborhoods'

// The columns of an uploaded report — one source for the upload page's column
// mapping, the format guide shown above the drop zone, and the downloadable
// template, so the three can't drift apart.

export type TargetField =
  | 'name' | 'address' | 'neighborhood' | 'type' | 'suspicionRating' | 'suspicionDetail'
  | 'noSuspicionReason' | 'matchedAddress' | 'unitCount' | 'link1' | 'link2' | 'link3'

export interface FieldDef {
  key: TargetField
  /** Column header, as it should appear in the file. */
  label: string
  required: boolean
  /** Matched against the file's headers (exact, or contained in a header). */
  hint: string
  /** What goes in the column — shown in the format guide. */
  description: string
  example: string
}

export const RATING_OPTIONS = ['גבוה', 'בינוני', 'לא חשוד', 'דרוש בדיקה']

export const FIELD_DEFS: FieldDef[] = [
  { key: 'name', label: 'שם העסק', required: true, hint: 'שם העסק', description: 'שם העסק כפי שהוא מוכר', example: 'מרפאת שיניים ד"ר כהן' },
  { key: 'address', label: 'כתובת', required: true, hint: 'כתובת', description: 'רחוב ומספר בית', example: 'עזה 12' },
  { key: 'neighborhood', label: 'שכונה', required: false, hint: 'שכונה', description: 'רק שם מרשימת השכונות; שם אחר נשמר בלי שכונה', example: 'רחביה' },
  { key: 'type', label: 'סוג עסק', required: false, hint: 'סוג עסק', description: 'חופשי — מותאם אוטומטית לרשימת הסוגים', example: 'מרפאת שיניים' },
  { key: 'suspicionRating', label: 'דירוג אינדיקציה', required: false, hint: 'דירוג אינדיקציה', description: `אחד מ: ${RATING_OPTIONS.join(' / ')}. ריק = דרוש בדיקה`, example: 'גבוה' },
  { key: 'suspicionDetail', label: 'פירוט האינדיקציה', required: false, hint: 'פירוט האינדיקציה', description: 'למה העסק חשוד', example: 'קליניקה פעילה בדירת מגורים' },
  { key: 'noSuspicionReason', label: 'סיבת אי-אינדיקציה', required: false, hint: 'סיבת אי-אינדיקציה', description: 'למה העסק לא חשוד (אם רלוונטי)', example: '' },
  { key: 'matchedAddress', label: 'כתובת תואמת במערכת הגבייה', required: false, hint: 'כתובת תואמת במערכת הגבייה', description: 'הכתובת כפי שהיא רשומה בגבייה', example: 'עזה 12 דירה 3' },
  { key: 'unitCount', label: "מס' דירות", required: false, hint: "מס' דירות", description: 'מספר יחידות דיור בבניין', example: '8' },
  { key: 'link1', label: 'קישור 1', required: false, hint: 'קישור 1', description: 'קישור מלא למקור (https://…)', example: 'https://example.co.il/dr-cohen' },
  { key: 'link2', label: 'קישור 2', required: false, hint: 'קישור 2', description: 'קישור נוסף', example: '' },
  { key: 'link3', label: 'קישור 3', required: false, hint: 'קישור 3', description: 'קישור נוסף', example: '' },
]

/** The format rules that matter most, in the order the guide lists them. */
export const FORMAT_RULES = [
  'רק הגיליון הראשון בקובץ נקרא — שימו את הנתונים בו.',
  'שורת הכותרות חייבת לכלול תא בשם "שם העסק" בדיוק. מותר שיהיו מעליה שורת כותרת או שורות ריקות.',
  'כל שורה מתחת לכותרות = עסק אחד. שורה בלי שם עסק או בלי כתובת לא תיובא.',
  `דירוג אינדיקציה — אחד מ: ${RATING_OPTIONS.join(' / ')}. אם ריק, יוגדר "דרוש בדיקה".`,
  'שכונה — רק שם מרשימת השכונות של המערכת. אם לא מזוהה, העסק יישמר בלי שכונה.',
  'עסק שכבר קיים במערכת (אותו שם ואותה כתובת) ידולג אוטומטית.',
]

const SECOND_EXAMPLE: Partial<Record<TargetField, string>> = {
  name: 'סטודיו לעיצוב שיער', address: 'הרב קוק 5', neighborhood: 'מרכז העיר', type: 'מספרה', suspicionRating: 'בינוני', unitCount: '12',
}

// ASCII on purpose: some browsers drop a non-Latin download name and save the
// file as "download" with no extension, which Excel then won't open.
const TEMPLATE_FILE_NAME = 'arnona-report-template.xlsx'

/**
 * Downloads an empty report template. The first sheet holds only the header
 * row — an example row left in by mistake would be imported as a real
 * business — and the example, neighborhood list and rules go on later sheets,
 * which the upload ignores.
 */
export async function downloadTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const data = XLSX.write(buildTemplate(XLSX), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = TEMPLATE_FILE_NAME
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The template workbook (see downloadTemplate). Takes the xlsx module, which callers load lazily. */
export function buildTemplate(XLSX: typeof import('xlsx')): import('xlsx').WorkBook {
  const headers = FIELD_DEFS.map(fd => fd.label)
  const widths = FIELD_DEFS.map(fd => ({ wch: Math.max(fd.label.length, fd.example.length, 12) + 2 }))

  const report = XLSX.utils.aoa_to_sheet([headers])
  report['!cols'] = widths

  const example = XLSX.utils.aoa_to_sheet([
    headers,
    FIELD_DEFS.map(fd => fd.example),
    FIELD_DEFS.map(fd => SECOND_EXAMPLE[fd.key] ?? ''),
  ])
  example['!cols'] = widths

  const neighborhoods = XLSX.utils.aoa_to_sheet([['שכונות מותרות'], ...[...JERUSALEM_NEIGHBORHOODS].sort((a, b) => a.localeCompare(b, 'he')).map(n => [n])])
  neighborhoods['!cols'] = [{ wch: 30 }]

  const rules = XLSX.utils.aoa_to_sheet([
    ['הנחיות למילוי'],
    ...FORMAT_RULES.map(r => [`• ${r}`]),
    [],
    ['עמודה', 'חובה', 'מה למלא'],
    ...FIELD_DEFS.map(fd => [fd.label, fd.required ? 'חובה' : 'רשות', fd.description]),
  ])
  rules['!cols'] = [{ wch: 28 }, { wch: 8 }, { wch: 60 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, report, 'דוח')
  XLSX.utils.book_append_sheet(wb, example, 'דוגמה')
  XLSX.utils.book_append_sheet(wb, neighborhoods, 'שכונות')
  XLSX.utils.book_append_sheet(wb, rules, 'הנחיות')
  wb.Workbook = { Views: [{ RTL: true }] }
  return wb
}
