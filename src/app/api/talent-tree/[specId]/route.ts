import { NextRequest, NextResponse } from 'next/server'
import type { TalentTreeData, TalentNode } from '@/lib/types'

const TOKEN_URL = 'https://oauth.battle.net/token'
const API_BASE = 'https://us.api.blizzard.com'

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    next: { revalidate: 3600 },
  })

  if (!res.ok) throw new Error(`Blizzard OAuth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
) {
  const { specId: specIdStr } = await params
  const specId = parseInt(specIdStr, 10)
  if (isNaN(specId)) {
    return NextResponse.json({ error: 'Invalid spec ID' }, { status: 400 })
  }

  try {
    const token = await getAccessToken()

    // Step 1: fetch the playable-specialization to discover the talent tree URL
    const specRes = await fetch(
      `${API_BASE}/data/wow/playable-specialization/${specId}?namespace=static-us&locale=en_US`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 86400 },
      }
    )

    if (!specRes.ok) {
      return NextResponse.json(
        { error: `Blizzard spec lookup error: ${specRes.status}` },
        { status: specRes.status }
      )
    }

    const specData = await specRes.json()
    const treeHref: string | undefined = specData?.spec_talent_tree?.key?.href
    if (!treeHref) {
      return NextResponse.json(
        { error: 'No talent tree reference found for this spec' },
        { status: 404 }
      )
    }

    // Step 2: fetch the talent tree using the discovered URL (append locale)
    const treeUrl = `${treeHref}&locale=en_US`
    const treeRes = await fetch(treeUrl, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 },
    })

    if (!treeRes.ok) {
      return NextResponse.json(
        { error: `Blizzard talent tree error: ${treeRes.status}` },
        { status: treeRes.status }
      )
    }

    const raw = await treeRes.json()
    const nodes = parseBlizzardTree(raw)

    const result: TalentTreeData = { specId, nodes }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseBlizzardTree(raw: unknown): TalentNode[] {
  const data = raw as {
    class_talent_nodes?: BlizzardNode[]
    spec_talent_nodes?: BlizzardNode[]
  }

  const allNodes = [
    ...(data.class_talent_nodes ?? []),
    ...(data.spec_talent_nodes ?? []),
  ]

  return allNodes.map((node) => {
    const firstRank = node.ranks?.[0]
    const tooltip = firstRank?.tooltip
    return {
      id: node.id,
      row: node.display_row ?? 0,
      col: node.display_col ?? 0,
      name: tooltip?.talent?.name ?? 'Unknown',
      spellId: tooltip?.spell_tooltip?.spell?.id ?? 0,
      iconUrl: '',  // icon requires separate media fetch; populated by client if needed
      maxRank: node.ranks?.length ?? 1,
      lockedBy: node.locked_by ?? [],
      connects: node.unlocks ?? [],
    }
  })
}

interface BlizzardRankTooltip {
  talent?: { name: string; id: number }
  spell_tooltip?: { spell?: { id: number; name: string } }
}

interface BlizzardRank {
  rank: number
  tooltip?: BlizzardRankTooltip
}

interface BlizzardNode {
  id: number
  display_row?: number
  display_col?: number
  raw_position_x?: number
  raw_position_y?: number
  locked_by?: number[]
  unlocks?: number[]
  ranks?: BlizzardRank[]
}
