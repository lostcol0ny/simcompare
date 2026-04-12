import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params

  if (!/^[A-Za-z0-9]+$/.test(reportId)) {
    return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
  }

  const url = `https://www.raidbots.com/simbot/report/${reportId}/data.json`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SimCompare/1.0)',
      },
      next: { revalidate: 300 }, // cache report data for 5 minutes
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Report not found (${res.status})` },
        { status: res.status === 404 ? 404 : 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
