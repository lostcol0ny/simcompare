'use client'

export type TabId = 'summary' | 'abilities' | 'talents' | 'stats' | 'timeline' | 'buffs'

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'talents', label: 'Talents' },
  { id: 'stats', label: 'Stats' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'buffs', label: 'Buffs & Resources' },
]

interface Props {
  active: TabId
  onChange: (id: TabId) => void
}

export function TabNav({ active, onChange }: Props) {
  return (
    <div className="bg-surface-raised border-b border-border-subtle flex px-4 overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors shrink-0 ${
            active === tab.id
              ? 'text-accent-light border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
