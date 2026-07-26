import { readFileSync } from 'node:fs'
import path from 'node:path'
import { BUILD_HUES, buildHue, buildFill, buildRgb } from '../build-colors'

const css = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8')

function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!match) throw new Error(`Token --${name} is not defined in globals.css`)
  return match[1].toLowerCase()
}

describe('build colour ramp', () => {
  it('provides eight distinct hues', () => {
    expect(BUILD_HUES).toHaveLength(8)
    expect(new Set(BUILD_HUES).size).toBe(8)
  })

  it('never reuses a semantic or chrome token as a build hue', () => {
    const reserved = [
      'color-positive',
      'color-negative',
      'color-warning',
      'color-accent',
      'color-accent-light',
      'color-accent-muted',
    ].map(readToken)
    for (const hue of BUILD_HUES) {
      expect(reserved).not.toContain(hue.toLowerCase())
    }
  })

  it('wraps past the end of the ramp', () => {
    expect(buildHue(0)).toBe(BUILD_HUES[0])
    expect(buildHue(8)).toBe(BUILD_HUES[0])
    expect(buildHue(9)).toBe(BUILD_HUES[1])
  })

  it('derives fills from the hue rather than hard-coding them', () => {
    expect(buildFill(0)).toBe('rgb(167 139 250 / 0.18)')
    expect(buildFill(0, 0.5)).toBe('rgb(167 139 250 / 0.5)')
  })

  it('returns numeric rgb triplets for canvas use', () => {
    expect(buildRgb(0)).toEqual([167, 139, 250])  // #a78bfa violet
    expect(buildRgb(1)).toEqual([34, 211, 238])   // #22d3ee cyan
    expect(buildRgb(2)).toEqual([244, 114, 182])  // #f472b6 pink
    expect(buildRgb(8)).toEqual(buildRgb(0))      // wraps like buildHue
  })
})
