'use client'

import type { Report } from '@/lib/types'
import { LABELS } from '@/lib/report-labels'
import { buildHue } from '@/lib/build-colors'

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
      {/* Buff uptime comparison bars */}
      <div>
        <p className="label mb-3">Buff Uptime</p>
        <div className="border border-border rounded-lg overflow-hidden">
          {allBuffNames.map((name) => (
            <div
              key={name}
              className="border-b border-hairline last:border-0 px-3 py-[5px] bg-surface row-hover"
            >
              <span className="text-text-secondary text-name">{name}</span>
              <div className="mt-1 space-y-1">
                {reports.map((r, i) => {
                  const buff = r.buffs.find((b) => b.name === name)
                  const uptime = buff?.uptime ?? 0
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] w-3 shrink-0" style={{ color: buildHue(i) }}>{LABELS[i]}</span>
                      <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${uptime}%`, backgroundColor: buildHue(i), opacity: 0.75 }}
                        />
                      </div>
                      <span className="num text-fig text-text-secondary w-12 text-right shrink-0">
                        {uptime > 0 ? `${uptime.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resource efficiency section */}
      {(() => {
        // Aggregate gains by resource type across all sources
        const resourceNames = [...new Set(reports.flatMap((r) => r.gains.map((g) => g.resource)))]
        const resourceData = resourceNames.map((resource) => ({
          resource,
          label: resource.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          perBuild: reports.map((r) => {
            const gains = r.gains.filter((g) => g.resource === resource)
            const actual = gains.reduce((s, g) => s + g.actual, 0)
            const overflow = gains.reduce((s, g) => s + g.overflow, 0)
            const total = actual + overflow
            const wastePct = total > 0 ? (overflow / total) * 100 : 0
            return { actual, overflow, total, wastePct }
          }),
        })).filter((d) => d.perBuild.some((b) => b.total > 0))

        if (resourceData.length === 0) return null
        return (
          <div>
            <p className="label mb-3">Resource Efficiency</p>
            <div className="border border-border rounded-lg overflow-hidden">
              {resourceData.map(({ resource, label, perBuild }) => {
                const maxTotal = Math.max(...perBuild.map((b) => b.total))
                return (
                  <div key={resource} className="border-b border-hairline last:border-0 px-3 py-[5px] bg-surface row-hover">
                    <span className="text-text-secondary text-name">{label}</span>
                    <div className="mt-1 space-y-1">
                      {reports.map((r, i) => {
                        const b = perBuild[i]
                        if (b.total === 0) return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] w-3 shrink-0" style={{ color: buildHue(i) }}>{LABELS[i]}</span>
                            <span className="text-fig text-text-faint">—</span>
                          </div>
                        )
                        const barW = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0
                        const usedFrac = b.total > 0 ? (b.actual / b.total) * 100 : 100
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] w-3 shrink-0" style={{ color: buildHue(i) }}>{LABELS[i]}</span>
                            <div className="flex-1 h-2 bg-surface-overlay rounded-full overflow-hidden">
                              <div className="h-full flex rounded-full" style={{ width: `${barW}%` }}>
                                <div
                                  className="h-full rounded-l-full"
                                  style={{ width: `${usedFrac}%`, backgroundColor: buildHue(i), opacity: 0.75 }}
                                />
                                {b.overflow > 0 && (
                                  <div
                                    className="h-full rounded-r-full"
                                    style={{ width: `${100 - usedFrac}%`, backgroundColor: '#ef4444', opacity: 0.5 }}
                                  />
                                )}
                              </div>
                            </div>
                            <span className="num text-fig text-text-secondary w-24 text-right shrink-0">
                              {b.actual.toFixed(1)}
                              {b.overflow > 0 && (
                                <span className="text-negative"> (<span className="num">{b.wastePct.toFixed(0)}%</span> waste)</span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Resource gains detail */}
      <div>
        <p className="label mb-3">Resource Gains by Source</p>
        {/* Only this grid overflows; the uptime/efficiency bars above are
            flex-1 and always fit. No overflow-hidden — it would become the
            sticky containing block and stop .pin-col from pinning. */}
        <div
          className="table-scroll border border-border rounded-lg"
          tabIndex={0}
          role="region"
          aria-label="Buffs and resources"
        >
          {/* Header */}
          <div
            className="grid bg-surface border-b border-hairline label px-3 py-[5px]"
            style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
          >
            <span className="pin-col">Source · Resource</span>
            {reports.map((r, i) => (
              <span key={i} className="text-right" style={{ color: buildHue(i) }}>
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
                className="grid items-start border-b border-hairline last:border-0 px-3 py-[5px] bg-surface row-hover"
                style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr)` }}
              >
                <span className="pin-col text-text-secondary text-fig truncate pr-2 pt-0.5">{label}</span>
                {reports.map((r, i) => {
                  const gain = r.gains.find((g) => g.source === source && g.resource === resource)
                  if (!gain) return (
                    <span key={i} className="text-right text-text-faint text-fig">—</span>
                  )
                  return (
                    <div key={i} className="text-right">
                      <span className="num text-fig text-text-primary font-medium">
                        {gain.actual.toFixed(1)}
                      </span>
                      {gain.overflow > 0 && (
                        <span className="num text-fig text-negative ml-1">
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
