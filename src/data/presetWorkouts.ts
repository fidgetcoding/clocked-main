import { Workout } from '@/types';

const createWorkout = (
  id: string,
  name: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced',
  combos: string[][]
): Workout => ({
  id,
  name,
  icon: '',
  difficulty,
  totalDuration: 3540, // ~59 minutes
  isPreset: true,
  isArchived: false,
  createdAt: new Date(),
  timesCompleted: 0,
  sections: {
    warmup: [
      {
        id: `${id}-warmup-1`,
        name: 'Jump Rope',
        repeats: 1,
        segments: [
          { id: `${id}-warmup-1-1`, name: 'Jump Rope', type: 'active', duration: 150 },
        ],
      },
      {
        id: `${id}-warmup-2`,
        name: 'Rest',
        repeats: 1,
        segments: [
          { id: `${id}-warmup-2-1`, name: 'Rest', type: 'rest', duration: 60 },
        ],
      },
    ],
    grind: [
      {
        id: `${id}-grind-main`,
        name: 'Boxing Cycles',
        repeats: 15,
        segments: [
          {
            id: `${id}-grind-1`,
            name: 'Technique (Shadow)',
            type: 'active',
            duration: 45,
            intensity: '30-40%',
          },
          {
            id: `${id}-grind-2`,
            name: 'Combos (Bag)',
            type: 'active',
            duration: 30,
            intensity: 'full power',
            comboIndex: 'cycle',
          },
          {
            id: `${id}-grind-3`,
            name: 'Pushups',
            type: 'active',
            duration: 45,
            reps: 10,
          },
          {
            id: `${id}-grind-4`,
            name: 'Rest',
            type: 'rest',
            duration: 45,
          },
        ],
      },
    ],
    cooldown: [
      {
        id: `${id}-cooldown-1`,
        name: 'Recovery',
        repeats: 1,
        segments: [
          { id: `${id}-cooldown-1-1`, name: 'Rest', type: 'rest', duration: 60 },
          { id: `${id}-cooldown-1-2`, name: 'Curlups', type: 'active', duration: 150, reps: 100 },
          { id: `${id}-cooldown-1-3`, name: 'Rest', type: 'rest', duration: 60 },
          { id: `${id}-cooldown-1-4`, name: 'Treadmill', type: 'active', duration: 600 },
        ],
      },
    ],
  },
  combos,
});

// BEGINNER COMBOS - Simple 2-4 punch combos with basic slips
const BEGINNER_COMBOS_1: string[][] = [
  ['1', '2', 'SLIP L'],
  ['1', '1', '2', 'SLIP L'],
  ['2', '1', 'SLIP L'],
  ['3', '2', 'SLIP L'],
  ['1', 'SLIP L', '3'],
  ['2', 'SLIP L', '3'],
  ['3', 'SLIP L', '3', 'SLIP L'],
  ['2', '3', '2', 'SLIP L'],
  ['1', 'SLIP L', '3', 'SLIP L'],
  ['3', '2', '1', 'SLIP L'],
  ['1', 'SLIP L', '3', '2', 'SLIP L'],
  ['2', 'SLIP L', '3', '2', 'SLIP L'],
  ['2', '1', 'SLIP L', '3', 'SLIP L'],
  ['3', 'SLIP L', '3', '2', 'SLIP L'],
  ['2', '3', 'SLIP L', '3', 'SLIP L'],
];

const BEGINNER_COMBOS_2: string[][] = [
  ['1', '2', 'SLIP L'],
  ['1', '1', '2', 'SLIP L'],
  ['2', '3', 'SLIP L'],
  ['3', 'SLIP L', '3'],
  ['1', 'SLIP L', '5'],
  ['2', 'SLIP L', '5'],
  ['3', 'SLIP L', '5', 'SLIP L'],
  ['2', '5', '2', 'SLIP L'],
  ['1', 'SLIP L', '5', 'SLIP L'],
  ['3', '2', '3', 'SLIP L'],
  ['1', 'SLIP L', '5', '2', 'SLIP L'],
  ['2', 'SLIP L', '5', '2', 'SLIP L'],
  ['2', '1', 'SLIP L', '5', 'SLIP L'],
  ['3', 'SLIP L', '5', '2', 'SLIP L'],
  ['2', '3', 'SLIP L', '5', 'SLIP L'],
];

