import { computeAbilityDeltas } from '../ability-delta'
import type { Report, ParsedAbility } from '@/lib/types'

function ability(id: number, spellName: string, dps: number): ParsedAbility {
  return { id, spellName, school: 'shadow', dps, dpsStdDev: 0, castsPerFight: 0, percentOfTotal: 0, children: [] }
}

function report(dps: number, abilities: ParsedAbility[]): Report {
  return { dps, abilities } as Report
}

const baseline = report(1_284_910, [
  ability(1, 'Demonbolt', 341_220),
  ability(2, 'Implosion', 98_400),
  ability(3, 'Hand of Gul\'dan', 211_300),
])
const compared = report(1_246_332, [
  ability(1, 'Demonbolt', 317_110),
  ability(2, 'Implosion', 110_800),
  ability(3, 'Hand of Gul\'dan', 200_000),
])

describe('computeAbilityDeltas', () => {
  it('reports the total delta between the two builds', () => {
    expect(computeAbilityDeltas(baseline, compared).total).toBe(-38_578)
  })

  it('sorts rows by absolute impact', () => {
    const { rows } = computeAbilityDeltas(baseline, compared)
    expect(rows.map((r) => r.name)).toEqual(['Demonbolt', 'Implosion', "Hand of Gul'dan"])
  })

  it('signs each delta from the compared build\'s point of view', () => {
    const { rows } = computeAbilityDeltas(baseline, compared)
    expect(rows.find((r) => r.name === 'Implosion')!.delta).toBe(12_400)
    expect(rows.find((r) => r.name === 'Demonbolt')!.delta).toBe(-24_110)
  })

  it('accounts for every point of the total, including truncated rows', () => {
    const { rows, remainder, total } = computeAbilityDeltas(baseline, compared, 1)
    expect(rows).toHaveLength(1)
    expect(rows.reduce((sum, r) => sum + r.delta, 0) + remainder).toBe(total)
  })

  it('includes abilities present in only one build', () => {
    const onlyInCompared = report(100, [ability(9, 'Doom', 100)])
    const { rows } = computeAbilityDeltas(report(0, []), onlyInCompared)
    expect(rows).toEqual([{ id: 9, name: 'Doom', baseline: 0, compared: 100, delta: 100 }])
  })
})
