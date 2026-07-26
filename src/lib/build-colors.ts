/**
 * Hue identifies a build and nothing else. Valence is carried by position
 * (which side of a centre line a bar falls on) and by an explicit sign, so
 * no information here is lost to red-green colour deficiency.
 *
 * The order is load-bearing; do not sort or "tidy" it.
 *
 * - No amber. Any near-amber value is confusable on screen with
 *   `--color-warning` (#fbbf24), which renders in the same Abilities table as
 *   the build-coloured columns. Differing as a hex string is not enough.
 * - Teal sits at slot 5, not slot 4, to keep it clear of cyan at slot 1.
 *   Builds are compared 2-5 at a time, so slots 0-4 are the ones that share a
 *   screen in practice; moving teal out of that window raises the worst-case
 *   RGB separation within it from 48 to 106.
 * - Slot 0 is fixed at #a78bfa: buildFill(0) is asserted as
 *   `rgb(167 139 250 / 0.18)`.
 */
export const BUILD_HUES = [
  '#a78bfa', // A  violet
  '#22d3ee', // B  cyan
  '#f472b6', // C  pink
  '#a3e635', // D  lime
  '#fb923c', // E  orange
  '#2dd4bf', // F  teal
  '#818cf8', // G  indigo
  '#e879f9', // H  fuchsia
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
