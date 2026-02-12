/**
 * Loadout Generator
 * Generates the standard ~35min workout based on user's tier + equipment.
 * 
 * Structure:
 * WARMUP: Jump Rope OR High Knees (3:00)
 * ROUNDS: Segment group phases with megasetRepeats (each group = 1 phase)
 *         + Conditioning (Curlups 1:00 + Rest 1:00)
 * COOLDOWN: Treadmill OR Jog in Place (10:00)
 * 
 * Output: DB-compatible format with flat phases array, each phase tagged with section.
 */

import { WorkoutPhase, WorkoutSegment } from '@/types';
import { COMBO_POOLS, TierName } from '@/data/comboPools';

export interface UserEquipmentConfig {
  gloves: boolean;
  wraps: boolean;
  jumpRope: boolean;
  heavyBag: boolean;
  doubleEndBag: boolean;
  speedBag: boolean;
  treadmill: boolean;
  primaryBag?: 'heavy' | 'double_end' | 'none';
}

export interface GeneratedLoadout {
  name: string;
  description: string;
  duration: number;
  difficulty: string;
  phases: WorkoutPhase[];
  combos: string[][];
  tags: string[];
  is_preset: boolean;
  is_archived: boolean;
  times_completed: number;
  last_used_at: null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function mapExperienceToTier(experienceLevel: string): TierName {
  switch (experienceLevel) {
    case 'complete_beginner': return 'rookie';
    case 'beginner': return 'beginner';
    case 'intermediate': return 'intermediate';
    case 'advanced': return 'advanced';
    case 'pro': return 'pro';
    default: return 'rookie';
  }
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
): GeneratedLoadout {
  const tier = mapExperienceToTier(experienceLevel);
  const primaryBag = determinePrimaryBag(equipment);
  const canUseBag = equipment.gloves && equipment.wraps && (equipment.heavyBag || equipment.doubleEndBag);

  const tierPools = COMBO_POOLS[tier];
  const phases: WorkoutPhase[] = [];

  // Collect all combos across all segments for the top-level combos field
  const allCombos: string[][] = [];

  // ─── WARMUP ────────────────────────────────────────
  const warmupExercise = equipment.jumpRope ? 'Jump Rope' : 'High Knees';
  phases.push({
    id: generateId(),
    name: 'Warmup',
    repeats: 1,
    section: 'warmup',
    segments: [{
      id: generateId(),
      name: warmupExercise,
      type: 'active',
      segmentType: 'exercise',
      duration: 180,
      exercise: warmupExercise,
    }],
  });

  // ─── ROUNDS — Segment Group Phases ─────────────────
  for (const segment of tierPools.segments) {
    const roundCount = segment.rounds[1] - segment.rounds[0] + 1;
    const pool = segment.pool;

    // Add all combos from this pool to the allCombos collection
    pool.forEach(combo => allCombos.push(combo));

    const segments: WorkoutSegment[] = [];

    if (canUseBag) {
      // Shadowboxing segment (30s) — all combos loaded, random
      segments.push({
        id: generateId(),
        name: 'Shadowboxing',
        type: 'active',
        segmentType: 'shadowboxing',
        duration: 30,
      });

      // Bag Work segment (30s) — same combos, random
      segments.push({
        id: generateId(),
        name: primaryBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag',
        type: 'active',
        segmentType: primaryBag === 'heavy' ? 'combo' : 'doubleend',
        duration: 30,
      });
    } else {
      // No bag: 60s shadowboxing
      segments.push({
        id: generateId(),
        name: 'Shadowboxing',
        type: 'active',
        segmentType: 'shadowboxing',
        duration: 60,
      });
    }

    // Pushups segment (30s)
    segments.push({
      id: generateId(),
      name: 'Pushups',
      type: 'active',
      segmentType: 'exercise',
      duration: 30,
      exercise: 'Pushups',
    });

    // Rest segment (30s)
    segments.push({
      id: generateId(),
      name: 'Rest',
      type: 'rest',
      segmentType: 'rest',
      duration: 30,
    });

    phases.push({
      id: generateId(),
      name: `${segment.name} Rounds`,
      repeats: roundCount,
      section: 'grind',
      segments,
      combos: pool,
      comboOrder: 'random',
    });
  }

  // ─── Conditioning ──────────────────────────────────
  phases.push({
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
        exercise: 'Curlups',
      },
      {
        id: generateId(),
        name: 'Rest',
        type: 'rest',
        segmentType: 'rest',
        duration: 60,
      },
    ],
  });

  // ─── COOLDOWN ──────────────────────────────────────
  const cooldownExercise = equipment.treadmill ? 'Treadmill' : 'Jog in Place';
  phases.push({
    id: generateId(),
    name: 'Cooldown',
    repeats: 1,
    section: 'cooldown',
    segments: [{
      id: generateId(),
      name: cooldownExercise,
      type: 'active',
      segmentType: 'exercise',
      duration: 600,
      exercise: cooldownExercise,
    }],
  });

  // Calculate total duration
  const warmupDuration = 180;
  const roundsDuration = 10 * (canUseBag ? 120 : 120) + 120; // 10 rounds + conditioning
  const cooldownDuration = 600;
  const totalDuration = warmupDuration + roundsDuration + cooldownDuration;

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return {
    name: `${tierLabel} Loadout`,
    description: `Auto-generated ${tierLabel} loadout with ${canUseBag ? (primaryBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag') : 'Shadowboxing'} focus`,
    duration: totalDuration,
    difficulty: tier,
    phases,
    combos: allCombos,
    tags: ['loadout', 'boxing', tier],
    is_preset: true,
    is_archived: false,
    times_completed: 0,
    last_used_at: null,
  };
}
