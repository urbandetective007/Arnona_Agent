export interface Business {
  id: string
  name: string
  type: string
  address: string
  matchedAddress: string
  propertyOwners: string
  unitCount: string
  suspicionRating: string
  suspicionDetail: string
  noSuspicionReason: string
  link: string
  arnonaStatus: 'suspicious' | 'ok' | 'unknown'
  uploadDate: string
  uploadSessionId: string
}

export interface UploadSession {
  id: string
  fileName: string
  uploadDate: string
  totalCount: number
  suspiciousCount: number
  okCount: number
  unknownCount: number
  businessIds: string[]
}
