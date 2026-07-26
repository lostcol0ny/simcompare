import { joinTalentsToAbilities, measureJoinCoverage } from '../talent-ability-join'
import type { TalentNode, ParsedAbility } from '@/lib/types'

function node(id: number, spellId: number, name: string): TalentNode {
  return { id, row: 0, col: 0, name, spellId, iconUrl: '', maxRank: 1, lockedBy: [], connects: [] }
}

function ability(id: number, spellName: string, dps: number, children: ParsedAbility[] = []): ParsedAbility {
  return { id, spellName, school: 'shadow', dps, dpsStdDev: 0, castsPerFight: 0, percentOfTotal: 0, children }
}

describe('joinTalentsToAbilities', () => {
  it('matches a talent to the ability sharing its spell id', () => {
    const map = joinTalentsToAbilities([node(1, 196277, 'Implosion')], [ability(196277, 'Implosion', 98400)])
    expect(map.get(1)).toBe(196277)
  })

  it('omits talents with no matching ability', () => {
    const map = joinTalentsToAbilities([node(2, 999999, 'Sacrificed Souls')], [ability(196277, 'Implosion', 98400)])
    expect(map.has(2)).toBe(false)
  })

  it('matches against nested child abilities', () => {
    const abilities = [ability(1, 'Wild Imps', 0, [ability(196277, 'Implosion', 98400)])]
    const map = joinTalentsToAbilities([node(3, 196277, 'Implosion')], abilities)
    expect(map.get(3)).toBe(196277)
  })
})

describe('measureJoinCoverage', () => {
  it('reports the matched fraction', () => {
    const nodes = [node(1, 196277, 'Implosion'), node(2, 999999, 'Sacrificed Souls')]
    const result = measureJoinCoverage(nodes, [ability(196277, 'Implosion', 98400)])
    expect(result).toEqual({ total: 2, matched: 1, ratio: 0.5 })
  })

  it('reports zero ratio rather than dividing by zero', () => {
    expect(measureJoinCoverage([], [])).toEqual({ total: 0, matched: 0, ratio: 0 })
  })
})
