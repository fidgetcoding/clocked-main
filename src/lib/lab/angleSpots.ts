/**
 * The camera spots for filming a real heavy bag, for the angle lab (dev only, /lab/angles):
 * a ring of 8 points around you at each height, then two checks. No imports, so the dev server's save
 * endpoint can use it too.
 */

export type LabStance = 'orthodox' | 'southpaw';
/** Chest and high are kept for later. Only the heights in HEIGHTS are filmed. */
export type SpotHeight = 'floor' | 'chair' | 'chest' | 'high';
/** Where the bag is: in front of you, between you and the laptop, or out of the way. */
export type SpotBag = 'ahead' | 'between' | 'none';
/** short: 3 of each punch. full: the whole Punch Check set. shove: hands up, no punches. */
export type SpotRun = 'short' | 'full' | 'shove';

export interface AnglePoint {
  /** Degrees from straight in front of you, positive toward your lead hand. 180 is directly behind. */
  angle: number;
  bag: SpotBag;
}

/** In filming order: round the circle from front on the lead side, ending in front behind the bag. */
export const ANGLE_POINTS: AnglePoint[] = [
  { angle: 45, bag: 'ahead' },
  { angle: 90, bag: 'ahead' },
  { angle: 135, bag: 'ahead' },
  { angle: 180, bag: 'ahead' },
  { angle: -135, bag: 'ahead' },
  { angle: -90, bag: 'ahead' },
  { angle: -45, bag: 'ahead' },
  { angle: 0, bag: 'between' },
];

/** The heights filmed, one full ring each, in this order. Add one here to add a ring. */
export const HEIGHTS: SpotHeight[] = ['floor', 'chair'];

export interface AngleSpot {
  /** 1 to 34, the filming order. */
  id: string;
  angle: number;
  height: SpotHeight;
  bag: SpotBag;
  run: SpotRun;
  /** The two checks after the grid. */
  check?: 'swing' | 'no-bag';
  /** Anything to do beyond where the laptop goes. */
  extra?: string;
  /** What it proves, for the checks. */
  why?: string;
}

const GRID: AngleSpot[] = HEIGHTS.flatMap((height) =>
  ANGLE_POINTS.map((point) => ({
    id: '',
    angle: point.angle,
    height,
    bag: point.bag,
    // The recommended spot gets the full set, as the yardstick for the short ones
    run: point.angle === 45 && height === 'chair' ? ('full' as const) : ('short' as const),
  })),
);

/** After the grid: the swinging bag, then the front with no bag. */
const CHECKS: AngleSpot[] = [
  {
    id: '',
    angle: 45,
    height: 'chair',
    bag: 'ahead',
    run: 'shove',
    check: 'swing',
    extra: 'Shove the bag hard on Go, then hands up for 10 seconds. Throw nothing.',
    why: 'Any punch counted here is false, from the swinging bag.',
  },
  {
    id: '',
    angle: 0,
    height: 'chair',
    bag: 'none',
    run: 'full',
    check: 'no-bag',
    extra: 'Step out from behind the bag and face the laptop. Punch the air.',
    why: 'A real-person check of the false-punch settings, with nothing in the way.',
  },
];

/** Every spot in filming order: the whole floor ring, then the chair ring, then the checks. */
export const ANGLE_SPOTS: AngleSpot[] = [...GRID, ...CHECKS].map((spot, i) => ({ ...spot, id: String(i + 1) }));

export const DISTANCE_FEET = 6;

export const spotById = (id: string): AngleSpot | undefined => ANGLE_SPOTS.find((spot) => spot.id === id);

/** Whether the camera is on your left, from above. */
const onLeft = (angle: number, stance: LabStance) => (angle > 0) === (stance === 'orthodox');

/** The point's name in body terms, like "Front-left". Southpaw mirrors it. */
export function positionName(angle: number, stance: LabStance): string {
  const size = Math.abs(angle);
  if (size === 0) return 'Front';
  if (size >= 180) return 'Back';
  const side = onLeft(angle, stance) ? 'left' : 'right';
  if (size === 90) return side === 'left' ? 'Left' : 'Right';
  return `${size < 90 ? 'Front' : 'Back'}-${side}`;
}

export const HEIGHT_NAMES: Record<SpotHeight, string> = { floor: 'Floor', chair: 'Chair', chest: 'Chest', high: 'High' };

export function spotTitle(spot: AngleSpot, stance: LabStance): string {
  if (spot.check === 'swing') return `Swing check: ${positionName(spot.angle, stance)}, chair`;
  if (spot.check === 'no-bag') return 'Front, no bag, chair';
  return `${positionName(spot.angle, stance)}, ${HEIGHT_NAMES[spot.height].toLowerCase()}`;
}