const BEGINNER_COMBOS_3: string[][] = [
  ['1', '2', 'SLIP L'],
  ['1', '1', '2', 'SLIP L'],
  ['2', '5', 'SLIP L'],
  ['3', 'SLIP L', '5'],
  ['1', '1', 'SLIP L', '3'],
  ['2', 'SLIP L', '3', 'SLIP L'],
  ['2', 'SLIP L', '5', 'SLIP L'],
  ['3', '2', '5', 'SLIP L'],
  ['2', '1', '2', 'SLIP L'],
  ['1', '2', '3', 'SLIP L'],
  ['1', '2', 'SLIP L', '3', 'SLIP L'],
  ['2', '5', 'SLIP L', '3', 'SLIP L'],
  ['2', '5', 'SLIP L', '5', 'SLIP L'],
  ['3', '2', 'SLIP L', '3', 'SLIP L'],
  ['3', '2', 'SLIP L', '5', 'SLIP L'],
];

// INTERMEDIATE COMBOS - Longer combos with rolls, uppercuts (5,6), and movement
const INTERMEDIATE_COMBOS_1: string[][] = [
  ['1', '2', '3', '2', 'ROLL L'],
  ['1', '1', '2', 'SLIP L', '3', '2'],
  ['3', '2', 'ROLL L', '3', '2', 'SLIP R'],
  ['1', '2', '5', '2', 'SLIP L', 'CIRCLE L'],
  ['6', '5', '2', 'SLIP R', '3', '2'],
  ['1', 'SLIP L', '3', '6', '3', 'ROLL R'],
  ['2', '3', '2', 'ROLL L', '3', '2', 'SLIP R'],
  ['1', '2', 'SLIP L', '5', '6', '2', 'CIRCLE R'],
  ['3', '2', '3', 'SLIP R', '5', '2', 'ROLL L'],
  ['1', '6', '3', '2', 'SLIP L', '3', 'CIRCLE L'],
  ['2', '1', '2', 'ROLL R', '5', '6', '2'],
  ['1', '2', '3', 'SLIP L', '6', '3', '2', 'ROLL L'],
  ['5', '6', '2', 'ROLL L', '3', '2', 'STEP OUT'],
  ['1', '2', '5', '2', 'ROLL R', '3', '6', 'CIRCLE L'],
  ['3', '2', '6', '5', '2', 'SLIP L', '3', '2', 'ROLL R'],
];

const INTERMEDIATE_COMBOS_2: string[][] = [
  ['1', '2', '3', 'ROLL L', '3', '2'],
  ['5', '2', 'SLIP R', '3', '6', '3'],
  ['1', '1', '2', '3', 'SLIP L', '5', '2'],
  ['2', 'ROLL L', '3', '2', '6', '5', 'CIRCLE R'],
  ['1', '2', '5', '6', '2', 'SLIP R', 'STEP IN'],
  ['3', '2', '3', 'ROLL R', '5', '2', '3'],
  ['1', 'SLIP L', '6', '3', '2', 'ROLL L', 'CIRCLE L'],
  ['2', '3', '5', '2', 'SLIP R', '3', '6'],
  ['1', '2', '3', '2', 'ROLL L', '5', '6', '2'],
  ['5', '6', '5', 'ROLL R', '3', '2', 'STEP OUT'],
  ['1', '1', '2', 'SLIP L', '3', '6', '3', '2'],
  ['2', '3', '2', 'ROLL L', '5', '2', '3', 'CIRCLE R'],
  ['1', '2', '5', 'SLIP R', '6', '5', '2', 'ROLL L'],
  ['3', '6', '3', '2', 'SLIP L', '5', '6', 'STEP IN'],
  ['1', '2', '3', 'ROLL R', '5', '6', '5', '2', 'CIRCLE L'],
];

