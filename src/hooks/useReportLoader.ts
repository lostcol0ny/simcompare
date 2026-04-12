'use client'

import { useState, useCallback } from 'react'
import { extractReportId, fetchReport } from '@/lib/raidbots'
import type { Report, ReportLoadState } from '@/lib/types'

export interface LoadedReport {
  url: string
  state: ReportLoadState
}

export function useReportLoader() {
  const [reports, setReports] = useState<LoadedReport[]>([])

  const addReport = useCallback(async (url: string) => {
    const reportId = extractReportId(url)
    if (!reportId) {
      setReports((prev) => [
        ...prev,
        { url, state: { status: 'error', message: 'Not a valid Raidbots report URL' } },
      ])
      return
    }

    // Add as loading
    setReports((prev) => [...prev, { url, state: { status: 'loading' } }])

    try {
      const report = await fetchReport(reportId)
      setReports((prev) =>
        prev.map((r) =>
          r.url === url ? { url, state: { status: 'valid', report } } : r
        )
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setReports((prev) =>
        prev.map((r) =>
          r.url === url
            ? { url, state: { status: 'error', message } }
            : r
        )
      )
    }
  }, [])

  const removeReport = useCallback((url: string) => {
    setReports((prev) => prev.filter((r) => r.url !== url))
  }, [])

  const validReports = reports
    .filter((r): r is LoadedReport & { state: { status: 'valid'; report: Report } } =>
      r.state.status === 'valid'
    )
    .map((r) => r.state.report)

  return { reports, addReport, removeReport, validReports }
}
