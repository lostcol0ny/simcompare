import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../globals.css'), 'utf8')

export function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))
  if (!match) throw new Error(`Token --${name} is not defined in globals.css`)
  return match[1].toLowerCase()
}

describe('design tokens', () => {
  it('defines a focus colour', () => {
    expect(readToken('color-focus')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('applies the focus ring via :focus-visible, not :focus', () => {
    expect(css).toContain(':focus-visible')
    expect(css).not.toMatch(/[^-]:focus\s*\{/)
  })
})
