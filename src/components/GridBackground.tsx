'use client'

import { useEffect, useRef, useCallback } from 'react'

const SPACING = 48
const DOT_RADIUS = 1.2
const INFLUENCE_RADIUS = 220
const PULL_STRENGTH = 35
const WAVE_AMP = 4
const WAVE_SPEED = 0.8

const MOTES = [
  { x: 0.3, y: 0.4, r: 180, color: [124, 58, 237] as const, speed: 0.15, phase: 0 },
  { x: 0.7, y: 0.3, r: 140, color: [59, 130, 246] as const, speed: 0.12, phase: 2 },
  { x: 0.5, y: 0.7, r: 160, color: [74, 222, 128] as const, speed: 0.1, phase: 4 },
]

interface Well {
  x: number
  y: number
  age: number
  maxAge: number
}

function wellStrength(w: Well): number {
  if (w.age < 0.05) return w.age / 0.05
  const decay = (w.age - 0.05) / (w.maxAge - 0.05)
  return Math.max(0, 1 - decay * decay)
}

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const wellsRef = useRef<Well[]>([])
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)

  const handleClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-grid-click]')) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    wellsRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      age: 0,
      maxAge: 0.5,
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = canvas!.offsetWidth * devicePixelRatio
      canvas!.height = canvas!.offsetHeight * devicePixelRatio
    }

    resize()
    window.addEventListener('resize', resize)

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('click', handleClick)

    lastTimeRef.current = performance.now()

    let animId: number

    function draw(now: number) {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now
      timeRef.current += dt

      const time = timeRef.current
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      const mouse = mouseRef.current
      const wells = wellsRef.current

      ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx!.clearRect(0, 0, w, h)

      const cols = Math.ceil(w / SPACING) + 2
      const rows = Math.ceil(h / SPACING) + 2
      const offsetX = (w % SPACING) / 2
      const offsetY = (h % SPACING) / 2

      for (const well of wells) well.age += dt
      const activeWells = wells.filter((wl) => wl.age < wl.maxAge)
      wellsRef.current = activeWells

      const motePos = MOTES.map((m) => ({
        x: (m.x + Math.sin(time * m.speed + m.phase) * 0.08) * w,
        y: (m.y + Math.cos(time * m.speed * 0.7 + m.phase) * 0.06) * h,
        r: m.r,
        color: m.color,
      }))

      const points: { x: number; y: number }[][] = []
      for (let row = -1; row < rows; row++) {
        points[row] = []
        for (let col = -1; col < cols; col++) {
          let bx = offsetX + col * SPACING
          let by = offsetY + row * SPACING

          bx += Math.sin(by * 0.02 + time * WAVE_SPEED) * WAVE_AMP
          by += Math.cos(bx * 0.02 + time * WAVE_SPEED * 0.8) * WAVE_AMP

          const cdx = bx - mouse.x
          const cdy = by - mouse.y
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy)
          if (cdist < INFLUENCE_RADIUS && cdist > 1) {
            const f = (1 - cdist / INFLUENCE_RADIUS) ** 2
            bx -= (cdx / cdist) * f * PULL_STRENGTH
            by -= (cdy / cdist) * f * PULL_STRENGTH
          }

          for (const wl of activeWells) {
            const wdx = bx - wl.x
            const wdy = by - wl.y
            const wdist = Math.sqrt(wdx * wdx + wdy * wdy)
            const wellRadius = 50
            if (wdist < wellRadius && wdist > 1) {
              const f = ((1 - wdist / wellRadius) ** 2) * wellStrength(wl)
              bx -= (wdx / wdist) * f * 12
              by -= (wdy / wdist) * f * 12
            }
          }

          points[row][col] = { x: bx, y: by }
        }
      }

      ctx!.strokeStyle = 'rgba(100, 116, 139, 0.06)'
      ctx!.lineWidth = 0.5

      for (let row = -1; row < rows; row++) {
        ctx!.beginPath()
        for (let col = -1; col < cols; col++) {
          const p = points[row][col]
          col === -1 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)
        }
        ctx!.stroke()
      }

      for (let col = -1; col < cols; col++) {
        ctx!.beginPath()
        for (let row = -1; row < rows; row++) {
          const p = points[row][col]
          row === -1 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y)
        }
        ctx!.stroke()
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const p = points[row][col]
          let tR = 8, tG = 10, tB = 18, tA = 0.12

          for (const mote of motePos) {
            const dx = p.x - mote.x
            const dy = p.y - mote.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < mote.r) {
              const glow = ((1 - dist / mote.r) ** 2) * 0.7
              tR += mote.color[0] * glow
              tG += mote.color[1] * glow
              tB += mote.color[2] * glow
              tA += glow * 0.8
            }
          }

          const cdx2 = p.x - mouse.x
          const cdy2 = p.y - mouse.y
          const cdist2 = Math.sqrt(cdx2 * cdx2 + cdy2 * cdy2)
          if (cdist2 < INFLUENCE_RADIUS) {
            const ci = 1 - cdist2 / INFLUENCE_RADIUS
            tR += 167 * ci * ci * 0.5
            tG += 139 * ci * ci * 0.5
            tB += 250 * ci * ci * 0.5
            tA += ci * ci * 0.6
          }

          tA = Math.min(tA, 1)
          const edgeDist = Math.min(p.y, h - p.y) / (h * 0.25)
          const tiltShift = Math.min(edgeDist, 1)
          const dotR = DOT_RADIUS * (0.4 + 0.6 * tiltShift)
          const dotA = tA * (0.3 + 0.7 * tiltShift)

          ctx!.beginPath()
          ctx!.arc(p.x, p.y, dotR, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(${Math.min(Math.round(tR), 255)}, ${Math.min(Math.round(tG), 255)}, ${Math.min(Math.round(tB), 255)}, ${dotA})`
          ctx!.fill()
        }
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('click', handleClick)
    }
  }, [handleClick])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  )
}
