const WORDS = [
  'amber', 'cinder', 'falcon', 'harbor', 'ivory', 'juniper', 'kelp', 'lantern',
  'marble', 'nectar', 'otter', 'pebble', 'quartz', 'river', 'saffron', 'thistle',
  'umber', 'violet', 'willow', 'yarrow',
]

const GESTURES = [
  'touch your nose',
  'raise your left hand',
  'wave at the camera',
  'point at the ceiling',
  'hold up two fingers',
  'tap your right shoulder',
]

export function randomPhrase(rng: () => number = Math.random): { codeWord: string; gesture: string } {
  const pick = (items: string[]) => items[Math.floor(rng() * items.length)] ?? items[0]
  return { codeWord: `${pick(WORDS)}-${pick(WORDS)}`, gesture: pick(GESTURES) }
}
