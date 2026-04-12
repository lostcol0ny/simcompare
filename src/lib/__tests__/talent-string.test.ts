import { describe, it, expect } from 'vitest'
import { decodeTalentString } from '../talent-string'

// Real talent string from the Demonology Warlock Raidbots report
const DEMO_TALENT_STRING = 'CoQAy0jxIDofkwJmoH7WhvESoxMMzoZzMz2MzYWGAAAAAAAwYGDL'

describe('decodeTalentString', () => {
  it('returns an array of selected talents', () => {
    const result = decodeTalentString(DEMO_TALENT_STRING)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('each talent has a nodeId and rank', () => {
    const result = decodeTalentString(DEMO_TALENT_STRING)
    for (const t of result) {
      expect(typeof t.nodeId).toBe('number')
      expect(typeof t.rank).toBe('number')
      expect(t.rank).toBeGreaterThan(0)
    }
  })

  it('throws on an empty string', () => {
    expect(() => decodeTalentString('')).toThrow()
  })
})
