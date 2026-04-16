'use client'

import type { Report } from '@/lib/types'
import { LABELS, REPORT_COLORS } from '@/lib/report-labels'

interface Props {
  reports: Report[]
}

export function BuffsTab({ reports }: Props) {
  // Union of all buff names across reports, sorted by max uptime descending
  const allBuffNames = [
    ...new Set(reports.flatMap((r) => r.buffs.map((b) => b.name))),
  ].sort((a, b) => {
    const maxA = Math.max(...reports.map((r) => r.buffs.find((buf) => buf.name === a)?.uptime ?? 0))
    const maxB = Math.max(...reports.map((r) => r.buffs.find((buf) => buf.name === b)?.uptime ?? 0))
    return maxB - maxA
  })

  // Union of source||resource keys across all gains
  const allResourceKeys = [
    ...new Set(reports.flatMap((r) => r.gains.map((g) => `${g.source}||${g.resource}`))),
  ]

  return (
    <div className="p-4 space-y-8">
      {/* Buff uptime section */}
      <div>
        <p className="text-xs text-text-faint uppercase tracking-wide mb-3">Buff Uptime</p>
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div
            className="grid bg-surface border-b border-border text-xs text-text-faint px-3 py-1.5"
            style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
          >
            <span>Buff</span>
            {reports.map((r, i) => (
              <span key={i} className="text-right" style={{ color: REPORT_COLORS[i] }}>
                {LABELS[i]} — {r.characterName}
              </span>
            ))}
          </div>
          {allBuffNames.map((name) => (
            <div
              key={name}
              className="grid items-center border-b border-border last:border-0 px-3 py-2 bg-surface text-sm transition-colors hover:bg-[rgba(124,58,237,0.12)]"
              style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
            >
              <span className="text-text-secondary text-xs truncate pr-2">{name}</span>
              {reports.map((r, i) => {
                const buff = r.buffs.find((b) => b.name === name)
                if (!buff) return (
                  <span key={i} className="text-right text-text-faint text-xs">—</span>
                )
                return (
                  <div key={i} className="flex items-center gap-2 justify-end">
                    <div className="flex-1 max-w-20 h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${buff.uptime}%`, backgroundColor: REPORT_COLORS[i], opacity: 0.75 }}
                      />
                    </div>
                    <span className="text-xs text-text-secondary w-10 text-right shrink-0">
                      {buff.uptime.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Resource gains section */}
      <div>
        <p className="text-xs text-text-faint uppercase tracking-wide mb-3">Resource Gains (per fight avg)</p>
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div
            className="grid bg-surface border-b border-border text-xs text-text-faint px-3 py-1.5"
            style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
          >
            <span>Source · Resource</span>
            {reports.map((r, i) => (
              <span key={i} className="text-right" style={{ color: REPORT_COLORS[i] }}>
                {LABELS[i]} — {r.characterName}
              </span>
            ))}
          </div>
          {allResourceKeys.map((key) => {
            const [source, resource] = key.split('||')
            const label = `${source} · ${resource.replace(/_/g, ' ')}`
            return (
              <div
                key={key}
                className="grid items-start border-b border-border last:border-0 px-3 py-2 bg-surface transition-colors hover:bg-[rgba(124,58,237,0.12)]"
                style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
              >
                <span className="text-text-secondary text-xs truncate pr-2 pt-0.5">{label}</span>
                {reports.map((r, i) => {
                  const gain = r.gains.find((g) => g.source === source && g.resource === resource)
                  if (!gain) return (
                    <span key={i} className="text-right text-text-faint text-xs">—</span>
                  )
                  return (
                    <div key={i} className="text-right">
                      <span className="text-xs text-text-primary font-medium">
                        {gain.actual.toFixed(1)}
                      </span>
                      {gain.overflow > 0 && (
                        <span className="text-xs text-negative ml-1">
                          ({gain.overflow.toFixed(1)} wasted)
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
