import { Workout } from '@/types';

const createBeginnerWorkout = (
  id: string,
  name: string,
  combos: string[][]
): Workout => ({
  id,
  name,
  icon: '🥊',
  difficulty: 'beginner',
  totalDuration: 3540, // 59 minutes
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

export const BEGINNER_PRESET_WORKOUTS: Workout[] = [
  createBeginnerWorkout('preset_beginner_1', 'Beginner Boxing I', [
    ['1', '2', 'SLIP LEFT'],
    ['1', '1', '2', 'SLIP LEFT'],
    ['2', '1', 'SLIP LEFT'],
    ['3', '2', 'SLIP LEFT'],
    ['1', 'SLIP LEFT', '3'],
    ['2', 'SLIP LEFT', '3'],
    ['3', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['2', '3', '2', 'SLIP LEFT'],
    ['1', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['3', '2', '1', 'SLIP LEFT'],
    ['1', 'SLIP LEFT', '3', '2', 'SLIP LEFT'],
    ['2', 'SLIP LEFT', '3', '2', 'SLIP LEFT'],
    ['2', '1', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['3', 'SLIP LEFT', '3', '2', 'SLIP LEFT'],
    ['2', '3', 'SLIP LEFT', '3', 'SLIP LEFT'],
  ]),
  createBeginnerWorkout('preset_beginner_2', 'Beginner Boxing II', [
    ['1', '2', 'SLIP LEFT'],
    ['1', '1', '2', 'SLIP LEFT'],
    ['2', '3', 'SLIP LEFT'],
    ['3', 'SLIP LEFT', '3'],
    ['1', 'SLIP LEFT', '5'],
    ['2', 'SLIP LEFT', '5'],
    ['3', 'SLIP LEFT', '5', 'SLIP LEFT'],
    ['2', '5', '2', 'SLIP LEFT'],
    ['1', 'SLIP LEFT', '5', 'SLIP LEFT'],
    ['3', '2', '3', 'SLIP LEFT'],
    ['1', 'SLIP LEFT', '5', '2', 'SLIP LEFT'],
    ['2', 'SLIP LEFT', '5', '2', 'SLIP LEFT'],
    ['2', '1', 'SLIP LEFT', '5', 'SLIP LEFT'],
    ['3', 'SLIP LEFT', '5', '2', 'SLIP LEFT'],
    ['2', '3', 'SLIP LEFT', '5', 'SLIP LEFT'],
  ]),
  createBeginnerWorkout('preset_beginner_3', 'Beginner Boxing III', [
    ['1', '2', 'SLIP LEFT'],
    ['1', '1', '2', 'SLIP LEFT'],
    ['2', '5', 'SLIP LEFT'],
    ['3', 'SLIP LEFT', '5'],
    ['1', '1', 'SLIP LEFT', '3'],
    ['2', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['2', 'SLIP LEFT', '5', 'SLIP LEFT'],
    ['3', '2', '5', 'SLIP LEFT'],
    ['2', '1', '2', 'SLIP LEFT'],
    ['1', '2', '3', 'SLIP LEFT'],
    ['1', '2', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['2', '5', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['2', '5', 'SLIP LEFT', '5', 'SLIP LEFT'],
    ['3', '2', 'SLIP LEFT', '3', 'SLIP LEFT'],
    ['3', '2', 'SLIP LEFT', '5', 'SLIP LEFT'],
  ]),
];