const slugOf = (spot: AngleSpot, stance: LabStance) => {
  if (spot.check === 'swing') return 'swing-check';
  if (spot.check === 'no-bag') return 'front-no-bag-chair';
  return `${positionName(spot.angle, stance).toLowerCase()}-${spot.height}`;
};

/** Two digits from the filming order, so the files sort the way they were filmed. */
export const spotFileName = (spot: AngleSpot, stance: LabStance) => `${spot.id.padStart(2, '0')}-${slugOf(spot, stance)}-${stance}.json`;

/** Where the laptop goes as a clock hour: you face the bag at 12. Halves for in between, like 10.5. */
export function clockHour(angle: number, stance: LabStance): number {
  if (Math.abs(angle) >= 180) return 6;
  if (angle === 0) return 12;
  const hours = Math.abs(angle) / 30;
  return onLeft(angle, stance) ? 12 - hours : hours;
}

export function clockWords(hour: number): string {
  const whole = Math.floor(hour);
  return hour === whole ? `${whole} o'clock` : `${whole}:30`;
}

/** Degrees clockwise from 12 o'clock, for drawing. */
export const clockDegrees = (hour: number) => (hour % 12) * 30;

/** Which way round you, in body terms, like "diagonal, in front of you on your LEFT". */
export function sideWords(angle: number, stance: LabStance, bag: SpotBag = 'ahead'): string {
  const size = Math.abs(angle);
  if (size === 0) return bag === 'between' ? 'directly in FRONT of you, behind the bag' : 'directly in FRONT of you';
  if (size >= 180) return 'directly BEHIND you';
  const side = onLeft(angle, stance) ? 'LEFT' : 'RIGHT';
  const hand = angle > 0 ? 'lead' : 'rear';
  if (size === 90) return `directly on your ${side} side, your ${hand} hand`;
  return `diagonal, ${size < 90 ? 'in front of' : 'behind'} you on your ${side}, your ${hand} hand`;
}

const HEIGHT_WORDS: Record<SpotHeight, string> = {
  floor: 'On the FLOOR, screen tilted back so it sees all of you.',
  chair: 'On a CHAIR, about hip height.',
  chest: 'CHEST height, about 4 feet: on a counter or a tall table.',
  high: 'HIGH, about 6 feet: on a shelf, tilted down at you.',
};

export const heightWords = (height: SpotHeight) => HEIGHT_WORDS[height];

/** Short height label with what to stand it on, for the diagram. */
export const HEIGHT_LABELS: Record<SpotHeight, string> = {
  floor: 'Floor · tilted back',
  chair: 'Chair · hip height',
  chest: 'Chest · a counter',
  high: 'High · a shelf',
};

const BAG_WORDS: Record<SpotBag, string> = {
  ahead: 'Face the bag. The bag is at 12.',
  between: 'Stand behind the bag so it hangs between you and the laptop.',
  none: 'Nothing between you and the laptop.',
};

/** The setup, as lines big enough to read from across the room. The first is the one that matters. */
export function spotLines(spot: AngleSpot, stance: LabStance): string[] {
  const hour = clockHour(spot.angle, stance);
  return [
    `Laptop ${sideWords(spot.angle, stance, spot.bag)}. ${clockWords(hour)}, ${DISTANCE_FEET} feet away.`,
    heightWords(spot.height),
    BAG_WORDS[spot.bag],
    ...(spot.extra ? [spot.extra] : []),
  ];
}

/** What changes from the spot before, so he knows when the laptop can stay put. */
export function moveFromPrevious(spot: AngleSpot, previous: AngleSpot | undefined): string | null {
  if (!previous) return null;
  const height = HEIGHT_NAMES[spot.height].toUpperCase();
  if (previous.angle !== spot.angle) return previous.height === spot.height ? 'Move the laptop.' : `Move the laptop, and put it on the ${height} from now on.`;
  if (previous.height !== spot.height) return `Same spot. Change the height to ${height}.`;
  return 'The laptop stays where it is.';
}

export const RUN_WORDS: Record<SpotRun, string> = {
  short: '3 of each punch, about 75 seconds.',
  full: 'The full Punch Check set, about 4 minutes.',
  shove: 'No punches, 10 seconds.',
};

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

const share = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);
const percent = (value: number) => `${Math.round(value * 100)}%`;

export const countedShare = (score: SpotScore) => share(score.counted, score.expected);
export const rightShare = (score: SpotScore) => share(score.right, score.expected);

