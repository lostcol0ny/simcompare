'use client'

import { useState } from 'react'
import type { Report } from '@/lib/types'
import { StickyHeader } from './StickyHeader'
import { TabNav, type TabId } from './TabNav'
import { SummaryTab } from './SummaryTab'
import { AbilitiesTab } from './AbilitiesTab'
import { SpecTreeTab } from './SpecTreeTab'
import { StatsTab } from './StatsTab'

interface Props {
  reports: Report[]
}

// Content max-width scales with report count so 2-report comparisons
// don't stretch across the full viewport.
const CONTENT_MAX_WIDTH: Record<number, string> = {
  2: 'max-w-2xl',
  3: 'max-w-4xl',
  4: 'max-w-6xl',
}

export function CompareLayout({ reports }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')
  const maxWidth = CONTENT_MAX_WIDTH[reports.length] ?? 'max-w-6xl'

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader reports={reports} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <div className="flex-1">
        <div className={`mx-auto w-full ${maxWidth}`}>
          {activeTab === 'summary' && <SummaryTab reports={reports} />}
          {activeTab === 'abilities' && <AbilitiesTab reports={reports} />}
          {activeTab === 'spec-tree' && <SpecTreeTab reports={reports} />}
          {activeTab === 'stats' && <StatsTab reports={reports} />}
        </div>
      </div>
    </div>
  )
}
