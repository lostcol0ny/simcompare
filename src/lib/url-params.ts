export function encodeReportIds(ids: string[]): string {
  return ids.join(',')
}

export function decodeReportIds(param: string | null | undefined): string[] {
  if (!param) return []
  return param.split(',').filter(Boolean)
}
