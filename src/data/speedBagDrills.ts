// =====================================================
// Speed Bag Drill Library
// =====================================================
// Speed bag uses a completely separate drill vocabulary
// from the punch numbering system (1-6). These drills
// are about rhythm, timing, and hand patterns.
// =====================================================

export interface SpeedBagDrill {
  id: string;
  name: string;
  description: string;
  aliases: string[]; // All ways a user might describe this drill
}

export const SPEED_BAG_DRILLS: SpeedBagDrill[] = [
  {
    id: 'single-alternating',
    name: 'Single Alternating',
    description: 'Hit once with one hand, let it bounce, then hit with the other. Alternating L-R.',
    aliases: [
      'singles', 'single hits', 'alternating singles', 'single alternating',
      'basic rhythm', 'one-one', 'left right left right', 'alternate hands',
      'basic pattern', 'single', 'singlehits',
    ],
  },
  {
    id: 'double-right-lead',
    name: 'Double Right Lead',
    description: 'Two hits with the right hand, then two with the left. Classic speed bag rhythm.',
    aliases: [
      'doubles right', 'double right lead', 'right lead doubles',
      'two-two right start', 'rr-ll', 'right right left left',
      'standard doubles starting right', 'double right',
    ],
  },
  {
    id: 'double-left-lead',
    name: 'Double Left Lead',
    description: 'Two hits with the left hand, then two with the right.',
    aliases: [
      'doubles left', 'double left lead', 'left lead doubles',
      'two-two left start', 'll-rr', 'left left right right',
      'standard doubles starting left', 'double left',
    ],
  },
  {
    id: 'doubles',
    name: 'Doubles',
    description: 'Double hits alternating hands. Default to right lead for orthodox.',
    aliases: [
      'doubles', 'double hits', 'double rhythm', 'two-two pattern',
      'the basic one', 'double',
    ],
  },
  {
    id: 'triple-right-lead',
    name: 'Triple Right Lead',
    description: 'Three consecutive hits with the right hand before switching to three with the left.',
    aliases: [
      'triples right', 'triple right lead', 'three-three right start',
      'rrr-lll', 'triple right',
    ],
  },
  {
    id: 'triple-left-lead',
    name: 'Triple Left Lead',
    description: 'Three consecutive hits with the left hand before switching.',
    aliases: [
      'triples left', 'triple left lead', 'three-three left start',
      'lll-rrr', 'triple left',
    ],
  },
  {
    id: 'triples',
    name: 'Triples',
    description: 'Triple hits alternating hands.',
    aliases: [
      'triples', 'triple hits', 'triple rhythm', 'three-three pattern',
      'triple',
    ],
  },
  {
    id: 'fist-rolls-forward',
    name: 'Fist Rolls (Forward)',
    description: 'Rolling fists in a forward circular motion, hitting the bag continuously.',
    aliases: [
      'fist rolls', 'forward rolls', 'rolling', 'roll the fists',
      'front rolls', 'circular punching', 'windmill', 'rolls',
      'fistrolls', 'fist roll', 'fistroll',
    ],
  },
  {
    id: 'fist-rolls-reverse',
    name: 'Fist Rolls (Reverse)',
    description: 'Same circular motion but in reverse direction.',
    aliases: [
      'reverse rolls', 'backward rolls', 'reverse fist rolls',
      'roll backwards', 'reverse roll', 'fist rolls reverse',
      'fistrolls reverse', 'fist roll reverse',
    ],
  },
  {
    id: 'side-to-side',
    name: 'Side-to-Side',
    description: 'Hitting the bag from the sides, pushing it left and right.',
    aliases: [
      'side to side', 'side hits', 'lateral hits', 'sideways',
      'left-right sides', 'side punching', 'sides',
      'side-to-side', 'sidetoside',
    ],
  },
  {
    id: 'elbow-strikes',
    name: 'Elbow Strikes',
    description: 'Striking the bag with the elbow for variation.',
    aliases: [
      'elbows', 'elbow strikes', 'elbow hits', 'hit with elbows',
      'elbow work', 'elbow',
    ],
  },
  {
    id: 'backfists',
    name: 'Backfists',
    description: 'Hitting the bag with the back of the fist.',
    aliases: [
      'backfists', 'back fist', 'backhand hits', 'reverse fist',
      'back of hand', 'backfist', 'back fists', 'back-fists',
    ],
  },
  {
    id: 'one-two-rhythm',
    name: 'One-Two Rhythm',
    description: 'One hit with lead hand, two hits with rear hand. Asymmetric rhythm pattern (NOT jab-cross).',
    aliases: [
      'one-two rhythm', '1-2 pattern on speed bag', 'asymmetric rhythm',
      'one-two speed bag', 'one two rhythm',
    ],
  },
  {
    id: 'freestyle',
    name: 'Freestyle',
    description: 'No specific drill pattern. Mix any patterns freely.',
    aliases: [
      'freestyle', 'free', 'mix it up', 'anything', 'whatever',
    ],
  },
];