// ADVANCED COMBOS - Complex combinations with all punches (1-8), defensive movements, and footwork
const ADVANCED_COMBOS_1: string[][] = [
  ['1', '2', '3', '2', 'ROLL L', '5', '6', '5', '2', 'CIRCLE L'],
  ['7', '8', '3', '2', 'SLIP R', '5', '6', 'ROLL L', '3', '2'],
  ['1', '1', '2', 'SLIP L', '3', '6', '5', '2', 'ROLL R', '3', 'STEP IN'],
  ['5', '6', '5', 'ROLL L', '7', '8', '2', 'SLIP R', '3', '2', 'CIRCLE R'],
  ['1', '2', '3', 'SLIP L', '5', '2', '6', '3', 'ROLL L', '5', '6'],
  ['2', '3', '2', 'ROLL R', '7', '8', '3', '2', 'SLIP L', '5', 'STEP OUT'],
  ['1', 'SLIP L', '6', '5', '2', 'ROLL L', '3', '6', '3', '2', 'CIRCLE L'],
  ['7', '2', '3', '6', '5', 'SLIP R', '8', '7', '2', 'ROLL L', 'STEP IN'],
  ['1', '2', '5', '6', '5', '2', 'ROLL R', '3', '2', '6', '3', 'CIRCLE R'],
  ['3', '2', '7', '8', 'SLIP L', '5', '6', '2', 'ROLL L', '3', '2'],
  ['1', '1', '2', '3', 'ROLL L', '5', '6', '5', 'SLIP R', '7', '8', 'STEP OUT'],
  ['5', '2', '3', '6', '5', 'ROLL R', '8', '7', '2', '3', '2', 'CIRCLE L'],
  ['1', '2', 'SLIP L', '3', '2', '5', '6', 'ROLL L', '7', '8', '2', 'STEP IN'],
  ['2', '3', '6', '5', '2', 'SLIP R', '7', '8', '3', 'ROLL L', '5', '6', 'CIRCLE R'],
  ['1', '2', '3', '2', '5', '6', '5', 'ROLL R', '7', '8', '7', '2', 'STEP OUT'],
];

const ADVANCED_COMBOS_2: string[][] = [
  ['1', '2', '3', '6', '5', 'ROLL L', '7', '8', '2', 'CIRCLE L'],
  ['5', '6', '7', '8', 'SLIP R', '3', '2', '6', '5', 'ROLL R'],
  ['1', '1', '2', '5', '2', 'ROLL L', '3', '6', '7', '8', 'STEP IN'],
  ['7', '8', '7', '2', 'SLIP L', '5', '6', '3', '2', 'ROLL L', 'CIRCLE R'],
  ['1', '2', 'SLIP R', '3', '6', '5', '8', '7', '2', 'ROLL R', 'STEP OUT'],
  ['3', '2', '5', '6', 'ROLL L', '7', '8', '7', '2', 'SLIP L', '3', '6'],
  ['1', '6', '5', '2', 'SLIP R', '3', '2', '7', '8', 'ROLL L', 'CIRCLE L'],
  ['5', '2', '3', '6', '7', '8', 'SLIP L', '5', '6', '2', 'STEP IN'],
  ['1', '2', '3', '2', 'ROLL R', '5', '6', '7', '8', '7', '2', 'CIRCLE R'],
  ['7', '8', '5', '6', '2', 'SLIP R', '3', '6', '5', 'ROLL L', 'STEP OUT'],
  ['1', '1', '2', '3', '6', 'SLIP L', '5', '8', '7', '2', '3', 'ROLL R'],
  ['2', '3', '2', '5', '6', 'ROLL L', '7', '8', '3', '2', 'SLIP R', 'CIRCLE L'],
  ['1', '2', '5', '6', '5', 'SLIP L', '7', '8', '7', '2', 'ROLL L', 'STEP IN'],
  ['3', '6', '5', '2', 'ROLL R', '7', '8', '5', '6', '2', '3', 'CIRCLE R'],
  ['1', '2', '3', '6', '7', '8', 'SLIP R', '5', '6', '5', '2', 'ROLL L', 'STEP OUT'],
];

// PRO COMBOS - Elite level combinations with maximum complexity
const PRO_COMBOS_1: string[][] = [
  ['1', '2', '3', '2', 'ROLL L', '5', '6', '7', '8', '3', '2', 'SLIP R', 'CIRCLE L', 'STEP IN'],
  ['7', '8', '7', '2', '3', '6', 'ROLL R', '5', '6', '5', '8', '7', 'SLIP L', 'STEP OUT', 'CIRCLE R'],
  ['1', '1', '2', 'SLIP L', '3', '6', '5', '8', '7', '2', 'ROLL L', '3', '2', '6', 'STEP IN'],
  ['5', '6', '5', '2', 'ROLL R', '7', '8', '3', '6', '3', '2', 'SLIP R', '5', '6', 'CIRCLE L'],
  ['1', '2', '3', '6', '5', 'SLIP L', '7', '8', '7', '2', 'ROLL L', '3', '6', '5', 'STEP OUT'],
  ['2', '3', '2', '5', '6', 'ROLL R', '7', '8', '3', '2', '6', 'SLIP R', '5', '8', 'CIRCLE R'],
  ['1', 'SLIP L', '6', '5', '8', '7', '2', 'ROLL L', '3', '6', '3', '2', 'STEP IN', 'CIRCLE L'],
  ['7', '2', '3', '6', '5', '6', 'SLIP R', '8', '7', '2', '3', 'ROLL L', '5', '6', 'STEP OUT'],
  ['1', '2', '5', '6', '7', '8', '5', '2', 'ROLL R', '3', '2', '6', '5', 'SLIP L', 'CIRCLE R'],
  ['3', '2', '7', '8', '5', '6', 'SLIP L', '5', '6', '2', '3', 'ROLL L', '7', '8', 'STEP IN'],
  ['1', '1', '2', '3', '6', 'ROLL L', '5', '6', '7', '8', '5', 'SLIP R', '7', '8', 'STEP OUT'],
  ['5', '2', '3', '6', '7', '8', '5', 'ROLL R', '8', '7', '2', '3', '6', 'SLIP L', 'CIRCLE L'],
  ['1', '2', 'SLIP L', '3', '2', '5', '6', '7', '8', 'ROLL L', '7', '8', '2', '3', 'STEP IN'],
  ['2', '3', '6', '5', '8', '7', '2', 'SLIP R', '7', '8', '3', '6', 'ROLL L', '5', 'CIRCLE R'],
  ['1', '2', '3', '2', '5', '6', '7', '8', '5', '6', 'ROLL R', '7', '8', '7', '2', 'STEP OUT'],
];

