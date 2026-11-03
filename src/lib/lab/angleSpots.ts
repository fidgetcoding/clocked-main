/**
 * The camera spots for filming a real heavy bag, for the angle lab (dev only, /lab/angles).
 * No imports, so the dev server's save endpoint can use it too.
 */

export type LabStance = 'orthodox' | 'southpaw';
export type SpotHeight = 'chest' | 'hip' | 'floor' | 'box';
/** Where the bag is: in front of you, between you and the laptop, or out of the way. */
export type SpotBag = 'ahead' | 'between' | 'none';

export interface AngleSpot {
  /** The number in docs/clocked-angle-nate-recordings.md. */
  id: string;
  slug: string;
  title: string;
  /** Degrees from straight in front of you, positive toward your lead hand. 180 is directly behind. */
  angle: number;
  height: SpotHeight;
  bag: SpotBag;
  /** The punch set, or the bag-swing check with no punches. */
  set: 'punches' | 'shove';
  /** What this spot proves, in a line. */
  why: string;
  /** Anything to do beyond where the laptop goes. */
  extra?: string;
}

/** In the order they're filmed: one sweep around you, so the laptop moves as little as possible. */
export const ANGLE_SPOTS: AngleSpot[] = [
  {
    id: '9',
    slug: 'front-no-bag',
    title: 'Front, no bag',
    angle: 0,
    height: 'chest',
    bag: 'none',
    set: 'punches',
    why: 'A real-person check of the latest false-punch settings.',
    extra: 'Step clear of the bag and face the laptop. Punch the air.',
  },
  {
    id: '5',
    slug: 'bag-between',
    title: 'Bag between you and the laptop',
    angle: 0,
    height: 'chest',
    bag: 'between',
    set: 'punches',
    why: 'Should say it can\'t see you. Your body may still show around the bag.',
  },
  {
    id: '4',
    slug: 'lead-45-chest',
    title: '45° lead side, chest height',
    angle: 45,
    height: 'chest',
    bag: 'ahead',
    set: 'punches',
    why: 'Whether a real 45° names punches better than the mannequin did.',
  },
  {
    id: '2',
    slug: 'lead-60-hip',
    title: '60° lead side, hip height',
    angle: 60,
    height: 'hip',
    bag: 'ahead',
    set: 'punches',
    why: 'The recommended spot. Most punches counted, few wrong names.',
  },
  {
    id: '8',
    slug: 'bag-swing-no-punches',
    title: 'Swinging bag, no punches',
    angle: 60,
    height: 'hip',
    bag: 'ahead',
    set: 'shove',
    why: 'Counts false punches from a swinging bag. Any count is false.',
    extra: 'Shove the bag hard, then hands up for 10 seconds. Throw nothing.',
  },
  {
    id: '6a',
    slug: 'floor-lead-60',
    title: 'On the floor, 60° lead side',
    angle: 60,
    height: 'floor',
    bag: 'ahead',
    set: 'punches',
    why: 'The likeliest setup with no stand.',
    extra: 'Tilt the screen back so it sees all of you. Throw a few arm-only punches in each set.',
  },
  {
    id: '6b',
    slug: 'box-lead-60',
    title: 'On a box, 60° lead side',
    angle: 60,
    height: 'box',
    bag: 'ahead',
    set: 'punches',
    why: 'Same as the floor, raised: should give fewer extra punches.',
    extra: 'Throw a few arm-only punches in each set.',
  },
  {
    id: '7',
    slug: 'side-lead-hip',
    title: 'Side on, lead side, hip height',
    angle: 90,
    height: 'hip',
    bag: 'ahead',
    set: 'punches',
    why: 'Count only. How many far-arm punches it misses.',
  },
  {
    id: '1',
    slug: 'behind-chest',
    title: 'Directly behind you, chest height',
    angle: 180,
    height: 'chest',
    bag: 'ahead',
    set: 'punches',
    why: 'The biggest unknown: does it know it\'s behind you, or swap your hands?',
  },
  {
    id: '3',
    slug: 'rear-60-hip',
    title: '60° rear side, hip height',
    angle: -60,
    height: 'hip',
    bag: 'ahead',
    set: 'punches',
    why: 'Whether the advice should name a side.',
  },
];

export const DISTANCE_FEET = 6;

export const spotById = (id: string): AngleSpot | undefined => ANGLE_SPOTS.find((spot) => spot.id === id);

/** Two digits from the spot's place in the order, so the files sort the way they were filmed. */
export const spotNumber = (spot: AngleSpot) => String(ANGLE_SPOTS.indexOf(spot) + 1).padStart(2, '0');

export const spotFileName = (spot: AngleSpot, stance: LabStance) => `${spotNumber(spot)}-${spot.slug}-${stance}.json`;

/** Whether the camera is on your left, from above, as an angle off straight ahead. */
const onLeft = (angle: number, stance: LabStance) => (angle > 0) === (stance === 'orthodox');

