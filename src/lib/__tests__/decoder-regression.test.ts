import { describe, it, expect } from 'vitest'
import { decodeTalentString } from '../talent-string'
import simcSlotMaps from '../../data/simc-slot-maps.json'
import fixtures from './fixtures/decoder-fixtures.json'

interface Fixture {
  reportId: string
  characterName: string
  specialization: string
  specId: number
  simcClassId: number
  talentString: string
  heroTreeName: string
  heroTreeId: number
  selectedNodeIds: number[]
}

const slotMaps = (simcSlotMaps as { slotMaps: Record<string, number[]> }).slotMaps

describe('decoder regression: real Raidbots reports', () => {
  for (const fx of Object.values(fixtures as Record<string, Fixture>)) {
    describe(`${fx.specialization} — ${fx.heroTreeName}`, () => {
      const slotMap = slotMaps[String(fx.simcClassId)]
      const decoded = decodeTalentString(fx.talentString)
      const decodedIds = new Set(
        decoded
          .filter((s) => s.nodeId < slotMap.length)
          .map((s) => slotMap[s.nodeId])
      )

      it('decodes every node Blizzard reports as selected', () => {
        const missing = fx.selectedNodeIds.filter((id) => !decodedIds.has(id))
        expect(missing).toEqual([])
      })
    })
  }
})
