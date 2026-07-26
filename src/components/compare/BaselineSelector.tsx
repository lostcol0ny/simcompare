'use client'

import type { Report } from '@/lib/types'
import { LABELS } from '@/lib/report-labels'

interface Props {
  reports: Report[]
  baselineIndex: number
  comparedIndex: number
  onChange: (baseline: number, compared: number) => void
}

export function BaselineSelector({ reports, baselineIndex, comparedIndex, onChange }: Props) {
  function pickBaseline(next: number) {
    onChange(next, next === comparedIndex ? baselineIndex : comparedIndex)
  }

  return (
    <div className="flex items-center gap-3 text-body">
      <label className="flex items-center gap-1.5">
        <span className="label">Baseline</span>
        <select
          value={baselineIndex}
          onChange={(e) => pickBaseline(Number(e.target.value))}
          className="bg-surface-overlay border border-border-subtle rounded px-2 py-1"
        >
          {reports.map((r, i) => (
            <option key={i} value={i}>{LABELS[i]} · {r.characterName}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="label">Compared with</span>
        <select
          value={comparedIndex}
          onChange={(e) => onChange(baselineIndex, Number(e.target.value))}
          className="bg-surface-overlay border border-border-subtle rounded px-2 py-1"
        >
          {reports.map((r, i) =>
            i === baselineIndex ? null : (
              <option key={i} value={i}>{LABELS[i]} · {r.characterName}</option>
            )
          )}
        </select>
      </label>
    </div>
  )
}
