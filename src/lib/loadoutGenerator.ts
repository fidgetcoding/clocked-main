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
 * 
 * Output: DB-compatible format with flat phases array, each phase tagged with section.
 */

import { WorkoutPhase, WorkoutSegment } from '@/types';
import { selectCombosForWorkout, TierName } from '@/data/comboPools';

export interface UserEquipmentConfig {
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
  sequential: boolean = false
): GeneratedLoadout {
  const tier = mapExperienceToTier(experienceLevel);
  const combos = selectCombosForWorkout(tier, sequential);
  const primaryBag = determinePrimaryBag(equipment);
  const hasBag = primaryBag !== 'none';

  const phases: WorkoutPhase[] = [];

  // ─── WARMUP ────────────────────────────────────────
  phases.push({
    id: generateId(),
    name: 'Warmup',
    repeats: 1,
    section: 'warmup',
    segments: [{
      id: generateId(),
      name: equipment.jumpRope ? 'Jump Rope' : 'High Knees',
      type: 'active',
      segmentType: 'exercise',
      duration: 180,
    }],
  });

  // ─── ROUNDS (10 boxing cycles) ─────────────────────
  combos.forEach((combo, index) => {
    const segments: WorkoutSegment[] = [];

    // Shadowboxing
    segments.push({
      id: generateId(),
      name: 'Shadowboxing',
      type: 'active',
      segmentType: 'shadowboxing',
      duration: hasBag ? 30 : 60,
      combo,
    });

    // Bag Work (only if user has a bag)
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

    // Pushups
    segments.push({
      id: generateId(),
      name: 'Pushups',
      type: 'active',
      segmentType: 'exercise',
      duration: 30,
    });

    // Rest
    segments.push({
      id: generateId(),
      name: 'Rest',
      type: 'rest',
      segmentType: 'rest',
      duration: 30,
    });

    phases.push({
      id: generateId(),
      name: `Round ${index + 1}`,
      repeats: 1,
      section: 'grind',
      segments,
      combos: [combo],
    });
  });

  // Conditioning
  phases.push({
    id: generateId(),
    name: 'Conditioning',
    repeats: 1,
    section: 'grind',
    segments: [
      { id: generateId(), name: 'Curlups', type: 'active', segmentType: 'exercise', duration: 60 },
      { id: generateId(), name: 'Rest', type: 'rest', segmentType: 'rest', duration: 60 },
    ],
  });

  // ─── COOLDOWN ──────────────────────────────────────
  phases.push({
    id: generateId(),
    name: 'Cooldown',
    repeats: 1,
    section: 'cooldown',
    segments: [{
      id: generateId(),
      name: equipment.treadmill ? 'Treadmill' : 'Jog in Place',
      type: 'active',
      segmentType: 'exercise',
      duration: 600,
    }],
  });

  // Calculate total duration
  const warmupDuration = 180;
  const roundsDuration = combos.length * (hasBag ? 120 : 90) + 120;
  const cooldownDuration = 600;
  const totalDuration = warmupDuration + roundsDuration + cooldownDuration;

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return {
    name: `${tierLabel} Loadout`,
    description: `Auto-generated ${tierLabel} loadout with ${hasBag ? (primaryBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag') : 'Shadowboxing'} focus`,
    duration: totalDuration,
    difficulty: tier,
    phases,
    combos,
    tags: ['loadout', 'boxing', tier],
    is_preset: true,
    is_archived: false,
    times_completed: 0,
    last_used_at: null,
  };
}