const PRO_COMBOS_2: string[][] = [
  ['1', '2', '3', '6', '5', '8', '7', 'ROLL L', '7', '8', '2', '3', 'CIRCLE L', 'STEP IN'],
  ['5', '6', '7', '8', '5', '6', 'SLIP R', '3', '2', '6', '5', '8', '7', 'ROLL R', 'STEP OUT'],
  ['1', '1', '2', '5', '6', '7', '8', '2', 'ROLL L', '3', '6', '7', '8', 'SLIP L', 'CIRCLE R'],
  ['7', '8', '7', '2', '3', '6', 'SLIP L', '5', '6', '7', '8', '3', '2', 'ROLL L', 'STEP IN'],
  ['1', '2', 'SLIP R', '3', '6', '5', '8', '7', '8', '7', '2', 'ROLL R', '3', '6', 'STEP OUT'],
  ['3', '2', '5', '6', '7', '8', 'ROLL L', '7', '8', '7', '2', '3', 'SLIP L', '3', '6'],
  ['1', '6', '5', '8', '7', '2', 'SLIP R', '3', '2', '7', '8', '5', '6', 'ROLL L', 'CIRCLE L'],
  ['5', '2', '3', '6', '7', '8', '5', '6', 'SLIP L', '5', '6', '7', '8', '2', 'STEP IN'],
  ['1', '2', '3', '2', '5', '6', 'ROLL R', '5', '6', '7', '8', '7', '8', '7', '2', 'CIRCLE R'],
  ['7', '8', '5', '6', '7', '8', '2', 'SLIP R', '3', '6', '5', '8', '7', 'ROLL L', 'STEP OUT'],
  ['1', '1', '2', '3', '6', '5', '8', 'SLIP L', '5', '8', '7', '2', '3', '6', 'ROLL R'],
  ['2', '3', '2', '5', '6', '7', '8', 'ROLL L', '7', '8', '3', '2', '6', 'SLIP R', 'CIRCLE L'],
  ['1', '2', '5', '6', '7', '8', '5', 'SLIP L', '7', '8', '7', '2', '3', 'ROLL L', 'STEP IN'],
  ['3', '6', '5', '8', '7', '2', 'ROLL R', '7', '8', '5', '6', '2', '3', '6', 'CIRCLE R'],
  ['1', '2', '3', '6', '7', '8', '5', '6', 'SLIP R', '5', '6', '7', '8', '5', '2', 'ROLL L', 'STEP OUT'],
];

export const BEGINNER_PRESET_WORKOUTS: Workout[] = [
  createWorkout('preset_beginner_1', 'Beginner Boxing I', 'beginner', BEGINNER_COMBOS_1),
  createWorkout('preset_beginner_2', 'Beginner Boxing II', 'beginner', BEGINNER_COMBOS_2),
  createWorkout('preset_beginner_3', 'Beginner Boxing III', 'beginner', BEGINNER_COMBOS_3),
];

export const INTERMEDIATE_PRESET_WORKOUTS: Workout[] = [
  createWorkout('preset_intermediate_1', 'Intermediate Boxing I', 'intermediate', INTERMEDIATE_COMBOS_1),
  createWorkout('preset_intermediate_2', 'Intermediate Boxing II', 'intermediate', INTERMEDIATE_COMBOS_2),
];