/**
 * Where the laptop goes as a clock hour: you face the bag at 12. Halves for in between, like 10.5.
 * An orthodox fighter's lead side is the left, so lead-side spots sit between 9 and 12.
 */
export function clockHour(angle: number, stance: LabStance): number {
  if (Math.abs(angle) >= 180) return 6;
  if (angle === 0) return 12;
  const hours = Math.abs(angle) / 30;
  return onLeft(angle, stance) ? 12 - hours : hours;
}

export function clockWords(hour: number): string {
  const whole = Math.floor(hour);
  if (hour === whole) return `${whole} o'clock`;
  return `between ${whole} and ${whole + 1 === 13 ? 1 : whole + 1} o'clock`;
}

/** Degrees clockwise from 12 o'clock, for drawing. */
export const clockDegrees = (hour: number) => (hour % 12) * 30;

const HEIGHT_WORDS: Record<SpotHeight, string> = {
  chest: 'Laptop at chest height.',
  hip: 'Laptop at hip height.',
  floor: 'Laptop on the floor, screen tilted back.',
  box: 'Laptop on a box, screen tilted back.',
};

export const heightWords = (height: SpotHeight) => HEIGHT_WORDS[height];

/** Which way round you, in words, with the side named for this stance. */
export function sideWords(angle: number, stance: LabStance): string {
  if (angle === 0) return 'straight in front of you';
  if (Math.abs(angle) >= 180) return 'directly behind you';
  const side = angle > 0 ? 'lead-hand' : 'rear-hand';
  const hand = onLeft(angle, stance) ? 'left' : 'right';
  const amount = Math.abs(angle) === 90 ? 'side on' : `${Math.abs(angle)}°`;
  return `${amount} to your ${side} side, your ${hand}`;
}

const BAG_WORDS: Record<SpotBag, string> = {
  ahead: 'Face the bag. The bag is at 12.',
  between: 'Stand behind the bag so it hangs between you and the laptop.',
  none: 'No bag between you and the laptop.',
};

/** The setup, as lines big enough to read from across the room. The first is the one that matters. */
export function spotLines(spot: AngleSpot, stance: LabStance): string[] {
  const hour = clockHour(spot.angle, stance);
  return [
    `Laptop at ${clockWords(hour)}: ${sideWords(spot.angle, stance)}, ${DISTANCE_FEET} feet away.`,
    heightWords(spot.height),
    BAG_WORDS[spot.bag],
    ...(spot.extra ? [spot.extra] : []),
  ];
}

/** What changes from the spot before, so he knows when the laptop can stay put. */
export function moveFromPrevious(spot: AngleSpot, previous: AngleSpot | undefined): string | null {
  if (!previous) return null;
  const sameSpot = previous.angle === spot.angle;
  const sameHeight = previous.height === spot.height;
  if (sameSpot && sameHeight) return 'The laptop stays where it is.';
  if (sameSpot) return 'Same spot. Only the height changes.';
  return 'Move the laptop.';
}

// What a finished spot says, for summary.md

export interface SpotScore {
  /** Punches the prompts asked for. */
  expected: number;
  /** Punches counted during the prompted punch steps. */
  counted: number;
  /** Named what was asked for. */
  right: number;
  /** Named something else. */
  wrong: number;
  /** Counted without a name. */
  unnamed: number;
  /** Counted while standing still or between steps. */
  falsePunches: number;
  wrongHand: number;
  /** Share of frames with a person in them. */
  seenShare: number;
}

export interface CameraRead {
  /** The start check's own words, like "Camera on your left, about 40°." */
  says: string;
  side: string;
  angle: number;
  height: string;
  seenShare: number;
  handsHidden: boolean;
  gaveUp: boolean;
  advice: string | null;
}

export interface LabRow {
  spotId: string;
  stance: LabStance;
  file: string;
  recordedAt: string;
  score: SpotScore;
  camera: CameraRead;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** One table, every spot filmed so far, in filming order. */
export function summaryMarkdown(date: string, rows: LabRow[]): string {
  const sorted = [...rows].sort((a, b) => a.file.localeCompare(b.file));
  const lines = [
    `# Angle tests, ${date}`,
    '',
    'Each row is one spot, scored by replaying its file through the punch tracker. Rescore any file with `npm run punch:confusion -- <file>`.',
    '',
    '| # | Spot | Stance | Counted | Right | Wrong | No name | False | Wrong hand | Seen | Camera read |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of sorted) {
    const spot = spotById(row.spotId);
    const { score, camera } = row;
    lines.push(
      [
        '',
        row.file.slice(0, 2),
        `${spot?.id ?? row.spotId} ${spot?.title ?? ''}`.trim(),
        row.stance,
        `${score.counted} of ${score.expected}`,
        score.right,
        score.wrong,
        score.unnamed,
        score.falsePunches,
        score.wrongHand,
        percent(score.seenShare),
        camera.says,
        '',
      ].join(' | ').trim(),
    );
  }
  lines.push('');
  return lines.join('\n');
}
