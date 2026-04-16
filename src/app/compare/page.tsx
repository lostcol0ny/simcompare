'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { fetchReport } from '@/lib/raidbots'
import { decodeReportIds } from '@/lib/url-params'
import { CompareLayout } from '@/components/compare/CompareLayout'
import type { Report } from '@/lib/types'

function ComparePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ids = decodeReportIds(searchParams.get('reports'))
    if (ids.length < 1) {
      router.replace('/')
      return
    }

    Promise.all(ids.map(fetchReport))
      .then((loaded) => {
        setReports(loaded)
        setLoading(false)
      })
      .catch(() => {
        setError('One or more reports could not be loaded.')
        setLoading(false)
      })
  }, [searchParams, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted text-sm">Loading reports…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-negative text-sm">{error}</p>
      </div>
    )
  }

  return <CompareLayout reports={reports} />
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-text-muted text-sm">Loading reports…</p>
        </div>
      }
    >
      <ComparePageInner />
    </Suspense>
  )
}