export const ADVANCED_PRESET_WORKOUTS: Workout[] = [
  createWorkout('preset_advanced_1', 'Advanced Boxing I', 'advanced', ADVANCED_COMBOS_1),
  createWorkout('preset_advanced_2', 'Advanced Boxing II', 'advanced', ADVANCED_COMBOS_2),
];

export const PRO_PRESET_WORKOUTS: Workout[] = [
  createWorkout('preset_pro_1', 'Pro Boxing I', 'advanced', PRO_COMBOS_1),
  createWorkout('preset_pro_2', 'Pro Boxing II', 'advanced', PRO_COMBOS_2),
];

// COACH PRESET - Full 90-minute training session
export const COACH_PRESET_WORKOUTS: Workout[] = [
  {
    id: 'preset_coach_1',
    name: 'Full Training Session',
    icon: '🥊',
    difficulty: 'advanced',
    totalDuration: 5400, // 90 minutes
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    sections: {
      warmup: [
        {
          id: 'coach-warmup-1',
          name: 'Dynamic Warmup',
          repeats: 1,
          segments: [
            { id: 'coach-w-1', name: 'Jump Rope', type: 'active', segmentType: 'work', duration: 300 },
            { id: 'coach-w-2', name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 60 },
            { id: 'coach-w-3', name: 'Shadow Boxing', type: 'active', segmentType: 'shadowboxing', duration: 300 },
            { id: 'coach-w-4', name: 'Active Rest', type: 'rest', segmentType: 'rest', duration: 60 },
            { id: 'coach-w-5', name: 'Mitt Warmup', type: 'active', segmentType: 'work', duration: 180 },
          ],
        },
      ],
      grind: [
        {
          id: 'coach-grind-tech',
          name: 'Technical Drilling',
          repeats: 4,
          segments: [
            { id: 'coach-g-1', name: 'Technique Drill', type: 'active', segmentType: 'shadowboxing', duration: 180 },
            { id: 'coach-g-2', name: 'Partner Drill', type: 'active', segmentType: 'work', duration: 180 },
            { id: 'coach-g-3', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
          ],
        },
        {
          id: 'coach-grind-spar',
          name: 'Sparring Rounds',
          repeats: 6,
          segments: [
            { id: 'coach-s-1', name: 'Sparring', type: 'active', segmentType: 'combo', duration: 180 },
            { id: 'coach-s-2', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
          ],
        },
        {
          id: 'coach-grind-bag',
          name: 'Heavy Bag Finisher',
          repeats: 4,
          segments: [
            { id: 'coach-b-1', name: 'Bag Work', type: 'active', segmentType: 'combo', duration: 180 },
            { id: 'coach-b-2', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
          ],
        },
      ],
      cooldown: [
        {
          id: 'coach-cool-1',
          name: 'Conditioning',
          repeats: 1,
          segments: [
            { id: 'coach-c-1', name: 'Core Work', type: 'active', segmentType: 'work', duration: 300 },
            { id: 'coach-c-2', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
            { id: 'coach-c-3', name: 'Stretching', type: 'active', segmentType: 'work', duration: 300 },
          ],
        },
      ],
    },
    combos: [
      ['1', '2', '3', '2', 'SLIP L', '3', '2'],
      ['1', '1', '2', 'ROLL L', '5', '6', '3', '2'],
      ['SLIP R', '2', '3', '2', '5', '6', 'ROLL L', '3'],
      ['1', '2', '5', '2', 'SLIP L', '3', '6', '3', '2'],
      ['3', '2', 'ROLL R', '5', '6', '5', '2', '3', '2'],
      ['1', '2', '3', '6', 'SLIP R', '5', '8', '7', '2'],
      ['STEP IN', '1', '2', '5', '6', '3', '2', 'STEP OUT'],
      ['1', '2', 'ROLL L', '7', '8', '3', '2', 'CIRCLE L'],
      ['5', '6', '5', '2', '3', '6', 'SLIP L', '5', '2'],
      ['1', '2', '3', '2', '5', '6', '7', '8', '3', '2'],
    ],
  },
];

export const ALL_PRESET_WORKOUTS: Workout[] = [
  ...BEGINNER_PRESET_WORKOUTS,
  ...INTERMEDIATE_PRESET_WORKOUTS,
  ...ADVANCED_PRESET_WORKOUTS,
  ...PRO_PRESET_WORKOUTS,
  ...COACH_PRESET_WORKOUTS,
];