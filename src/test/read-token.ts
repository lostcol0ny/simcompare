import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

/** Read a CSS custom-property value (must be a 6-digit hex) from globals.css. */
export function readToken(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`Token --${name} is not defined in globals.css`)
  return match[1].toLowerCase()
}
