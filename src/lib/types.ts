export interface Business {
  id: string
  name: string
  type: string
  address: string
  neighborhood: string
  matchedAddress: string
  propertyOwners: string
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
  sentToInspector: 'נשלח לסוקר' | 'לא נשלח לסוקר' | null
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
