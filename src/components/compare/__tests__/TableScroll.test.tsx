import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { makeReport } from '@/test/factories'
import { AbilitiesTab } from '../AbilitiesTab'
import { StatsTab } from '../StatsTab'
import { BuffsTab } from '../BuffsTab'

const reports = [
  makeReport({ id: 'a', characterName: 'Build A' }),
  makeReport({ id: 'b', characterName: 'Build B' }),
]

describe.each([
  ['Ability breakdown', AbilitiesTab],
  ['Stat comparison', StatsTab],
  ['Buffs and resources', BuffsTab],
])('%s scroll container', (label, Tab) => {
  it('is keyboard reachable and named', () => {
    render(<Tab reports={reports} />)
    const region = screen.getByRole('region', { name: label })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('table-scroll')
  })
})

/**
 * These grids are CSS grid, not <table>. `overflow-x: auto` alone never yields
 * a scrollbar on a grid whose columns are `1fr` — those columns just compress
 * to fit the container. `min-width: max-content` on the scrolling child is the
 * rule that actually forces overflow, so that is the rule worth asserting.
 *
 * jsdom does not load the app stylesheet, but it does apply an injected
 * <style> and resolve computed values from it. Injecting the real rule text
 * out of globals.css means this fails if the selector stops matching the
 * grids — which is exactly how the original `.table-scroll > table` bug (a
 * selector matching no element in this codebase) passed review as green.
 */
describe('table-scroll overflow rule', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

  // Held in describe scope so afterEach can remove it. Left in place the tags
  // accumulate across iterations; harmless while every iteration injects
  // identical rules, but it would later mask a real regression in the very
  // test guarding the selector bug.
  let style: HTMLStyleElement

  beforeEach(() => {
    // Only the .table-scroll rules: the full file has @import and @theme
    // blocks that jsdom's CSS parser cannot handle.
    const rules = css.match(/^\.table-scroll[^{]*\{[^}]*\}/gm) ?? []
    style = document.createElement('style')
    style.textContent = rules.join('\n')
    document.head.appendChild(style)
  })

  afterEach(() => {
    style.remove()
  })

  it('targets the real grid children, not a <table>', () => {
    expect(css).toMatch(/\.table-scroll\s*>\s*\*\s*\{[\s\S]*?min-width:\s*max-content/)
  })

  it.each([
    ['Ability breakdown', AbilitiesTab],
    ['Stat comparison', StatsTab],
    ['Buffs and resources', BuffsTab],
  ])('resolves min-width:max-content on every %s child', (label, Tab) => {
    render(<Tab reports={reports} />)
    const region = screen.getByRole('region', { name: label })

    const children = Array.from(region.children) as HTMLElement[]
    expect(children.length).toBeGreaterThan(0)
    for (const child of children) {
      expect(getComputedStyle(child).minWidth).toBe('max-content')
    }
  })
})
