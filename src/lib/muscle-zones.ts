export type MuscleZone =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'upper_back'
  | 'lats'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'hip_flexors'
  | 'quads'
  | 'quads_inner'
  | 'hamstrings'
  | 'calves'
  | 'rotator_cuff'

export const ALL_ZONES: MuscleZone[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps',
  'forearms', 'upper_back', 'lats', 'lower_back', 'abs', 'obliques',
  'glutes', 'hip_flexors', 'quads', 'quads_inner', 'hamstrings', 'calves',
  'rotator_cuff',
]

const MUSCLE_TO_ZONE: Record<string, MuscleZone> = {
  'pectoralis major': 'chest',
  'chest': 'chest',
  'anterior deltoid': 'front_delts',
  'lateral deltoid': 'side_delts',
  'deltoids': 'side_delts',
  'shoulders': 'side_delts',
  'posterior deltoid': 'rear_delts',
  'rear deltoid': 'rear_delts',
  'biceps': 'biceps',
  'brachialis': 'biceps',
  'triceps': 'triceps',
  'forearms': 'forearms',
  'brachioradialis': 'forearms',
  'grip': 'forearms',
  'trapezius': 'upper_back',
  'lower trapezius': 'upper_back',
  'rhomboids': 'upper_back',
  'latissimus dorsi': 'lats',
  'teres major': 'lats',
  'back': 'lats',
  'erector spinae': 'lower_back',
  'lower back': 'lower_back',
  'spine': 'lower_back',
  'thoracic spine': 'lower_back',
  'rectus abdominis': 'abs',
  'abdominals': 'abs',
  'transverse abdominis': 'abs',
  'core': 'abs',
  'obliques': 'obliques',
  'serratus anterior': 'obliques',
  'glutes': 'glutes',
  'gluteus medius': 'glutes',
  'hip flexors': 'hip_flexors',
  'hip rotators': 'hip_flexors',
  'hip abductors': 'hip_flexors',
  'adductors': 'hip_flexors',
  'quadriceps': 'quads',
  'quads': 'quads',
  'quadriceps (vmo)': 'quads_inner',
  'legs': 'quads',
  'hamstrings': 'hamstrings',
  'calves': 'calves',
  'gastrocnemius': 'calves',
  'soleus': 'calves',
  'rotator cuff': 'rotator_cuff',
  'external rotators': 'rotator_cuff',
  'internal rotators': 'rotator_cuff',
  'subscapularis': 'rotator_cuff',
}

export function muscleToZone(muscleName: string): MuscleZone | null {
  return MUSCLE_TO_ZONE[muscleName.toLowerCase()] ?? null
}

export function muscleToZones(muscleName: string): MuscleZone[] {
  const lower = muscleName.toLowerCase()
  if (lower === 'full body') return [...ALL_ZONES]
  const zone = MUSCLE_TO_ZONE[lower]
  return zone ? [zone] : []
}
