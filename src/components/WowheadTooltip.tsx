'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    $WowheadPower?: { refreshLinks?: () => void }
    whTooltips?: { colorLinks: boolean; iconizeLinks: boolean; renameLinks: boolean }
  }
}

/**
 * Loads the Wowhead tooltip script once. Mount this component anywhere
 * in the tree that uses WowheadSpellLink — it's safe to mount multiple times.
 */
export function WowheadTooltipLoader() {
  useEffect(() => {
    // Configure before script loads
    window.whTooltips = { colorLinks: false, iconizeLinks: false, renameLinks: false }

    if (document.getElementById('wowhead-tooltip-script')) return

    const script = document.createElement('script')
    script.id = 'wowhead-tooltip-script'
    script.src = 'https://wow.zamimg.com/js/tooltips.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return null
}

/**
 * After dynamic content renders (e.g. talent list), call this to make
 * Wowhead re-scan the page for new spell links.
 */
export function refreshWowheadLinks() {
  window.$WowheadPower?.refreshLinks?.()
}

interface SpellLinkProps {
  spellId: number
  children: React.ReactNode
  className?: string
}

/**
 * Renders an anchor tag that Wowhead's tooltip script will auto-enhance.
 */
export function WowheadSpellLink({ spellId, children, className }: SpellLinkProps) {
  if (!spellId) return <span className={className}>{children}</span>

  return (
    <a
      href={`https://www.wowhead.com/spell=${spellId}`}
      data-wowhead={`spell=${spellId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px dotted #475569' }}
    >
      {children}
    </a>
  )
}
