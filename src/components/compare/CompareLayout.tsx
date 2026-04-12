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

export function CompareLayout({ reports }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader reports={reports} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <div className="flex-1">
        {activeTab === 'summary' && <SummaryTab reports={reports} />}
        {activeTab === 'abilities' && <AbilitiesTab reports={reports} />}
        {activeTab === 'spec-tree' && <SpecTreeTab reports={reports} />}
        {activeTab === 'stats' && <StatsTab reports={reports} />}
      </div>
    </div>
  )
}
