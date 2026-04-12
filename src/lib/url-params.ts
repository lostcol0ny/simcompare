export function encodeReportIds(ids: string[]): string {
  return ids.join(',')
}

export function decodeReportIds(param: string | null | undefined): string[] {
  if (!param) return []
  return param.split(',').filter(Boolean)
}

export function encodeNames(names: string[]): string {
  return names.map((n) => encodeURIComponent(n)).join(',')
}

export function decodeNames(param: string | null | undefined): string[] {
  if (!param) return []
  return param.split(',').map((n) => decodeURIComponent(n))
}
