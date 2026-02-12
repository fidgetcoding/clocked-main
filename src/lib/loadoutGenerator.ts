/**
 * Loadout Generator
 * Generates the standard ~35min workout based on user's tier + equipment.
 * 
 * Structure:
 * WARMUP: Jump Rope OR High Knees (3:00)
 * ROUNDS: 10 Boxing Cycles (Shadow 0:30 + Bag/Shadow 0:30 + Pushups 0:30 + Rest 0:30) = 20:00
 *         + Curlups 1:00 + Rest 1:00 = 22:00
 * COOLDOWN: Treadmill OR Jog in Place (10:00)
 * Total: ~35:00
 */

import { Workout, WorkoutPhase, WorkoutSegment } from '@/types';
import { selectCombosForWorkout, TierName } from '@/data/comboPools';

interface UserEquipmentConfig {
  jumpRope: boolean;
  heavyBag: boolean;
  doubleEndBag: boolean;
  speedBag: boolean;
  treadmill: boolean;
  primaryBag?: 'heavy' | 'double_end' | 'none';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function mapExperienceToTier(experienceLevel: string): TierName {
  switch (experienceLevel) {
    case 'complete_beginner': return 'rookie';
    case 'beginner': return 'beginner';
    case 'intermediate': return 'intermediate';
    case 'advanced': return 'advanced';
    case 'pro': return 'pro';
    default: return 'rookie';
  }
}

function getDifficulty(tier: TierName): 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro' {
  return tier;
}

function determinePrimaryBag(equipment: UserEquipmentConfig): 'heavy' | 'double_end' | 'none' {
  if (equipment.primaryBag && equipment.primaryBag !== 'none') {
    return equipment.primaryBag;
  }
  if (equipment.heavyBag) return 'heavy';
  if (equipment.doubleEndBag) return 'double_end';
  return 'none';
}

export function generateLoadoutWorkout(
  experienceLevel: string,
  equipment: UserEquipmentConfig,
  sequential: boolean = false
): Workout {
  const tier = mapExperienceToTier(experienceLevel);
  const combos = selectCombosForWorkout(tier, sequential);
  const primaryBag = determinePrimaryBag(equipment);
  const hasBag = primaryBag !== 'none';

  // ─── WARMUP ────────────────────────────────────────
  const warmupSegment: WorkoutSegment = {
    id: generateId(),
    name: equipment.jumpRope ? 'Jump Rope' : 'High Knees',
    type: 'active',
    segmentType: 'exercise',
    duration: 180, // 3:00
  };

  const warmupPhase: WorkoutPhase = {
    id: generateId(),
    name: 'Warmup',
    repeats: 1,
    section: 'warmup',
    segments: [warmupSegment],
  };

  // ─── ROUNDS (10 boxing cycles) ─────────────────────
  const roundPhases: WorkoutPhase[] = combos.map((combo, index) => {
    const segments: WorkoutSegment[] = [];

    // Shadowboxing 0:30
    segments.push({
      id: generateId(),
      name: 'Shadowboxing',
      type: 'active',
      segmentType: 'shadowboxing',
      duration: hasBag ? 30 : 60, // If no bag, 60s continuous shadow
      combo,
    });

    // Bag Work 0:30 (only if user has a bag)
    if (hasBag) {
      segments.push({
        id: generateId(),
        name: primaryBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag',
        type: 'active',
        segmentType: primaryBag === 'heavy' ? 'combo' : 'doubleend',
        duration: 30,
        combo,
      });
    }

    // Pushups 0:30
    segments.push({
      id: generateId(),
      name: 'Pushups',
      type: 'active',
      segmentType: 'exercise',
      duration: 30,
    });

    // Rest 0:30
    segments.push({
      id: generateId(),
      name: 'Rest',
      type: 'rest',
      segmentType: 'rest',
      duration: 30,
    });

    return {
      id: generateId(),
      name: `Round ${index + 1}`,
      repeats: 1,
      section: 'grind' as const,
      segments,
      combos: [combo],
    };
  });

  // Conditioning after 10 cycles (still in ROUNDS)
  const conditioningPhase: WorkoutPhase = {
    id: generateId(),
    name: 'Conditioning',
    repeats: 1,
    section: 'grind',
    segments: [
      {
        id: generateId(),
        name: 'Curlups',
        type: 'active',
        segmentType: 'exercise',
        duration: 60,
      },
      {
        id: generateId(),
        name: 'Rest',
        type: 'rest',
        segmentType: 'rest',
        duration: 60,
      },
    ],
  };

  // ─── COOLDOWN ──────────────────────────────────────
  const cooldownSegment: WorkoutSegment = {
    id: generateId(),
    name: equipment.treadmill ? 'Treadmill' : 'Jog in Place',
    type: 'active',
    segmentType: 'exercise',
    duration: 600, // 10:00
  };

  const cooldownPhase: WorkoutPhase = {
    id: generateId(),
    name: 'Cooldown',
    repeats: 1,
    section: 'cooldown',
    segments: [cooldownSegment],
  };

  // Calculate total duration
  const warmupDuration = 180;
  const roundsDuration = combos.length * (hasBag ? 120 : 90) + 120; // 10 cycles + conditioning
  const cooldownDuration = 600;
  const totalDuration = warmupDuration + roundsDuration + cooldownDuration;

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  const workout: Workout = {
    id: generateId(),
    name: `${tierLabel} Loadout`,
    icon: '🥊',
    difficulty: getDifficulty(tier),
    totalDuration,
    isPreset: true,
    isArchived: false,
    createdAt: new Date(),
    timesCompleted: 0,
    sections: {
      warmup: [warmupPhase],
      grind: [...roundPhases, conditioningPhase],
      cooldown: [cooldownPhase],
    },
    combos: combos,
    tags: ['loadout', 'boxing', tier],
  };

  return workout;
}

export { mapExperienceToTier };
