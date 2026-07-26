'use client'

import { useRef } from 'react'

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
  const listRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: React.KeyboardEvent) {
    const current = TABS.findIndex((t) => t.id === active)
    let next = -1
    if (e.key === 'ArrowRight') next = (current + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (current - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return

    e.preventDefault()
    onChange(TABS[next].id)
    // Move focus with selection so the keyboard user follows the active tab.
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#tab-${TABS[next].id}`)
      ?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Comparison views"
      onKeyDown={handleKeyDown}
      className="bg-surface-raised border-b border-border-subtle flex justify-center px-4 overflow-x-auto"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`tab-${tab.id}`}
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
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
