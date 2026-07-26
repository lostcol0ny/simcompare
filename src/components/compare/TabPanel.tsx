'use client'

import type { TabId } from './TabNav'

interface Props {
  id: TabId
  active: boolean
  children: React.ReactNode
}

export function TabPanel({ id, active, children }: Props) {
  return (
    <div
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={`tab-panel ${active ? 'tab-panel-active' : ''}`}
      inert={!active}
    >
      {children}
    </div>
  )
}
