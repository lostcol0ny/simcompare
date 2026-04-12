import { describe, it, expect } from 'vitest'
import { encodeReportIds, decodeReportIds } from '../url-params'

describe('encodeReportIds', () => {
  it('encodes a list of IDs into a comma-separated string', () => {
    const result = encodeReportIds(['abc', 'def', 'ghi'])
    expect(result).toBe('abc,def,ghi')
  })

  it('returns empty string for empty list', () => {
    expect(encodeReportIds([])).toBe('')
  })
})

describe('decodeReportIds', () => {
  it('decodes a comma-separated string into a list of IDs', () => {
    expect(decodeReportIds('abc,def,ghi')).toEqual(['abc', 'def', 'ghi'])
  })

  it('returns empty array for empty string', () => {
    expect(decodeReportIds('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(decodeReportIds(null)).toEqual([])
    expect(decodeReportIds(undefined)).toEqual([])
  })

  it('filters out blank entries', () => {
    expect(decodeReportIds('abc,,def')).toEqual(['abc', 'def'])
  })
})
