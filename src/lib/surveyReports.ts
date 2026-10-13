import { supabase } from './supabase'
import { fetchAllRows } from './fetchAll'
import type { SurveyReport, SurveyReportFile } from './types'

// The surveyor's field reports (table survey_reports) and their files
// (private Storage bucket 'survey-files', path {businessId}/{reportId}/…).
// A report doesn't set the survey result itself — the form has no such
// question — the office reads it and picks the result as before.

export const SURVEY_FILES_BUCKET = 'survey-files'
export const MAX_FILES_PER_FIELD = 10
export const MAX_FILE_BYTES = 10 * 1024 * 1024

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToReport(row: any): SurveyReport {
  return {
    id: row.id,
    businessId: row.business_id,
    createdAt: row.created_at,
    surveyDate: row.survey_date ?? '',
    surveyorName: row.surveyor_name ?? '',
    visitedAddress: row.visited_address ?? '',
    arnonaPropertyNumber: row.arnona_property_number ?? '',
    spokeWith: row.spoke_with ?? '',
    actualUse: row.actual_use ?? '',
    useDescription: row.use_description ?? '',
    ownerInfo: row.owner_info ?? '',
    extraInfo: row.extra_info ?? '',
    files: Array.isArray(row.files) ? row.files : [],
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    accuracyM: row.accuracy_m ?? null,
    distanceM: row.distance_m ?? null,
  }
}

/** Every report, newest first per property: Map of businessId → reports (newest first). Throws on failure. */
export async function fetchReportsByBusiness(): Promise<Map<string, SurveyReport[]>> {
  const rows = await fetchAllRows('survey_reports')
  const map = new Map<string, SurveyReport[]>()
  rows.map(dbToReport).forEach(r => {
    const list = map.get(r.businessId) ?? []
    list.push(r)
    map.set(r.businessId, list)
  })
  map.forEach(list => list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  return map
}

export type ReportDraft = Omit<SurveyReport, 'id' | 'createdAt' | 'files'>

/** Inserts the report row (no files yet). Returns the new report. */
export async function insertReport(draft: ReportDraft): Promise<SurveyReport> {
  const { data, error } = await supabase.from('survey_reports').insert({
    business_id: draft.businessId,
    survey_date: draft.surveyDate || null,
    surveyor_name: draft.surveyorName,
    visited_address: draft.visitedAddress,
    arnona_property_number: draft.arnonaPropertyNumber,
    spoke_with: draft.spokeWith,
    actual_use: draft.actualUse,
    use_description: draft.useDescription,
    owner_info: draft.ownerInfo,
    extra_info: draft.extraInfo,
    lat: draft.lat,
    lon: draft.lon,
    accuracy_m: draft.accuracyM,
    distance_m: draft.distanceM,
  }).select().single()
  if (error) throw new Error(`שמירת הדיווח נכשלה: ${error.message}`)
  return dbToReport(data)
}

/** Uploads one file under the report and returns its record. */
export async function uploadReportFile(report: SurveyReport, file: File, index: number, group: SurveyReportFile['group']): Promise<SurveyReportFile> {
  // Storage keys must be ASCII-safe; the original (Hebrew) name is kept in the record.
  const ext = (file.name.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? '').toLowerCase()
  const path = `${report.businessId}/${report.id}/${index}-${group}${ext}`
  const { error } = await supabase.storage.from(SURVEY_FILES_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: true })
  if (error) throw new Error(`העלאת "${file.name}" נכשלה: ${error.message}`)
  return { path, name: file.name, type: file.type, size: file.size, group }
}

export async function saveReportFiles(reportId: string, files: SurveyReportFile[]): Promise<void> {
  const { error } = await supabase.from('survey_reports').update({ files }).eq('id', reportId)
  if (error) throw new Error(`שמירת רשימת הקבצים נכשלה: ${error.message}`)
}

/** Temporary links (1 hour) for viewing the files of a private report. */
export async function signedFileUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(SURVEY_FILES_BUCKET).createSignedUrls(paths, 3600)
  if (error || !data) return {}
  const out: Record<string, string> = {}
  data.forEach(d => { if (d.path && d.signedUrl) out[d.path] = d.signedUrl })
  return out
}

/** Shrinks a phone photo before upload (max 1600px, JPEG). Other files pass through untouched. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}