/** Good enough to recommend: most punches counted and most named right, with few extras. */
const isBest = (score: SpotScore) => countedShare(score) >= 0.7 && rightShare(score) >= 0.5;
/** Not worth suggesting: it misses most punches. */
const isDead = (score: SpotScore, camera: CameraRead) => camera.gaveUp || countedShare(score) < 0.3;

const cell = (row: LabRow | undefined) =>
  row ? `${percent(countedShare(row.score))} · ${percent(rightShare(row.score))} · ${row.score.falsePunches}` : '–';

const mean = (values: number[]) => (values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length);
const meanCell = (rows: LabRow[]) => {
  const counted = mean(rows.map((row) => countedShare(row.score)));
  const right = mean(rows.map((row) => rightShare(row.score)));
  return counted === null || right === null ? '–' : `${percent(counted)} · ${percent(right)}`;
};

/** The grid by position and height, the two checks, and the best and dead spots. */
export function summaryMarkdown(session: string, stance: LabStance, rows: LabRow[]): string {
  const byId = new Map(rows.map((row) => [row.spotId, row]));
  const gridSpots = ANGLE_SPOTS.filter((spot) => !spot.check);
  const at = (angle: number, height: SpotHeight) => gridSpots.find((spot) => spot.angle === angle && spot.height === height)!;
  const filmed = (spots: AngleSpot[]) => spots.flatMap((spot) => (byId.has(spot.id) ? [byId.get(spot.id)!] : []));

  const lines = [
    `# Angle tests, ${session} (${stance})`,
    '',
    `${rows.length} of ${ANGLE_SPOTS.length} spots filmed. Each cell is counted % · named right % · false punches, scored by replaying the take through the punch tracker. Rescore any file with \`npm run punch:confusion -- <file>\`.`,
    '',
    '## By position and height',
    '',
    `| Position | ${HEIGHTS.map((h) => HEIGHT_NAMES[h]).join(' | ')} | All heights |`,
    `|---|${HEIGHTS.map(() => '---|').join('')}---|`,
  ];
  for (const point of ANGLE_POINTS) {
    const spots = HEIGHTS.map((height) => at(point.angle, height));
    const name = `${positionName(point.angle, stance)} (${clockWords(clockHour(point.angle, stance))})`;
    lines.push(`| ${name} | ${spots.map((spot) => cell(byId.get(spot.id))).join(' | ')} | ${meanCell(filmed(spots))} |`);
  }
  lines.push(
    `| All positions | ${HEIGHTS.map((height) => meanCell(filmed(gridSpots.filter((spot) => spot.height === height)))).join(' | ')} | ${meanCell(filmed(gridSpots))} |`,
  );

  lines.push('', '## Checks', '', '| # | Check | Counted | Named right | False punches | Camera read |', '|---|---|---|---|---|---|');
  for (const spot of ANGLE_SPOTS.filter((candidate) => candidate.check)) {
    const row = byId.get(spot.id);
    lines.push(
      row
        ? `| ${spot.id} | ${spotTitle(spot, stance)} | ${row.score.counted} of ${row.score.expected} | ${row.score.right} | ${row.score.falsePunches} | ${row.camera.says} |`
        : `| ${spot.id} | ${spotTitle(spot, stance)} | – | – | – | not filmed |`,
    );
  }

  const graded = filmed(gridSpots).map((row) => ({ row, spot: spotById(row.spotId)! }));
  const best = graded
    .filter(({ row }) => isBest(row.score))
    .sort((a, b) => rightShare(b.row.score) - rightShare(a.row.score) || countedShare(b.row.score) - countedShare(a.row.score) || a.row.score.falsePunches - b.row.score.falsePunches)
    .slice(0, 5);
  const dead = graded.filter(({ row }) => isDead(row.score, row.camera));
  const describe = ({ row, spot }: (typeof graded)[number]) =>
    `- ${spot.id}. ${spotTitle(spot, stance)}: ${percent(countedShare(row.score))} counted, ${percent(rightShare(row.score))} named right, ${row.score.falsePunches} false. ${row.camera.says}`;

  lines.push('', '## Best spots', '', 'At least 70% counted and 50% named right, best first.', '');
  lines.push(...(best.length ? best.map(describe) : ['- None yet.']));
  lines.push('', '## Dead spots', '', 'Under 30% counted, or it could not see you.', '');
  lines.push(...(dead.length ? dead.map(describe) : ['- None yet.']));
  lines.push('');
  return lines.join('\n');
}
