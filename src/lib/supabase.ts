import { createClient } from '@supabase/supabase-js'
import type { Business, UploadSession } from './types'
import { SUPABASE_CONFIG } from './city'

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToBusiness(row: any): Business {
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? '',
    address: row.address ?? '',
    neighborhood: row.neighborhood ?? '',
    matchedAddress: row.matched_address ?? '',
    unitCount: row.unit_count ?? '',
    suspicionRating: row.suspicion_rating || 'דרוש בדיקה',
    suspicionDetail: row.suspicion_detail ?? '',
    noSuspicionReason: row.no_suspicion_reason ?? '',
    link1: row.link1 ?? '',
    link2: row.link2 ?? '',
    link3: row.link3 ?? '',
    arnonaStatus: row.arnona_status ?? 'unknown',
    uploadDate: row.upload_date ?? '',
    uploadSessionId: row.upload_session_id ?? '',
    sentToInspector: row.sent_to_inspector ?? null,
    surveyResultDetail: row.survey_result_detail ?? null,
    source: row.source === 'manual' ? 'manual' : 'excel',
  }
}

export function businessToDb(b: Business) {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    address: b.address,
    neighborhood: b.neighborhood,
    matched_address: b.matchedAddress,
    unit_count: b.unitCount,
    suspicion_rating: b.suspicionRating,
    suspicion_detail: b.suspicionDetail,
    no_suspicion_reason: b.noSuspicionReason,
    link1: b.link1,
    link2: b.link2,
    link3: b.link3,
    arnona_status: b.arnonaStatus,
    upload_date: b.uploadDate,
    upload_session_id: b.uploadSessionId,
    sent_to_inspector: b.sentToInspector,
    survey_result_detail: b.surveyResultDetail,
    source: b.source,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToSession(row: any): UploadSession {
  return {
    id: row.id,
    fileName: row.file_name,
    uploadDate: row.upload_date,
    totalCount: row.total_count,
    suspiciousCount: row.suspicious_count,
    okCount: row.ok_count,
    unknownCount: row.unknown_count,
    skippedCount: row.skipped_count ?? 0,
    businessIds: row.business_ids ?? [],
  }
}

export function sessionToDb(s: UploadSession) {
  return {
    id: s.id,
    file_name: s.fileName,
    upload_date: s.uploadDate,
    total_count: s.totalCount,
    suspicious_count: s.suspiciousCount,
    ok_count: s.okCount,
    unknown_count: s.unknownCount,
    skipped_count: s.skippedCount,
    business_ids: s.businessIds,
  }
}
