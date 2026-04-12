import { NextRequest, NextResponse } from 'next/server'
import type { TalentTreeData, TalentNode } from '@/lib/types'

const TOKEN_URL = 'https://oauth.battle.net/token'
const API_BASE = 'https://us.api.blizzard.com'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }

  const clientId = process.env.BLIZZARD_CLIENT_ID
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing Blizzard API credentials in environment')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error(`Blizzard OAuth failed: ${res.status}`)
  const data = await res.json()
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

async function fetchSpellIcons(
  spellIds: number[],
  token: string
): Promise<Map<number, string>> {
  const results = await Promise.allSettled(
    spellIds.map(async (spellId) => {
      const res = await fetch(
        `${API_BASE}/data/wow/media/spell/${spellId}?namespace=static-us`,
        { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 86400 } }
      )
      if (!res.ok) return { spellId, url: '' }
      const data = await res.json()
      const url =
        (data.assets as Array<{ key: string; value: string }> | undefined)?.find(
          (a) => a.key === 'icon'
        )?.value ?? ''
      return { spellId, url }
    })
  )

  const map = new Map<number, string>()
  for (const result of results) {
    if (result.status === 'fulfilled') {
      map.set(result.value.spellId, result.value.url)
    }
  }
  return map
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

    // Step 1: discover the talent tree URL for this spec
    const specRes = await fetch(
      `${API_BASE}/data/wow/playable-specialization/${specId}?namespace=static-us&locale=en_US`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 86400 } }
    )
    if (!specRes.ok) {
      return NextResponse.json(
        { error: `Blizzard spec lookup failed: ${specRes.status}` },
        { status: 502 }
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

    // Step 2: fetch the talent tree (class + spec + hero nodes)
    const treeUrlObj = new URL(treeHref)
    treeUrlObj.searchParams.set('locale', 'en_US')
    const treeRes = await fetch(treeUrlObj.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 },
    })
    if (!treeRes.ok) {
      return NextResponse.json(
        { error: `Blizzard talent tree fetch failed: ${treeRes.status}` },
        { status: 502 }
      )
    }

    const raw = await treeRes.json()
    const nodes = parseBlizzardTree(raw)

    // Step 3: batch-fetch spell icons (cached 24h — only runs once per spec per day)
    const uniqueSpellIds = [
      ...new Set(nodes.map((n) => n.spellId).filter((id) => id > 0)),
    ]
    const iconMap = await fetchSpellIcons(uniqueSpellIds, token)

    const nodesWithIcons: TalentNode[] = nodes.map((n) => ({
      ...n,
      iconUrl: iconMap.get(n.spellId) ?? '',
    }))

    const result: TalentTreeData = { specId, nodes: nodesWithIcons }
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
    hero_talent_nodes?: BlizzardNode[]  // TWW hero talent tree
  }

  const allNodes = [
    ...(data.class_talent_nodes ?? []),
    ...(data.spec_talent_nodes ?? []),
    ...(data.hero_talent_nodes ?? []),
  ]

  return allNodes.map((node) => {
    const firstRank = node.ranks?.[0]
    // Standard nodes use `tooltip`; choice nodes use `choice_of_tooltips[0]`
    const tooltip = firstRank?.tooltip ?? firstRank?.choice_of_tooltips?.[0]
    return {
      id: node.id,
      row: node.display_row ?? 0,
      col: node.display_col ?? 0,
      name: tooltip?.talent?.name ?? 'Unknown',
      spellId: tooltip?.spell_tooltip?.spell?.id ?? 0,
      iconUrl: '',
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
  choice_of_tooltips?: BlizzardRankTooltip[]
}

interface BlizzardNode {
  id: number
  display_row?: number
  display_col?: number
  locked_by?: number[]
  unlocks?: number[]
  ranks?: BlizzardRank[]
}
