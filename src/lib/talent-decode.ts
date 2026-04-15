import type { TalentTreeData, SelectedTalent } from '@/lib/types'

/**
 * Returns the authoritative slot map for decoding a talent string.
 *
 * The slot map is the ordered list of node IDs the game encoder uses when
 * writing the bitstream — one slot per node, in ascending node-ID order,
 * covering every node in the class (class tree + all specs' spec trees +
 * all hero trees). treeData.allSlotNodeIds is pre-computed and pre-sorted
 * by the talent-tree API route using that same union-then-sort algorithm.
 */
export function buildSlotMap(treeData: TalentTreeData): number[] {
  return treeData.allSlotNodeIds
}

/** Maps raw (slot-index) selections to real node IDs using the flat slot map. */
export function mapSelections(rawSel: SelectedTalent[], treeData: TalentTreeData): SelectedTalent[] {
  const slotIds = buildSlotMap(treeData)
  return rawSel
    .filter((s) => s.nodeId < slotIds.length)
    .map((s) => ({ nodeId: slotIds[s.nodeId], rank: s.rank, choiceIndex: s.choiceIndex }))
}

/**
 * Filters out nodes belonging to inactive hero trees.
 * Some talent strings encode inactive hero tree nodes as selected;
 * this removes them so only the active hero tree's nodes remain.
 */
export function filterInactiveHeroNodes(
  selections: SelectedTalent[],
  treeData: TalentTreeData,
  activeHeroName: string | null
): SelectedTalent[] {
  const heroTrees = treeData.heroTrees ?? []
  if (!heroTrees.length || !activeHeroName) return selections

  // Collect all node IDs from inactive hero trees
  const inactiveHeroIds = new Set<number>()
  for (const tree of heroTrees) {
    if (tree.name !== activeHeroName) {
      for (const id of tree.nodeIds) inactiveHeroIds.add(id)
    }
  }
  // Don't filter out nodes shared with the active tree
  const activeTree = heroTrees.find((t) => t.name === activeHeroName)
  if (activeTree) {
    for (const id of activeTree.nodeIds) inactiveHeroIds.delete(id)
  }

  return selections.filter((s) => !inactiveHeroIds.has(s.nodeId))
}

/**
 * Detects which hero tree is active across one or more sets of raw (unmapped) selections.
 *
 * Primary method: finds the sub_tree_selection node that was chosen in the build
 * and uses its choiceIndex to deterministically look up the active sub-tree ID,
 * then matches that against heroTrees[].id for the name.
 *
 * Fallback: exclusive-node scoring (nodes unique to one tree > shared nodes).
 */
export function detectHeroTree(rawSelections: SelectedTalent[][], treeData: TalentTreeData): string | null {
  const heroTrees = treeData.heroTrees ?? []
  if (!heroTrees.length) return null

  const slotIds = buildSlotMap(treeData)
  const selectionNodes = treeData.selectionNodes ?? {}

  // Build a reverse map: subTreeId → hero tree name
  const subTreeToName = new Map<number, string>()
  for (const tree of heroTrees) {
    if (tree.id !== undefined) {
      subTreeToName.set(tree.id, tree.name)
    }
  }

  // Primary: find a selected sub_tree_selection node with a choiceIndex.
  // Note: JSON keys are always strings at runtime even though the TS type uses number keys.
  for (const sel of rawSelections) {
    for (const s of sel) {
      if (s.nodeId >= slotIds.length) continue
      const nodeId = slotIds[s.nodeId]
      const choices = selectionNodes[nodeId] ?? selectionNodes[String(nodeId) as unknown as number]
      if (!choices || s.choiceIndex === undefined) continue
      const subTreeId = choices[s.choiceIndex] ?? choices[String(s.choiceIndex) as unknown as number]
      if (subTreeId === undefined) continue
      const name = subTreeToName.get(subTreeId)
      if (name) return name
    }
  }

  // Fallback: exclusive-node scoring
  const scores = heroTrees.map((tree) => {
    const otherIds = new Set(
      heroTrees.filter((t) => t.name !== tree.name).flatMap((t) => t.nodeIds)
    )
    const exclusiveIds = new Set(tree.nodeIds.filter((id) => !otherIds.has(id)))
    const treeIdSet = new Set(tree.nodeIds)
    let exclusiveMatches = 0
    let totalMatches = 0
    for (const sel of rawSelections) {
      for (const s of sel) {
        if (s.nodeId >= slotIds.length) continue
        const nodeId = slotIds[s.nodeId]
        if (exclusiveIds.has(nodeId)) exclusiveMatches++
        else if (treeIdSet.has(nodeId)) totalMatches++
      }
    }
    return { tree, exclusiveMatches, totalMatches }
  })
  scores.sort((a, b) => b.exclusiveMatches - a.exclusiveMatches || b.totalMatches - a.totalMatches)
  return scores[0]?.tree.name ?? null
}
