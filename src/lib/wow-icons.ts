const CLASS_TO_ICON: Record<string, string> = {
  'Warrior': 'warrior',
  'Paladin': 'paladin',
  'Hunter': 'hunter',
  'Rogue': 'rogue',
  'Priest': 'priest',
  'Death Knight': 'deathknight',
  'Shaman': 'shaman',
  'Mage': 'mage',
  'Warlock': 'warlock',
  'Monk': 'monk',
  'Druid': 'druid',
  'Demon Hunter': 'demonhunter',
  'Evoker': 'evoker',
}

// Official WoW class colors
export const CLASS_COLORS: Record<string, string> = {
  'Warrior': '#C69B3A',
  'Paladin': '#F48CBA',
  'Hunter': '#AAD372',
  'Rogue': '#FFF468',
  'Priest': '#FFFFFF',
  'Death Knight': '#C41E3A',
  'Shaman': '#0070DD',
  'Mage': '#3FC7EB',
  'Warlock': '#8788EE',
  'Monk': '#00FF98',
  'Druid': '#FF7C0A',
  'Demon Hunter': '#A330C9',
  'Evoker': '#33937F',
}

function parseSpecialization(spec: string): { className: string; specName: string } {
  // Multi-word class names must be checked first
  for (const cls of ['Death Knight', 'Demon Hunter']) {
    if (spec.endsWith(cls)) {
      return { className: cls, specName: spec.slice(0, -cls.length).trim() }
    }
  }
  const parts = spec.trim().split(' ')
  if (parts.length < 2) return { className: spec, specName: '' }
  return { className: parts[parts.length - 1], specName: parts.slice(0, -1).join(' ') }
}

/** Returns the Blizzard CDN icon URL for a spec, e.g. "Demonology Warlock" */
export function getSpecIconUrl(specialization: string): string {
  const { className, specName } = parseSpecialization(specialization)
  const iconClass = CLASS_TO_ICON[className]
  if (!iconClass) return ''
  const specSlug = specName.replace(/\s+/g, '').toLowerCase()
  return `https://render.worldofwarcraft.com/us/icons/56/classicon_${iconClass}_${specSlug}.jpg`
}

export function getClassName(specialization: string): string {
  return parseSpecialization(specialization).className
}

export function getClassColor(specialization: string): string {
  const { className } = parseSpecialization(specialization)
  return CLASS_COLORS[className] ?? '#8788EE'
}
