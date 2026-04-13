'use client'

import { useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import type { Report } from '@/lib/types'
import { StickyHeader } from './StickyHeader'
import { TabNav, type TabId } from './TabNav'
import { SummaryTab } from './SummaryTab'
import { AbilitiesTab } from './AbilitiesTab'
import { SpecTreeTab } from './SpecTreeTab'
import { StatsTab } from './StatsTab'
import { TimelineTab } from './TimelineTab'
import { BuffsTab } from './BuffsTab'
import { decodeNames, encodeNames, encodeReportIds } from '@/lib/url-params'

interface Props {
  reports: Report[]
}

const CONTENT_MAX_WIDTH: Record<number, string> = {
  2: 'max-w-2xl',
  3: 'max-w-4xl',
  4: 'max-w-6xl',
  5: 'max-w-7xl',
}

export function CompareLayout({ reports }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  // Custom display names — override characterName for UI without touching the data
  const [customNames, setCustomNames] = useState<string[]>(() =>
    decodeNames(searchParams.get('names'))
  )

  const namedReports = reports.map((r, i) =>
    customNames[i] ? { ...r, characterName: customNames[i] } : r
  )

  const handleRename = useCallback((index: number, name: string) => {
    setCustomNames((prev) => {
      const next = [...prev]
      next[index] = name
      // Sync to URL so Copy Link stays accurate
      const ids = encodeReportIds(reports.map((r) => r.id))
      const hasNames = next.some(Boolean)
      const newUrl = `/compare?reports=${ids}${hasNames ? `&names=${encodeNames(next)}` : ''}`
      router.replace(newUrl, { scroll: false })
      return next
    })
  }, [reports, router])

  const handleRemoveReport = useCallback((index: number) => {
    const remaining = reports.filter((_, i) => i !== index)
    if (remaining.length < 2) {
      router.push('/')
      return
    }
    const nextNames = customNames.filter((_, i) => i !== index)
    setCustomNames(nextNames)
    const ids = encodeReportIds(remaining.map((r) => r.id))
    const hasNames = nextNames.some(Boolean)
    const newUrl = `/compare?reports=${ids}${hasNames ? `&names=${encodeNames(nextNames)}` : ''}`
    router.replace(newUrl, { scroll: false })
  }, [reports, customNames, router])

  const maxWidth = CONTENT_MAX_WIDTH[reports.length] ?? 'max-w-6xl'

  return (
    <div className="min-h-screen flex flex-col">
      <StickyHeader reports={namedReports} />
      <TabNav active={activeTab} onChange={setActiveTab} />
      <div className="flex-1">
        <div className={`mx-auto w-full ${maxWidth}`}>
          {activeTab === 'summary' && <SummaryTab reports={namedReports} onRename={handleRename} onRemove={handleRemoveReport} />}
          {activeTab === 'abilities' && <AbilitiesTab reports={namedReports} />}
          {activeTab === 'talents' && <SpecTreeTab reports={namedReports} />}
          {activeTab === 'stats' && <StatsTab reports={namedReports} />}
          {activeTab === 'timeline' && <TimelineTab reports={namedReports} />}
          {activeTab === 'buffs' && <BuffsTab reports={namedReports} />}
        </div>
      </div>
    </div>
  )
}
