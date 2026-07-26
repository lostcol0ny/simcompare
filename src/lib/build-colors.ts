/**
 * Hue identifies a build and nothing else. Valence is carried by position
 * (which side of a centre line a bar falls on) and by an explicit sign, so
 * no information here is lost to red-green colour deficiency.
 */
export const BUILD_HUES = [
  '#a78bfa', // A  violet
  '#22d3ee', // B  cyan
  '#fbbf24', // C  amber
  '#f472b6', // D  pink
  '#2dd4bf', // E  teal
  '#fb923c', // F  orange
  '#818cf8', // G  indigo
  '#a3e635', // H  lime
] as const

export function buildHue(index: number): string {
  return BUILD_HUES[index % BUILD_HUES.length]
}

export function buildFill(index: number, alpha = 0.18): string {
  const hex = buildHue(index)
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}
