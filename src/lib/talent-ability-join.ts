import type { TalentNode, ParsedAbility } from '@/lib/types'

function collectAbilityIds(abilities: ParsedAbility[], into: Set<number> = new Set()): Set<number> {
  for (const ability of abilities) {
    into.add(ability.id)
    collectAbilityIds(ability.children, into)
  }
  return into
}

/**
 * Talents and abilities are joined on the spell they share. Most talents are
 * passive modifiers with no ability of their own, so an unmatched talent is
 * the normal case, not an error.
 */
export function joinTalentsToAbilities(
  nodes: TalentNode[],
  abilities: ParsedAbility[]
): Map<number, number> {
  const abilityIds = collectAbilityIds(abilities)
  const map = new Map<number, number>()
  for (const node of nodes) {
    if (abilityIds.has(node.spellId)) map.set(node.id, node.spellId)
  }
  return map
}

export function measureJoinCoverage(
  nodes: TalentNode[],
  abilities: ParsedAbility[]
): { total: number; matched: number; ratio: number } {
  const matched = joinTalentsToAbilities(nodes, abilities).size
  return { total: nodes.length, matched, ratio: nodes.length === 0 ? 0 : matched / nodes.length }
}
