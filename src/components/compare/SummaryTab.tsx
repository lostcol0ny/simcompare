import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

export function SummaryTab({ reports }: Props) {
  const maxDps = Math.max(...reports.map((r) => r.dps))
  const minDps = Math.min(...reports.map((r) => r.dps))
  const delta = (((maxDps - minDps) / minDps) * 100).toFixed(1)
  const leadIdx = reports.findIndex((r) => r.dps === maxDps)

  return (
    <div>
      <div className="flex divide-x divide-border">
        {reports.map((r, i) => (
          <div key={r.id} className="flex-1 p-5">
            <p className="text-xs text-text-faint uppercase tracking-wide mb-3">
              {LABELS[i]} — {r.specialization}
            </p>
            <p className="text-4xl font-bold text-accent-light">
              {fmt(r.dps)}
            </p>
            <p className="text-xs text-text-muted mt-1">DPS ±{fmt(r.dpsStdDev)}</p>

            <div className="mt-4 space-y-1 text-xs text-text-secondary">
              <p>{r.fightStyle} · {r.targetCount} targets · {r.fightDuration}s ±{Math.round(r.varyLength * 100)}%</p>
              <p>{r.race}</p>
            </div>

            <div className="mt-4 space-y-1 text-xs">
              <StatLine label="Haste" value={`${r.buffedStats.spellHaste.toFixed(1)}%`} />
              <StatLine label="Crit" value={`${r.buffedStats.spellCrit.toFixed(1)}%`} />
              <StatLine label="Mastery" value={`${r.buffedStats.mastery.toFixed(1)}%`} />
              <StatLine label="Versatility" value={`${r.buffedStats.versatility.toFixed(1)}%`} />
            </div>
          </div>
        ))}
      </div>

      {reports.length >= 2 && (
        <div className="bg-positive-bg border-t border-positive-border px-5 py-3 text-xs text-positive">
          ▲ {LABELS[leadIdx]} ({reports[leadIdx].characterName}) leads by{' '}
          {fmt(maxDps - minDps)} DPS (+{delta}%)
        </div>
      )}
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-text-secondary">
      <span className="text-text-faint">{label}</span>
      <span>{value}</span>
    </div>
  )
}
