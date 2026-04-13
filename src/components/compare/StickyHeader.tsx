'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Report } from '@/lib/types'
import { extractReportId } from '@/lib/raidbots'
import { encodeReportIds } from '@/lib/url-params'
import { LABELS } from '@/lib/report-labels'

interface Props {
  reports: Report[]
}

export function StickyHeader({ reports }: Props) {
  const router = useRouter()
  const [addingReport, setAddingReport] = useState(false)

  const maxDps = Math.max(...reports.map((r) => r.dps))
  const leader = reports.find((r) => r.dps === maxDps)
  const follower = reports.find((r) => r.dps !== maxDps)
  const delta =
    leader && follower
      ? (((leader.dps - follower.dps) / follower.dps) * 100).toFixed(1)
      : null

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  function handleAddPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').trim()
    if (!text) return
    const id = extractReportId(text)
    if (!id) return
    e.preventDefault()
    const currentIds = reports.map((r) => r.id)
    if (currentIds.includes(id)) {
      setAddingReport(false)
      return
    }
    router.push(`/compare?reports=${encodeReportIds([...currentIds, id])}`)
    setAddingReport(false)
  }

  return (
    <div className="sticky top-0 z-50 bg-surface border-b border-border-subtle">
      <div className="flex items-center justify-between px-4 py-2 gap-4">
        <span className="text-sm font-bold text-accent-light shrink-0">SimCompare</span>

        <div className="flex items-center gap-3 text-xs overflow-x-auto">
          {reports.map((r, i) => (
            <span key={r.id} className="flex items-center gap-1.5 shrink-0">
              <span className="text-text-muted">{LABELS[i]}:</span>
              <span className="text-text-secondary">
                {r.characterName} ({r.specialization.split(' ')[0]})
              </span>
              <span className="font-bold text-accent-light">
                {Math.round(r.dps / 1000).toLocaleString()}k
              </span>
            </span>
          ))}
          {delta && leader && (
            <span className="bg-positive-bg text-positive px-2 py-0.5 rounded text-xs font-bold shrink-0 border border-positive-border">
              {LABELS[reports.indexOf(leader)]} +{delta}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setAddingReport((v) => !v)}
            className="text-xs text-accent-light hover:opacity-80"
          >
            + Add report
          </button>
          <button
            onClick={copyLink}
            className="text-xs text-positive hover:opacity-80"
          >
            ⧉ Copy link
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Reset
          </button>
        </div>
      </div>

      {addingReport && (
        <div className="px-4 py-2 border-t border-border-subtle bg-surface-raised flex items-center gap-3">
          <input
            autoFocus
            type="text"
            onPaste={handleAddPaste}
            onKeyDown={(e) => e.key === 'Escape' && setAddingReport(false)}
            placeholder="Paste a Raidbots report URL…"
            className="w-full max-w-sm rounded border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <span className="text-text-muted text-xs whitespace-nowrap">Esc to cancel</span>
        </div>
      )}
    </div>
  )
}