/**
 * Detect a speed bag drill from user text.
 * Returns the matching drill or null if no match.
 */
export function detectSpeedBagDrill(text: string): SpeedBagDrill | null {
  const lower = text.toLowerCase().trim();
  
  // Try exact alias matches first (longest first to avoid partial matches)
  const allAliases = SPEED_BAG_DRILLS.flatMap(d => d.aliases.map(a => ({ alias: a, drill: d })));
  allAliases.sort((a, b) => b.alias.length - a.alias.length);
  
  for (const { alias, drill } of allAliases) {
    if (lower.includes(alias)) {
      return drill;
    }
  }
  
  return null;
}

/**
 * Detect all speed bag drills mentioned in a prompt.
 */
export function detectAllSpeedBagDrills(text: string): SpeedBagDrill[] {
  const lower = text.toLowerCase();
  const found: SpeedBagDrill[] = [];
  
  for (const drill of SPEED_BAG_DRILLS) {
    if (drill.id === 'freestyle') continue; // Don't auto-detect freestyle
    for (const alias of drill.aliases) {
      if (lower.includes(alias)) {
        found.push(drill);
        break;
      }
    }
  }
  
  return found;
}

/**
 * Check if text contains speed bag vocabulary (as opposed to punch combo notation).
 */
export function containsSpeedBagVocabulary(text: string): boolean {
  const lower = text.toLowerCase();
  // Check for any speed bag drill aliases (excluding freestyle)
  return SPEED_BAG_DRILLS
    .filter(d => d.id !== 'freestyle')
    .some(d => d.aliases.some(a => lower.includes(a)));
}

// Bag type detection triggers
export const BAG_TYPE_TRIGGERS = {
  heavybag: [
    'heavy bag', 'heavybag', 'heavy', 'big bag', 'power bag', 'bag work',
  ],
  doubleend: [
    'double end bag', 'double-end bag', 'double end', 'de bag', 'reflex bag',
    'double bag', 'floor to ceiling bag', 'spring bag',
  ],
  speedbag: [
    'speed bag', 'speedbag', 'speed-bag', 'speed work', 'small bag',
    'platform bag', 'swivel bag',
  ],
} as const;

export type DetectedBagType = 'heavybag' | 'doubleend' | 'speedbag' | 'unknown';

/**
 * Detect bag type from user input text.
 * If ambiguous, checks drill vocabulary to disambiguate.
 * Defaults to heavybag if truly ambiguous.
 */
export function detectBagType(text: string): DetectedBagType {
  const lower = text.toLowerCase();
  
  // Check specific triggers (most specific first)
  for (const trigger of BAG_TYPE_TRIGGERS.doubleend) {
    if (lower.includes(trigger)) return 'doubleend';
  }
  for (const trigger of BAG_TYPE_TRIGGERS.speedbag) {
    if (lower.includes(trigger)) return 'speedbag';
  }
  for (const trigger of BAG_TYPE_TRIGGERS.heavybag) {
    if (lower.includes(trigger)) return 'heavybag';
  }
  
  // If "the bag" or "bag" is mentioned alongside speed bag vocabulary, it's speed bag
  if ((lower.includes('bag') || lower.includes('the bag')) && containsSpeedBagVocabulary(lower)) {
    return 'speedbag';
  }
  
  // If punch numbers are present (1-2-3 notation), default to heavy bag
  if (/\b[1-6]\s*[-,]\s*[1-6]/.test(lower)) return 'heavybag';
  
  return 'unknown';
}
