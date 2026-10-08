import type { Business } from './types'

// Surveyor-status and survey-result values, shared by every page that filters
// or shows them (כלל הנתונים, מפת נכסים). A null sentToInspector means the
// property was never sent; a null surveyResultDetail means no result yet.
export const NOT_SENT = 'לא נשלח לסוקר'
export const INSPECTOR_OPTIONS = ['נשלח לסוקר', NOT_SENT, 'הוחלט לא לשלוח לסקר'] as const
export const SURVEY_RESULT_OPTIONS = ['נמצא פער בסיווג', 'נמצא פער שטח + סיווג', 'נמצא פער שטח', 'לא נמצא עסק/פער שטח']
export const NO_SURVEY_RESULT = 'טרם התקבלה תוצאה'

export const inspectorStatus = (b: Business): string => b.sentToInspector ?? NOT_SENT
export const surveyResult = (b: Business): string => b.surveyResultDetail ?? NO_SURVEY_RESULT
