/**
 * Maps Raidbots specialization strings to Blizzard spec IDs.
 * Full list: https://wowpedia.fandom.com/wiki/SpecializationID
 */
export const SPEC_ID_MAP: Record<string, number> = {
  'Affliction Warlock': 265,
  'Demonology Warlock': 266,
  'Destruction Warlock': 267,
  'Balance Druid': 102,
  'Feral Druid': 103,
  'Guardian Druid': 104,
  'Restoration Druid': 105,
  'Beast Mastery Hunter': 253,
  'Marksmanship Hunter': 254,
  'Survival Hunter': 255,
  'Arcane Mage': 62,
  'Fire Mage': 63,
  'Frost Mage': 64,
  'Windwalker Monk': 269,
  'Brewmaster Monk': 268,
  'Mistweaver Monk': 270,
  'Holy Paladin': 65,
  'Protection Paladin': 66,
  'Retribution Paladin': 70,
  'Discipline Priest': 256,
  'Holy Priest': 257,
  'Shadow Priest': 258,
  'Assassination Rogue': 259,
  'Outlaw Rogue': 260,
  'Subtlety Rogue': 261,
  'Elemental Shaman': 262,
  'Enhancement Shaman': 263,
  'Restoration Shaman': 264,
  'Arms Warrior': 71,
  'Fury Warrior': 72,
  'Protection Warrior': 73,
  'Blood Death Knight': 250,
  'Frost Death Knight': 251,
  'Unholy Death Knight': 252,
  'Havoc Demon Hunter': 577,
  'Vengeance Demon Hunter': 581,
  'Devastation Evoker': 1467,
  'Preservation Evoker': 1468,
  'Augmentation Evoker': 1473,
}

export function getSpecId(specialization: string): number | null {
  return SPEC_ID_MAP[specialization] ?? null
}

/**
 * All specs grouped by class. Used to fetch sibling-spec talent nodes, which
 * occupy slots in the talent string encoding even though they're never selected
 * for a different spec's build.
 */
const CLASS_SPEC_GROUPS: number[][] = [
  [265, 266, 267],        // Warlock
  [102, 103, 104, 105],   // Druid
  [253, 254, 255],        // Hunter
  [62, 63, 64],           // Mage
  [268, 269, 270],        // Monk
  [65, 66, 70],           // Paladin
  [256, 257, 258],        // Priest
  [259, 260, 261],        // Rogue
  [262, 263, 264],        // Shaman
  [71, 72, 73],           // Warrior
  [250, 251, 252],        // Death Knight
  [577, 581],             // Demon Hunter
  [1467, 1468, 1473],     // Evoker
]

/** Returns the spec IDs of all other specs in the same class as the given spec. */
export function getSiblingSpecIds(specId: number): number[] {
  const group = CLASS_SPEC_GROUPS.find((g) => g.includes(specId))
  return group ? group.filter((id) => id !== specId) : []
}

/**
 * Maps Blizzard spec ID → SimulationCraft class ID (1-13).
 * SimC class IDs are used as keys in simc-slot-maps.json.
 */
const SPEC_TO_SIMC_CLASS: Record<number, number> = {
  // Warrior (1)
  71: 1, 72: 1, 73: 1,
  // Paladin (2)
  65: 2, 66: 2, 70: 2,
  // Hunter (3)
  253: 3, 254: 3, 255: 3,
  // Rogue (4)
  259: 4, 260: 4, 261: 4,
  // Priest (5)
  256: 5, 257: 5, 258: 5,
  // Death Knight (6)
  250: 6, 251: 6, 252: 6,
  // Shaman (7)
  262: 7, 263: 7, 264: 7,
  // Mage (8)
  62: 8, 63: 8, 64: 8,
  // Warlock (9)
  265: 9, 266: 9, 267: 9,
  // Monk (10)
  268: 10, 269: 10, 270: 10,
  // Druid (11)
  102: 11, 103: 11, 104: 11, 105: 11,
  // Demon Hunter (12)
  577: 12, 581: 12,
  // Evoker (13)
  1467: 13, 1468: 13, 1473: 13,
}

/** Returns the SimC class ID for a given Blizzard spec ID, or null if unknown. */
export function getSimcClassId(specId: number): number | null {
  return SPEC_TO_SIMC_CLASS[specId] ?? null
}
