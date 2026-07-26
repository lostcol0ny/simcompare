'use client'

import { useMemo } from 'react'
import type { Report } from '@/lib/types'
import { computeAbilityDeltas } from '@/lib/ability-delta'
import { buildHue } from '@/lib/build-colors'

interface Props {
  baseline: Report
  compared: Report
  comparedIndex: number
}

const MINUS = '−'   // U+2212 MINUS SIGN — aligns with digits; the hyphen does not
const REMAINDER_ID = -1

function signed(value: number): string {
  const magnitude = Math.abs(Math.round(value)).toLocaleString('en-US')
  return `${value < 0 ? MINUS : '+'}${magnitude}`
}

function signedPct(value: number): string {
  const magnitude = Math.abs(value).toFixed(1)
  return `${value < 0 ? MINUS : '+'}${magnitude}`
}

export function DeltaLedger({ baseline, compared, comparedIndex }: Props) {
  const { rows, remainder, total } = useMemo(
    () => computeAbilityDeltas(baseline, compared),
    [baseline, compared]
  )

  const hue = buildHue(comparedIndex)
  const widest = Math.max(...rows.map((r) => Math.abs(r.delta)), 1)
  const percent = baseline.dps === 0 ? 0 : (total / baseline.dps) * 100

  const headerValence = total < 0 ? 'text-negative' : total > 0 ? 'text-positive' : 'text-text-secondary'

  return (
    <section className="p-4">
      <header className="flex items-baseline gap-3 pb-3 mb-3 border-b border-border-subtle">
        <span className="label">
          {baseline.characterName} → {compared.characterName}
        </span>
        <span
          className={`num text-hero font-semibold ${headerValence}`}
        >
          {signed(total)}
        </span>
        <span className={`num text-body ${headerValence}`}>
          {signedPct(percent)}%
        </span>
      </header>

      {[...rows, { id: REMAINDER_ID, name: 'Everything else', delta: remainder, baseline: 0, compared: 0 }].map((row) => {
        const rowValence = row.delta < 0 ? 'text-negative' : row.delta > 0 ? 'text-positive' : 'text-text-secondary'
        return (
          <div
            key={row.id}
            className="grid items-center gap-2.5 py-[5px] border-b border-hairline row-hover"
            style={{ gridTemplateColumns: '150px 1fr 92px' }}
          >
            <span className="text-name">{row.name}</span>
            <span className="relative h-3.5 before:absolute before:left-1/2 before:-top-0.5 before:-bottom-0.5 before:w-px before:bg-border-subtle">
              <span
                data-testid="delta-bar"
                className="absolute top-px h-3 rounded-sm"
                style={{
                  backgroundColor: hue,
                  width: `${Math.min(Math.abs(row.delta) / widest, 1) * 48}%`,
                  ...(row.delta < 0 ? { right: '50%' } : { left: '50%' }),
                }}
              />
            </span>
            <span
              className={`num text-fig text-right ${rowValence}`}
            >
              {signed(row.delta)}
            </span>
          </div>
        )
      })}
    </section>
  )
}
