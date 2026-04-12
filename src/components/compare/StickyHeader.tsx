'use client'

import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function StickyHeader({ reports }: Props) {
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

  return (
    <div className="sticky top-0 z-50 bg-surface border-b border-border-subtle flex items-center justify-between px-4 py-2 gap-4">
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

      <button
        onClick={copyLink}
        className="text-xs text-positive hover:opacity-80 shrink-0"
      >
        ⧉ Copy link
      </button>
    </div>
  )
}
