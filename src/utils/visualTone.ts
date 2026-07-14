const AVATAR_TONES = [
  'bg-blue-600 text-white',
  'bg-emerald-600 text-white',
  'bg-rose-600 text-white',
  'bg-amber-500 text-white',
  'bg-cyan-600 text-white',
  'bg-red-600 text-white',
  'bg-indigo-600 text-white',
  'bg-teal-600 text-white',
]

const TAG_TONES = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-rose-50 text-rose-700',
  'bg-amber-50 text-amber-800',
  'bg-cyan-50 text-cyan-700',
  'bg-red-50 text-red-700',
  'bg-indigo-50 text-indigo-700',
  'bg-teal-50 text-teal-700',
]

function toneIndex(value: string, count: number): number {
  let hash = 0
  for (const character of value.trim().toLocaleLowerCase()) {
    hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0
  }
  return Math.abs(hash) % count
}

export function getAvatarTone(value: string): string {
  return AVATAR_TONES[toneIndex(value || '?', AVATAR_TONES.length)]
}

export function getTagTone(value: string): string {
  return TAG_TONES[toneIndex(value || '?', TAG_TONES.length)]
}
