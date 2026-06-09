'use client'

import type { MuscleZone } from '@/lib/muscle-zones'
import { FRONT_PATHS, FRONT_VIEWBOX, FRONT_HEAD, FRONT_HAIR, FRONT_STRUCTURE } from '@/lib/muscle-map-front-paths'
import { BACK_PATHS, BACK_VIEWBOX, BACK_HEAD, BACK_HAIR, BACK_STRUCTURE } from '@/lib/muscle-map-back-paths'
import { FEMALE_FRONT_PATHS, FEMALE_FRONT_VIEWBOX, FEMALE_FRONT_HEAD, FEMALE_FRONT_HAIR, FEMALE_FRONT_STRUCTURE } from '@/lib/muscle-map-female-front-paths'
import { FEMALE_BACK_PATHS, FEMALE_BACK_VIEWBOX, FEMALE_BACK_HAIR, FEMALE_BACK_STRUCTURE } from '@/lib/muscle-map-female-back-paths'

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
  const isFemale = sex === 'female'

  const frontPaths = isFemale ? FEMALE_FRONT_PATHS : FRONT_PATHS
  const frontViewBox = isFemale ? FEMALE_FRONT_VIEWBOX : FRONT_VIEWBOX
  const frontHair = isFemale ? FEMALE_FRONT_HAIR : [FRONT_HAIR]
  const frontHead = isFemale ? FEMALE_FRONT_HEAD : [FRONT_HEAD]
  const frontStructure = isFemale ? FEMALE_FRONT_STRUCTURE : FRONT_STRUCTURE
  const backPaths = isFemale ? FEMALE_BACK_PATHS : BACK_PATHS
  const backViewBox = isFemale ? FEMALE_BACK_VIEWBOX : BACK_VIEWBOX
  const backHair = isFemale ? FEMALE_BACK_HAIR : [BACK_HAIR]
  const backHead = isFemale ? [] as string[] : [BACK_HEAD]
  const backStructure = isFemale ? FEMALE_BACK_STRUCTURE : BACK_STRUCTURE

  function fill(zone: MuscleZone): string {
    const val = intensities[zone]
    if (!val || val < 0.2) return BASE_COLOR
    return intensityToColor(val)
  }

  function renderPaths(paths: Partial<Record<MuscleZone, string[]>>) {
    return (Object.entries(paths) as [MuscleZone, string[]][]).map(([zone, zonePaths]) =>
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

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: size === 'sm' ? 4 : 10, padding: '8px 0' }}>
      <svg viewBox={frontViewBox} width={w} xmlns="http://www.w3.org/2000/svg">
        {frontHair.map((d, i) => (
          <path key={`fh-${i}`} d={d} fill={HEAD_COLOR} stroke="none" />
        ))}
        {frontHead.map((d, i) => (
          <path key={`fhd-${i}`} d={d} fill={HEAD_COLOR} stroke={STROKE_COLOR} strokeWidth="0.5" />
        ))}
        {frontStructure.map((d, i) => (
          <path key={`fs-${i}`} d={d} fill={BASE_COLOR} stroke="none" />
        ))}
        {renderPaths(frontPaths)}
      </svg>
      <svg viewBox={backViewBox} width={w} xmlns="http://www.w3.org/2000/svg">
        {backHair.map((d, i) => (
          <path key={`bh-${i}`} d={d} fill={HEAD_COLOR} stroke="none" />
        ))}
        {backHead.map((d, i) => (
          <path key={`bhd-${i}`} d={d} fill={HEAD_COLOR} stroke={STROKE_COLOR} strokeWidth="0.5" />
        ))}
        {backStructure.map((d, i) => (
          <path key={`bs-${i}`} d={d} fill={BASE_COLOR} stroke="none" />
        ))}
        {renderPaths(backPaths)}
      </svg>
    </div>
  )
}
