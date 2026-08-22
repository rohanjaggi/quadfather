'use client'

import { useEffect, useState } from 'react'
import type { MuscleZone } from '@/lib/muscle-zones'

/**
 * The four body-path modules are ~98 KB of SVG path data combined. Only the
 * pair for the user's sex is ever drawn, so they are code-split and fetched on
 * demand instead of shipped in every page's first-load bundle.
 */
interface BodyPaths {
  frontPaths: Partial<Record<MuscleZone, string[]>>
  frontViewBox: string
  frontHair: string[]
  frontHead: string[]
  frontStructure: string[]
  backPaths: Partial<Record<MuscleZone, string[]>>
  backViewBox: string
  backHair: string[]
  backHead: string[]
  backStructure: string[]
}

const pathCache = new Map<'male' | 'female', Promise<BodyPaths>>()

async function loadMalePaths(): Promise<BodyPaths> {
  const [front, back] = await Promise.all([
    import('@/lib/muscle-map-front-paths'),
    import('@/lib/muscle-map-back-paths'),
  ])
  return {
    frontPaths: front.FRONT_PATHS,
    frontViewBox: front.FRONT_VIEWBOX,
    frontHair: [front.FRONT_HAIR],
    frontHead: [front.FRONT_HEAD],
    frontStructure: front.FRONT_STRUCTURE,
    backPaths: back.BACK_PATHS,
    backViewBox: back.BACK_VIEWBOX,
    backHair: [back.BACK_HAIR],
    backHead: [back.BACK_HEAD],
    backStructure: back.BACK_STRUCTURE,
  }
}

async function loadFemalePaths(): Promise<BodyPaths> {
  const [front, back] = await Promise.all([
    import('@/lib/muscle-map-female-front-paths'),
    import('@/lib/muscle-map-female-back-paths'),
  ])
  return {
    frontPaths: front.FEMALE_FRONT_PATHS,
    frontViewBox: front.FEMALE_FRONT_VIEWBOX,
    frontHair: front.FEMALE_FRONT_HAIR,
    frontHead: front.FEMALE_FRONT_HEAD,
    frontStructure: front.FEMALE_FRONT_STRUCTURE,
    backPaths: back.FEMALE_BACK_PATHS,
    backViewBox: back.FEMALE_BACK_VIEWBOX,
    backHair: back.FEMALE_BACK_HAIR,
    backHead: [],
    backStructure: back.FEMALE_BACK_STRUCTURE,
  }
}

function loadPaths(variant: 'male' | 'female'): Promise<BodyPaths> {
  const cached = pathCache.get(variant)
  if (cached) return cached
  // A rejected chunk request must be evicted, otherwise one flaky network blip
  // means this body never renders again for the rest of the session.
  const promise = (variant === 'female' ? loadFemalePaths() : loadMalePaths())
    .catch(err => {
      pathCache.delete(variant)
      throw err
    })
  pathCache.set(variant, promise)
  return promise
}

interface MuscleMapProps {
  intensities: Record<string, number>
  size?: 'sm' | 'md'
  sex?: string
}

function intensityToColor(intensity: number): string {
  if (intensity < 0.2) return 'oklch(0.25 0.01 200)'
  if (intensity < 0.35) return 'oklch(0.72 0.16 95)'
  if (intensity < 0.5) return 'oklch(0.68 0.18 80)'
  if (intensity < 0.65) return 'oklch(0.63 0.19 65)'
  if (intensity < 0.8) return 'oklch(0.58 0.20 48)'
  if (intensity < 0.9) return 'oklch(0.53 0.21 36)'
  return 'oklch(0.48 0.22 28)'
}

const BASE_COLOR = 'oklch(0.25 0.01 200)'
const STROKE_COLOR = 'oklch(0.35 0.02 200)'
const HEAD_COLOR = 'oklch(0.30 0.01 200)'

export default function MuscleMap({ intensities, size = 'md', sex }: MuscleMapProps) {
  const w = size === 'sm' ? 100 : 140
  const variant: 'male' | 'female' = sex === 'female' ? 'female' : 'male'
  const [paths, setPaths] = useState<BodyPaths | null>(null)

  useEffect(() => {
    let cancelled = false
    // Drop the previous silhouette immediately: without this the old body
    // lingers (a male figure under a female profile) until the new chunk lands,
    // and stays forever if that chunk fails.
    setPaths(null)
    loadPaths(variant)
      .then(loaded => { if (!cancelled) setPaths(loaded) })
      .catch(err => console.error('Failed to load muscle map paths:', err))
    return () => { cancelled = true }
  }, [variant])

  function fill(zone: MuscleZone): string {
    const val = intensities[zone]
    if (!val || val < 0.2) return BASE_COLOR
    return intensityToColor(val)
  }

  function renderPaths(bodyPaths: Partial<Record<MuscleZone, string[]>>) {
    return (Object.entries(bodyPaths) as [MuscleZone, string[]][]).map(([zone, zonePaths]) =>
      zonePaths.map((d, i) => (
        <path
          key={`${zone}-${i}`}
          d={d}
          fill={fill(zone)}
          stroke={STROKE_COLOR}
          strokeWidth="0.8"
        />
      ))
    )
  }

  if (!paths) {
    // Reserve the rendered footprint (viewBox aspect ratio) so the surrounding
    // card doesn't jump once the paths land.
    const aspect = variant === 'female' ? 1450 / 650 : 1310 / 640
    return (
      <div
        aria-hidden
        style={{
          display: 'flex', justifyContent: 'center', gap: size === 'sm' ? 4 : 10,
          padding: '8px 0', height: Math.round(w * aspect),
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: size === 'sm' ? 4 : 10, padding: '8px 0' }}>
      <svg viewBox={paths.frontViewBox} width={w} xmlns="http://www.w3.org/2000/svg">
        {paths.frontHair.map((d, i) => (
          <path key={`fh-${i}`} d={d} fill={HEAD_COLOR} stroke="none" />
        ))}
        {paths.frontHead.map((d, i) => (
          <path key={`fhd-${i}`} d={d} fill={HEAD_COLOR} stroke={STROKE_COLOR} strokeWidth="0.5" />
        ))}
        {paths.frontStructure.map((d, i) => (
          <path key={`fs-${i}`} d={d} fill={BASE_COLOR} stroke="none" />
        ))}
        {renderPaths(paths.frontPaths)}
      </svg>
      <svg viewBox={paths.backViewBox} width={w} xmlns="http://www.w3.org/2000/svg">
        {paths.backHair.map((d, i) => (
          <path key={`bh-${i}`} d={d} fill={HEAD_COLOR} stroke="none" />
        ))}
        {paths.backHead.map((d, i) => (
          <path key={`bhd-${i}`} d={d} fill={HEAD_COLOR} stroke={STROKE_COLOR} strokeWidth="0.5" />
        ))}
        {paths.backStructure.map((d, i) => (
          <path key={`bs-${i}`} d={d} fill={BASE_COLOR} stroke="none" />
        ))}
        {renderPaths(paths.backPaths)}
      </svg>
    </div>
  )
}
