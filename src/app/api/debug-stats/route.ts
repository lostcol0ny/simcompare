import { NextRequest, NextResponse } from 'next/server'
import { decodeTalentString } from '@/lib/talent-string'

const TOKEN_URL = 'https://oauth.battle.net/token'
const API_BASE = 'https://us.api.blizzard.com'

async function getToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.BLIZZARD_CLIENT_ID}:${process.env.BLIZZARD_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    if (!res.ok) return { ok: false, error: `OAuth ${res.status}: ${await res.text()}` }
    const d = await res.json()
    return { ok: true, token: d.access_token }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

interface RawNode {
  id: number
  display_row?: number
  display_col?: number
  raw_position_x?: number
  raw_position_y?: number
  ranks?: Array<{
    rank: number
    tooltip?: { talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { id?: number } } }
    choice_of_tooltips?: Array<{ talent?: { name?: string; id?: number }; spell_tooltip?: { spell?: { id?: number } } }>
  }>
}

function getSpellId(node: RawNode): number {
  const firstRank = node.ranks?.[0]
  const tooltip = firstRank?.tooltip ?? firstRank?.choice_of_tooltips?.[0]
  return tooltip?.spell_tooltip?.spell?.id ?? 0
}

function getNodeName(node: RawNode): string {
  const firstRank = node.ranks?.[0]
  const tooltip = firstRank?.tooltip ?? firstRank?.choice_of_tooltips?.[0]
  return tooltip?.talent?.name ?? 'Unknown'
}

