import type { Report } from '@/lib/types'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function StatsTab({ reports }: Props) {
  return (
    <div className="p-4 max-w-3xl">
      <Section title="Fight Conditions">
        <StatRow label="Fight Style" values={reports.map((r) => r.fightStyle)} reports={reports} />
        <StatRow label="Targets" values={reports.map((r) => String(r.targetCount))} reports={reports} />
        <StatRow
          label="Duration"
          values={reports.map((r) => `${r.fightDuration}s ±${Math.round(r.varyLength * 100)}%`)}
          reports={reports}
        />
      </Section>

      <Section title="Primary Stats (buffed)">
        <StatRow
          label="Intellect"
          values={reports.map((r) => r.buffedStats.intellect.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.intellect)}
          reports={reports}
        />
        <StatRow
          label="Spell Power"
          values={reports.map((r) => r.buffedStats.spellPower.toLocaleString())}
          rawValues={reports.map((r) => r.buffedStats.spellPower)}
          reports={reports}
        />
      </Section>

      <Section title="Secondary Stats (buffed)">
        <StatRow
          label="Haste"
          values={reports.map((r) => `${r.buffedStats.spellHaste.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellHaste)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Crit"
          values={reports.map((r) => `${r.buffedStats.spellCrit.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.spellCrit)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Mastery"
          values={reports.map((r) => `${r.buffedStats.mastery.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.mastery)}
          unit="pp"
          reports={reports}
        />
        <StatRow
          label="Versatility"
          values={reports.map((r) => `${r.buffedStats.versatility.toFixed(2)}%`)}
          rawValues={reports.map((r) => r.buffedStats.versatility)}
          unit="pp"
          reports={reports}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs text-text-faint uppercase tracking-wide mb-2">{title}</h3>
      <div className="border border-border rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function StatRow({
  label,
  values,
  rawValues,
  unit,
  reports,
}: {
  label: string
  values: string[]
  rawValues?: number[]
  unit?: string
  reports: Report[]
}) {
  const maxRaw = rawValues ? Math.max(...rawValues) : null

  return (
    <div
      className="grid border-b border-border last:border-0 text-sm"
      style={{ gridTemplateColumns: `160px repeat(${reports.length}, 1fr)` }}
    >
      <span className="px-3 py-2 text-xs text-text-faint border-r border-border bg-surface">{label}</span>
      {values.map((v, i) => {
        const delta =
          rawValues && maxRaw !== null && rawValues[i] !== maxRaw
            ? rawValues[i] - maxRaw
            : null

        return (
          <span key={i} className="px-3 py-2 text-text-primary border-r border-border last:border-0">
            {v}
            {delta !== null && (
              <span className={`ml-1 text-xs ${delta > 0 ? 'text-positive' : 'text-negative'}`}>
                {delta > 0 ? '+' : ''}
                {unit === 'pp' ? `${delta.toFixed(1)}pp` : delta.toLocaleString()}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
