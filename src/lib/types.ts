export interface Business {
  id: string
  name: string
  type: string
  address: string
  matchedAddress: string
  propertyOwners: string
  unitCount: string
  suspicionRating: string        // גבוה | בינוני | לא חשוד | דרוש בדיקה
  suspicionDetail: string
  noSuspicionReason: string
  link: string
  arnonaStatus: 'suspicious' | 'ok' | 'unknown'
  uploadDate: string
}
