'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useReportLoader } from '@/hooks/useReportLoader'
import { encodeReportIds } from '@/lib/url-params'
import { ReportCard } from './ReportCard'

const LABELS = ['A', 'B', 'C', 'D']
const MAX_REPORTS = 4

export function ReportInputPage() {
  const router = useRouter()
  const { reports, addReport, removeReport, validReports } = useReportLoader()

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text').trim()
      if (!text || reports.length >= MAX_REPORTS) return
      if (reports.some((r) => r.url === text)) return
      e.preventDefault()
      addReport(text)
      // Clear the input after paste
      ;(e.target as HTMLInputElement).value = ''
    },
    [reports, addReport]
  )

  const handleCompare = () => {
    const ids = validReports.map((r) => r.id)
    router.push(`/compare?reports=${encodeReportIds(ids)}`)
  }

  const canCompare = validReports.length >= 2

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-bold text-text-primary mb-1">SimCompare</h1>
      <p className="text-text-secondary text-sm mb-8">
        Compare Raidbots simulation reports side by side.
      </p>

      {reports.length < MAX_REPORTS && (
        <div className="mb-6">
          <label className="block text-text-secondary text-xs mb-2">
            Paste a Raidbots report URL
          </label>
          <input
            type="text"
            onPaste={handlePaste}
            placeholder="https://www.raidbots.com/simbot/report/…"
            className="w-full rounded border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            readOnly={false}
          />
        </div>
      )}

      {reports.length > 0 && (
        <div className="space-y-3 mb-8">
          {reports.map((r, i) => (
            <ReportCard
              key={r.url}
              label={LABELS[i]}
              url={r.url}
              state={r.state}
              onRemove={() => removeReport(r.url)}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleCompare}
        disabled={!canCompare}
        className="w-full rounded bg-accent px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
      >
        Compare Reports
      </button>

      {reports.length > 0 && !canCompare && (
        <p className="mt-3 text-center text-text-muted text-xs">
          Add at least 2 valid reports to compare
        </p>
      )}
    </main>
  )
}
