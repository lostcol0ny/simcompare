'use client'

import { useState } from 'react'
import type { Report } from '@/lib/types'
import { buildAbilityRows, type AbilityRow } from '@/lib/abilities'

const LABELS = ['A', 'B', 'C', 'D']

interface Props {
  reports: Report[]
}

export function AbilitiesTab({ reports }: Props) {
  const [showPets, setShowPets] = useState(false)
  const rows = buildAbilityRows(reports)

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-border text-xs">
        <span className="text-text-muted">
          Sorted by DPS · <span className="text-accent-light">highest first</span>
        </span>
        <label className="flex items-center gap-2 cursor-pointer text-text-muted">
          Show pets
          <button
            role="switch"
            aria-checked={showPets}
            onClick={() => setShowPets((v) => !v)}
            className={`w-8 h-4 rounded-full relative transition-colors ${showPets ? 'bg-accent' : 'bg-surface-overlay'}`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showPets ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
        </label>
      </div>

      <div
        className="grid px-4 py-1.5 bg-surface border-b border-border text-xs text-text-faint uppercase tracking-wide"
        style={{ gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px` }}
      >
        <span>Ability</span>
        {reports.map((r, i) => (
          <span key={r.id} className="text-right">
            {LABELS[i]} — {r.specialization.split(' ')[0]}
          </span>
        ))}
        <span className="text-center">Δ vs best</span>
      </div>

      {rows.map((row) => (
        <AbilityRowComponent
          key={row.id}
          row={row}
          reports={reports}
          showPets={showPets}
          depth={0}
        />
      ))}
    </div>
  )
}

function AbilityRowComponent({
  row,
  reports,
  showPets,
  depth,
}: {
  row: AbilityRow
  reports: Report[]
  showPets: boolean
  depth: number
}) {
  const maxDps = Math.max(...row.values.map((v) => v.dps))
  const isChild = depth > 0

  if (isChild && !showPets) return null

  return (
    <>
      <div
        className={`grid items-center border-b border-border text-sm ${
          isChild ? 'bg-surface opacity-75' : depth % 2 === 0 ? 'bg-surface' : 'bg-surface-raised'
        }`}
        style={{
          gridTemplateColumns: `200px repeat(${reports.length}, 1fr) 80px`,
          paddingTop: '6px',
          paddingBottom: '6px',
          paddingLeft: `${16 + depth * 16}px`,
          paddingRight: '16px',
        }}
      >
        <div>
          {isChild && <span className="text-text-faint mr-1 text-xs">└</span>}
          <span className={isChild ? 'text-xs text-text-secondary' : 'font-medium text-text-primary'}>
            {row.spellName}
          </span>
          {!isChild && (
            <div className="text-xs text-text-faint">
              {row.school} · {row.values[0]?.castsPerFight.toFixed(1)}×/fight
            </div>
          )}
        </div>

        {row.values.map((v, i) => (
          <div key={i} className="text-right">
            {v.dps > 0 ? (
              <>
                <span className="font-medium text-text-primary">{Math.round(v.dps).toLocaleString()}</span>
                {v.exclusive && (
                  <span className="ml-1 text-xs bg-positive-bg text-positive px-1 rounded border border-positive-border">
                    {LABELS[i]} only
                  </span>
                )}
              </>
            ) : (
              <span className="text-text-faint">—</span>
            )}
          </div>
        ))}

        <div className="text-center text-xs">
          {maxDps > 0 && row.values.filter((v) => v.dps > 0).length > 1 ? (
            row.values.map((v, i) => {
              if (v.dps === 0) return null
              const pct = ((v.dps - maxDps) / maxDps) * 100
              if (pct === 0) return null
              const color = pct < -5 ? 'text-negative' : pct < -2 ? 'text-text-muted' : 'text-positive'
              return (
                <span key={i} className={`block ${color}`}>
                  {LABELS[i]}: {pct.toFixed(1)}%
                </span>
              )
            })
          ) : (
            <span className="text-text-faint">—</span>
          )}
        </div>
      </div>

      {row.children.map((child) => (
        <AbilityRowComponent
          key={child.id}
          row={child}
          reports={reports}
          showPets={showPets}
          depth={depth + 1}
        />
      ))}
    </>
  )
}
