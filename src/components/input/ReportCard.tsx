'use client'

import type { ReportLoadState } from '@/lib/types'

interface Props {
  label: string
  url: string
  state: ReportLoadState
  onRemove: () => void
  customName: string
  onNameChange: (name: string) => void
}

export function ReportCard({ label, url, state, onRemove, customName, onNameChange }: Props) {
  const borderColor =
    state.status === 'valid'
      ? 'border-positive-border'
      : state.status === 'error'
        ? 'border-negative-border'
        : state.status === 'loading'
          ? 'border-warning'
          : 'border-border-subtle'

  const bgColor =
    state.status === 'valid'
      ? 'bg-positive-bg'
      : state.status === 'error'
        ? 'bg-negative-bg'
        : 'bg-surface-raised'

  return (
    <div className={`rounded border ${borderColor} ${bgColor} p-3 text-sm`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-accent-light">{label}</span>
        <button
          onClick={onRemove}
          className="text-text-muted hover:text-text-primary leading-none"
          aria-label="Remove report"
        >
          ×
        </button>
      </div>

      <div className="mt-1 truncate text-text-muted text-xs">{url}</div>

      {state.status === 'loading' && (
        <div className="mt-2 text-warning text-xs">Loading…</div>
      )}

      {state.status === 'error' && (
        <div className="mt-2 text-negative text-xs">{state.message}</div>
      )}

      {state.status === 'valid' && (
        <div className="mt-2 space-y-0.5">
          <div className="text-text-primary font-medium">{state.report.characterName}</div>
          <div className="text-text-secondary text-xs">{state.report.specialization} · {state.report.race}</div>
          <div className="text-accent-light font-bold">
            {Math.round(state.report.dps).toLocaleString()} DPS
          </div>
          <div className="text-text-muted text-xs">
            {state.report.fightStyle} · {state.report.targetCount}{' '}
            {state.report.targetCount === 1 ? 'target' : 'targets'} · {state.report.fightDuration}s
          </div>
          <div className="pt-1">
            <input
              type="text"
              value={customName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={`Label (default: ${state.report.characterName})`}
              className="w-full rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}
    </div>
  )
}
