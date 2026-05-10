export interface Business {
  id: string
  name: string
  address: string
  type: string
  link: string
  arnonaStatus: 'suspicious' | 'ok' | 'unknown'
  uploadDate: string
}

export interface UploadStats {
  total: number
  suspicious: number
  ok: number
  unknown: number
}
