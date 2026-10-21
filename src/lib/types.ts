export interface Business {
  id: string
  name: string
  type: string
  address: string
  neighborhood: string
  matchedAddress: string
  unitCount: string
  suspicionRating: string
  suspicionDetail: string
  noSuspicionReason: string
  link1: string
  link2: string
  link3: string
  arnonaStatus: 'suspicious' | 'ok' | 'unknown'
  uploadDate: string
  uploadSessionId: string
  sentToInspector: 'נשלח לסוקר' | 'לא נשלח לסוקר' | 'הוחלט לא לשלוח לסקר' | null
  surveyResultDetail: 'נמצא פער בסיווג' | 'נמצא פער שטח + סיווג' | 'נמצא פער שטח' | 'לא נמצא עסק/פער שטח' | null
  source: 'manual' | 'excel' | 'promotion'
}

export interface UploadSession {
  id: string
  fileName: string
  uploadDate: string
  totalCount: number
  suspiciousCount: number
  okCount: number
  unknownCount: number
  skippedCount: number
  businessIds: string[]
}

export function mapSuspicionRatingToStatus(rating: string): Business['arnonaStatus'] {
  const r = rating.trim()
  if (r === 'גבוה' || r === 'בינוני') return 'suspicious'
  if (r === 'לא חשוד') return 'ok'
  return 'unknown'
}

/** A file attached to a field report, stored in the private 'survey-files' bucket. */
export interface SurveyReportFile {
  path: string
  name: string
  type: string
  size: number
  /** Which upload field it came from: 'main' = קובץ, 'extra' = קבצים נוספים. */
  group: 'main' | 'extra'
}

/** The surveyor's in-app field report — the questions of the municipality's survey form. */
export interface SurveyReport {
  id: string
  businessId: string
  createdAt: string
  surveyDate: string
  surveyorName: string
  visitedAddress: string
  arnonaPropertyNumber: string
  spokeWith: string
  actualUse: string
  useDescription: string
  ownerInfo: string
  extraInfo: string
  /** The surveyor's verdict (gap type); written through to the property's surveyResultDetail by a DB trigger. */
  surveyResult: Business['surveyResultDetail']
  files: SurveyReportFile[]
  lat: number | null
  lon: number | null
  accuracyM: number | null
  /** How far the surveyor was from the property's stored location when reporting. */
  distanceM: number | null
}