export async function GET(req: NextRequest) {
  const reportId = req.nextUrl.searchParams.get('id')
  const specId = req.nextUrl.searchParams.get('spec') ?? '266'

  const tokenResult = await getToken()
  if (!tokenResult.ok) {
    return NextResponse.json({ error: 'Token fetch failed', detail: tokenResult.error })
  }
  const token = tokenResult.token

  const results: Record<string, unknown> = { tokenOk: true }
  let talentString: string | null = null

  // --- Buffed stats + talent string from report ---
  if (reportId && /^[A-Za-z0-9]+$/.test(reportId)) {
    try {
      const res = await fetch(`https://www.raidbots.com/simbot/report/${reportId}/data.json`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SimCompare/1.0)' },
      })
      if (res.ok) {
        const data = await res.json()
        const player = data?.sim?.players?.[0]
        results.buffedStats = player?.collected_data?.buffed_stats
        talentString = player?.talents ?? null
        results.talentStringRaw = talentString
      } else {
        results.reportError = `Raidbots ${res.status}`
      }
    } catch (e) {
      results.reportError = String(e)
    }
  }

  // --- Talent tree: coordinates, ghost nodes, icons, talent string decode ---
  try {
    const specDataRes = await fetch(
      `${API_BASE}/data/wow/playable-specialization/${specId}?namespace=static-us&locale=en_US`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    results.specDataStatus = specDataRes.status
    if (!specDataRes.ok) {
      results.specDataError = await specDataRes.text()
    }
    if (specDataRes.ok) {
      const specData = await specDataRes.json()
      const treeHref = specData?.spec_talent_tree?.key?.href
      results.treeHref = treeHref ?? null
      if (treeHref) {
        const treeUrl = new URL(treeHref)
        treeUrl.searchParams.set('locale', 'en_US')
        const treeRes = await fetch(treeUrl.toString(), { headers: { Authorization: `Bearer ${token}` } })
        results.treeDataStatus = treeRes.status
        if (!treeRes.ok) results.treeDataError = await treeRes.text()
        if (treeRes.ok) {
          const raw = await treeRes.json() as Record<string, unknown>
          const classNodes = (raw.class_talent_nodes as RawNode[] | undefined) ?? []
          const specNodes = (raw.spec_talent_nodes as RawNode[] | undefined) ?? []
          const heroTrees = (raw.hero_talent_trees as Array<{name:string; hero_talent_nodes?: RawNode[]}> | undefined) ?? []

          const heroNodeMap = new Map<number, RawNode>()
          for (const tree of heroTrees) {
            for (const node of tree.hero_talent_nodes ?? []) {
              if (!heroNodeMap.has(node.id)) heroNodeMap.set(node.id, node)
            }
          }
          const heroNodes = [...heroNodeMap.values()]

          // Coordinate ranges per section
          function coordRange(nodes: RawNode[]) {
            if (nodes.length === 0) return null
            const rows = nodes.map(n => n.display_row ?? 0)
            const cols = nodes.map(n => n.display_col ?? 0)
            const rawX = nodes.map(n => n.raw_position_x ?? 0)
            const rawY = nodes.map(n => n.raw_position_y ?? 0)
            return {
              row: [Math.min(...rows), Math.max(...rows)],
              col: [Math.min(...cols), Math.max(...cols)],
              raw_x: [Math.min(...rawX), Math.max(...rawX)],
              raw_y: [Math.min(...rawY), Math.max(...rawY)],
            }
          }
          results.coordRanges = {
            class: coordRange(classNodes),
            spec: coordRange(specNodes),
            hero: coordRange(heroNodes),
          }

          // Nodes with no spell ID (will show text fallback, no icon)
          const noSpellNodes = [...classNodes, ...specNodes, ...heroNodes]
            .filter(n => getSpellId(n) === 0)
            .map(n => ({ id: n.id, name: getNodeName(n), row: n.display_row, col: n.display_col }))
          results.noSpellNodes = noSpellNodes
          results.noSpellCount = noSpellNodes.length

          // Ghost node analysis
          const allIds = [...classNodes, ...specNodes, ...heroNodes].map(n => n.id).sort((a, b) => a - b)
          results.treeNodeCount = { class: classNodes.length, spec: specNodes.length, hero: heroNodes.length, total: allIds.length }

          const MAX_GHOST_GAP = 5
          const gaps: Array<{after: number; missing: number[]}> = []
          let ghostCount = 0
          for (let i = 1; i < allIds.length; i++) {
            const gap = allIds[i] - allIds[i - 1] - 1
            if (gap > 0 && gap <= MAX_GHOST_GAP) {
              const missing: number[] = []
              for (let g = 1; g <= gap; g++) missing.push(allIds[i - 1] + g)
              gaps.push({ after: allIds[i - 1], missing })
              ghostCount += gap
            }
          }
          results.ghostNodeAnalysis = { gaps, ghostCount, totalSlots: allIds.length + ghostCount }

          // Ghost-aware slot list
          const slotIds: number[] = []
          for (let i = 0; i < allIds.length; i++) {
            slotIds.push(allIds[i])
            if (i + 1 < allIds.length) {
              const gap = allIds[i + 1] - allIds[i] - 1
              if (gap > 0 && gap <= MAX_GHOST_GAP) {
                for (let g = 1; g <= gap; g++) slotIds.push(-(allIds[i] + g))
              }
            }
          }

          // Decode talent string
          if (talentString) {
            try {
              const decoded = decodeTalentString(talentString)
              results.decodedSlotCount = decoded.length
              results.maxDecodedSlot = Math.max(...decoded.map(s => s.nodeId))
              results.decodedSlots = decoded.map(s => s.nodeId)
              const liveIdSet = new Set(allIds)
              results.mappedNodeIds = decoded
                .filter(s => s.nodeId < slotIds.length && liveIdSet.has(slotIds[s.nodeId]))
                .map(s => slotIds[s.nodeId])
            } catch (e) {
              results.talentDecodeError = String(e)
            }
          }

          // Hero tree per-spec node IDs (for filtering diagnostic)
          results.heroTreeNodeIds = heroTrees.map(t => ({
            name: t.name,
            nodeIds: (t.hero_talent_nodes ?? []).map(n => n.id),
          }))
        }
      }
    }
  } catch (e) {
    results.treeError = String(e)
  }

  return NextResponse.json(results)
}
