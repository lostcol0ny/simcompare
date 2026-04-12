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
