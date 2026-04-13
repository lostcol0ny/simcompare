import type { SelectedTalent } from './types'

/**
 * The base64 alphabet used by SimC/Blizzard for talent strings.
 * Note: this is standard base64 (not base64url) — the string is read
 * 6 bits per character directly, not decoded to bytes first.
 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Decodes a WoW loadout export string into a list of selected talent nodes.
 *
 * Format (SimC source, thewarwithin branch):
 * The string is read as a bitstream: 6 bits per character, LSB first within
 * each character. It is NOT standard base64-decoded to bytes first.
 *
 * Header (152 bits total):
 *   - 8 bits:   serialization version (currently 2)
 *   - 16 bits:  spec ID
 *   - 128 bits: tree hash (ignored)
 *
 * Then for each node in the tree (in ascending node-ID order from game DB):
 *   - 1 bit:  selected? (0 = skip to next node)
 *   - 1 bit:  purchased? (1 = player chose it; 0 = passively granted)
 *   - 1 bit:  partial rank? (0 = at max rank)
 *   - 6 bits: rank count (only present when partial = 1)
 *   - 1 bit:  is choice node?
 *   - 2 bits: choice index (only present when is_choice = 1)
 *
 * Because node IDs come from the game database (not the string), we use the
 * zero-based slot index (position in bitstream order) as the nodeId. The
 * Spec Tree tab matches these against the Blizzard API node list sorted by ID.
 */
export function decodeTalentString(encoded: string): SelectedTalent[] {
  if (!encoded) throw new Error('Talent string must not be empty')

  // Build a lookup table for O(1) base64 character → value conversion
  const charValue = new Uint8Array(128).fill(255)
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    charValue[BASE64_ALPHABET.charCodeAt(i)] = i
  }

  // Validate all characters before decoding
  for (let i = 0; i < encoded.length; i++) {
    const code = encoded.charCodeAt(i)
    if (code >= 128 || charValue[code] === 255) {
      throw new Error(`Invalid character in talent string at position ${i}: '${encoded[i]}'`)
    }
  }

  let head = 0
  let currentCharValue = charValue[encoded.charCodeAt(0)]

  function getBits(n: number): number {
    let val = 0
    for (let i = 0; i < n; i++) {
      const bitPos = head % 6
      head++
      val |= ((currentCharValue >> bitPos) & 1) << i
      // Advance to next base64 character every 6 bits
      if (bitPos === 5) {
        const charIdx = Math.floor(head / 6)
        currentCharValue = charIdx < encoded.length ? charValue[encoded.charCodeAt(charIdx)] : 0
      }
    }
    return val
  }

  // Read and validate header
  const version = getBits(8)
  if (version !== 2) {
    throw new Error(`Unsupported talent string version: ${version} (expected 2)`)
  }

  getBits(16)  // spec ID — available if needed by callers
  getBits(128) // tree hash — ignored

  // Read per-node selections from the remaining bitstream
  const selected: SelectedTalent[] = []
  let nodeSlot = 0

  while (head < encoded.length * 6) {
    const isSelected = getBits(1)
    if (!isSelected) {
      nodeSlot++
      continue
    }

    const isPurchased = getBits(1)
    if (!isPurchased) {
      // Passively granted (auto-selected, e.g. hero spec entry node).
      // The encoder writes only the two header bits (selected=1, purchased=0)
      // and nothing else — no rank, no choice bits.
      selected.push({ nodeId: nodeSlot, rank: 1 })
      nodeSlot++
      continue
    }

    const isPartial = getBits(1)
    // When isPartial=0 the node is at max rank. Since we don't have the game
    // DB here, we use rank=1 as a stand-in. This is correct for the majority
    // of talents (single-rank nodes). Multi-rank nodes at max rank will show
    // rank=1 instead of their true max — acceptable since the Spec Tree only
    // needs selected/unselected state, not the precise rank value.
    const rank = isPartial ? getBits(6) : 1

    const isChoice = getBits(1)
    const choiceIndex = isChoice ? getBits(2) : undefined

    selected.push({ nodeId: nodeSlot, rank, ...(choiceIndex !== undefined && { choiceIndex }) })
    nodeSlot++
  }

  if (selected.length === 0) {
    throw new Error('No talents decoded — string may be malformed')
  }

  return selected
}
