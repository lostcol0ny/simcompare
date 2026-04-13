import { NextRequest, NextResponse } from 'next/server'
import type { TalentTreeData, TalentNode, HeroTree } from '@/lib/types'

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

async function fetchIconUrl(
  endpoint: string,
  token: string
): Promise<string> {
  const res = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
      })
  if (!res.ok) return ''
  const data = await res.json()
  return (
    (data.assets as Array<{ key: string; value: string }> | undefined)?.find(
      (a) => a.key === 'icon'
    )?.value ?? ''
  )
}

/** Fetch spell icon URLs with bounded concurrency to avoid rate limiting. */
async function fetchSpellIcons(
  spellIds: number[],
  token: string,
  concurrency = 15
): Promise<Map<number, string>> {
  const map = new Map<number, string>()

  for (let i = 0; i < spellIds.length; i += concurrency) {
    const chunk = spellIds.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      chunk.map(async (spellId) => {
        const url = await fetchIconUrl(
          `${API_BASE}/data/wow/media/spell/${spellId}?namespace=static-us`,
          token
        )
        return { spellId, url }
      })
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        map.set(result.value.spellId, result.value.url)
      }
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
          })
    if (!treeRes.ok) {
      return NextResponse.json(
        { error: `Blizzard talent tree fetch failed: ${treeRes.status}` },
        { status: 502 }
      )
    }

    const raw = await treeRes.json()
    const { nodes, classNodeIds, specNodeIds, heroNodeIds, heroTrees } = parseBlizzardTree(raw)

    // Step 3: fetch spec icon + batch-fetch spell icons concurrently
    const uniqueSpellIds = [
      ...new Set(nodes.map((n) => n.spellId).filter((id) => id > 0)),
    ]
    const [specIconUrl, iconMap] = await Promise.all([
      fetchIconUrl(
        `${API_BASE}/data/wow/media/playable-specialization/${specId}?namespace=static-us`,
        token
      ),
      fetchSpellIcons(uniqueSpellIds, token),
    ])

    const nodesWithIcons: TalentNode[] = nodes.map((n) => ({
      ...n,
      iconUrl: iconMap.get(n.spellId) ?? '',
    }))

    const result: TalentTreeData = {
      specId,
      nodes: nodesWithIcons,
      classNodeIds,
      specNodeIds,
      heroNodeIds,
      heroTrees,
      specIconUrl,
    }
    return NextResponse.json(result, {
      // Cache at CDN for 24h; browsers revalidate so a new deployment is never stale
      headers: { 'Cache-Control': 'public, no-cache, s-maxage=86400' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseBlizzardTree(raw: unknown): { nodes: TalentNode[], classNodeIds: number[], specNodeIds: number[], heroNodeIds: number[], heroTrees: HeroTree[] } {
  const data = raw as {
    class_talent_nodes?: BlizzardNode[]
    spec_talent_nodes?: BlizzardNode[]
    hero_talent_trees?: Array<{
      id: number
      name: string
      hero_talent_nodes?: BlizzardNode[]
    }>
  }

  const rawHeroTrees = data.hero_talent_trees ?? []

  // Deduplicate: the same node can appear in multiple hero trees (shared capstone nodes)
  const heroNodeMap = new Map<number, BlizzardNode>()
  for (const tree of rawHeroTrees) {
    for (const node of tree.hero_talent_nodes ?? []) {
      if (!heroNodeMap.has(node.id)) heroNodeMap.set(node.id, node)
    }
  }
  const heroBlizzardNodes = [...heroNodeMap.values()]
  const heroNodeIds = heroBlizzardNodes.map((n) => n.id)

  // Build per-tree node ID lists for hero tree filtering in the UI
  const heroTrees: HeroTree[] = rawHeroTrees.map((tree) => ({
    name: tree.name,
    nodeIds: (tree.hero_talent_nodes ?? []).map((n) => n.id),
  }))

  const classBlizzardNodes = data.class_talent_nodes ?? []
  const specBlizzardNodes = data.spec_talent_nodes ?? []

  const classNodeIds = classBlizzardNodes.map((n) => n.id)
  const specNodeIds = specBlizzardNodes.map((n) => n.id)

  const allNodes = [
    ...classBlizzardNodes,
    ...specBlizzardNodes,
    ...heroBlizzardNodes,
  ]

  const nodes = allNodes.map((node) => {
    const firstRank = node.ranks?.[0]
    const choiceTooltips = firstRank?.choice_of_tooltips
    // Standard nodes use `tooltip`; choice nodes use `choice_of_tooltips[0]`
    const tooltip = firstRank?.tooltip ?? choiceTooltips?.[0]
    const choiceNames = choiceTooltips && choiceTooltips.length > 1
      ? choiceTooltips.map((t) => t.talent?.name ?? 'Unknown')
      : undefined
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
      ...(choiceNames && { choiceNames }),
    }
  })

  return { nodes, classNodeIds, specNodeIds, heroNodeIds, heroTrees }
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
