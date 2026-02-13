import { describe, it, expect } from 'vitest';
import { generateLoadoutWorkout, UserEquipmentConfig, mapExperienceToTier } from '@/lib/loadoutGenerator';
import { COMBO_POOLS } from '@/data/comboPools';

// ─── Types ────────────────────────────────────────────
interface TestCase {
  id: number;
  tier: 'rookie' | 'beginner' | 'intermediate' | 'advanced' | 'pro';
  equipment: UserEquipmentConfig;
  primaryBag: 'heavy' | 'double_end' | 'none';
}

interface RoundGroupSpec {
  name: string;
  repeats: number;
  combos: number;
}

// ─── Expected round groups per tier ───────────────────
function getExpectedRoundGroups(tier: string): RoundGroupSpec[] {
  const specs: Record<string, RoundGroupSpec[]> = {
    rookie: [
      { name: 'Easy Rounds', repeats: 4, combos: 8 },
      { name: 'Medium Rounds', repeats: 3, combos: 12 },
      { name: 'Hard Rounds', repeats: 3, combos: 12 },
    ],
    beginner: [
      { name: 'Warmup Rounds', repeats: 2, combos: 16 },
      { name: 'Build Rounds', repeats: 3, combos: 16 },
      { name: 'Slip Intro Rounds', repeats: 3, combos: 12 },
      { name: 'Advanced Slip Rounds', repeats: 2, combos: 10 },
    ],
    intermediate: [
      { name: 'Warmup Rounds', repeats: 1, combos: 14 },
      { name: 'Slip Foundation Rounds', repeats: 2, combos: 10 },
      { name: 'Slip Combos Rounds', repeats: 2, combos: 12 },
      { name: 'Roll Introduction Rounds', repeats: 3, combos: 12 },
      { name: 'Combined Rounds', repeats: 2, combos: 12 },
    ],
    advanced: [
      { name: 'Warmup Rounds', repeats: 1, combos: 6 },
      { name: 'Build Rounds', repeats: 1, combos: 8 },
      { name: 'Mid Rounds', repeats: 3, combos: 14 },
      { name: 'Advanced Rounds', repeats: 3, combos: 12 },
      { name: 'Full Armada Rounds', repeats: 2, combos: 10 },
    ],
    pro: [
      { name: 'Warmup Rounds', repeats: 2, combos: 8 },
      { name: 'All Defense Rounds', repeats: 2, combos: 10 },
      { name: 'Weaved 4+ Punch Rounds', repeats: 3, combos: 14 },
      { name: 'True Pro Rounds', repeats: 3, combos: 12 },
    ],
  };
  return specs[tier]!;
}

// ─── Derive expectations ──────────────────────────────
function deriveExpectations(tc: TestCase) {
  const canUseBag = tc.equipment.gloves && tc.equipment.wraps && (tc.equipment.heavyBag || tc.equipment.doubleEndBag);

  let activeBag: 'heavy' | 'double_end' | null = null;
  if (canUseBag) {
    if (tc.equipment.heavyBag && tc.equipment.doubleEndBag) {
      activeBag = tc.primaryBag as 'heavy' | 'double_end';
    } else if (tc.equipment.heavyBag) {
      activeBag = 'heavy';
    } else {
      activeBag = 'double_end';
    }
  }

  return {
    canUseBag,
    activeBag,
    hasJumpRope: tc.equipment.jumpRope,
    hasTreadmill: tc.equipment.treadmill,
  };
}

// ─── Generate all 800 test cases ──────────────────────
function generateAllTestCases(): TestCase[] {
  const tiers = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'] as const;
  const booleans = [true, false];
  const cases: TestCase[] = [];
  let id = 1;

  for (const tier of tiers) {
    for (const gloves of booleans) {
      for (const wraps of booleans) {
        for (const heavyBag of booleans) {
          for (const doubleEndBag of booleans) {
            for (const speedBag of booleans) {
              for (const jumpRope of booleans) {
                for (const treadmill of booleans) {
                  const equipment: UserEquipmentConfig = {
                    gloves, wraps, heavyBag, doubleEndBag, speedBag, jumpRope, treadmill,
                  };

                  if (heavyBag && doubleEndBag) {
                    cases.push({ id: id++, tier, equipment, primaryBag: 'heavy' });
                    cases.push({ id: id++, tier, equipment, primaryBag: 'double_end' });
                  } else {
                    cases.push({ id: id++, tier, equipment, primaryBag: 'none' });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return cases;
}

// ─── Validation ───────────────────────────────────────
function validateLoadout(tc: TestCase): string[] {
  const { canUseBag, activeBag, hasJumpRope, hasTreadmill } = deriveExpectations(tc);
  const failures: string[] = [];
  const tierName = tc.tier.charAt(0).toUpperCase() + tc.tier.slice(1);

  // Map tier to experience level string the generator expects
  const experienceLevelMap: Record<string, string> = {
    rookie: 'complete_beginner',
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'advanced',
    pro: 'pro',
  };

  const equipWithPrimary: UserEquipmentConfig = { ...tc.equipment, primaryBag: tc.primaryBag };
  const workout = generateLoadoutWorkout(experienceLevelMap[tc.tier], equipWithPrimary);

  // ── Workout Name ──
  const expectedName = `${tierName} Loadout`;
  if (workout.name !== expectedName) {
    failures.push(`Name: expected "${expectedName}", got "${workout.name}"`);
  }

  // ── Tags ──
  if (!workout.tags.includes('loadout')) {
    failures.push('Missing "loadout" tag');
  }

  // ── Phase Structure ──
  const phases = workout.phases;

  // First phase = Warmup
  const warmup = phases[0];
  if (!warmup || warmup.name !== 'Warmup' || warmup.section !== 'warmup') {
    failures.push(`Warmup phase missing or wrong name/section`);
  } else {
    if (warmup.repeats !== 1) failures.push(`Warmup repeats: expected 1, got ${warmup.repeats}`);
    if (warmup.segments.length !== 1) failures.push(`Warmup segments: expected 1, got ${warmup.segments.length}`);
    const ws = warmup.segments[0];
    const expectedWarmupName = hasJumpRope ? 'Jump Rope' : 'Jog in Place';
    if (ws.name !== expectedWarmupName) failures.push(`Warmup exercise: expected "${expectedWarmupName}", got "${ws.name}"`);
    if (ws.duration !== 180) failures.push(`Warmup duration: expected 180, got ${ws.duration}`);
  }

  // ── Round Groups ──
  const expectedGroups = getExpectedRoundGroups(tc.tier);
  const roundPhases = phases.filter(p => p.section === 'grind' && p.name !== 'Championship Rounds' && p.name !== 'Conditioning');

  if (roundPhases.length !== expectedGroups.length) {
    failures.push(`Round group count: expected ${expectedGroups.length}, got ${roundPhases.length}`);
  } else {
    let totalRounds = 0;
    for (let i = 0; i < expectedGroups.length; i++) {
      const expected = expectedGroups[i];
      const actual = roundPhases[i];

      if (actual.name !== expected.name) {
        failures.push(`Round group ${i + 1} name: expected "${expected.name}", got "${actual.name}"`);
      }
      if (actual.repeats !== expected.repeats) {
        failures.push(`Round group "${expected.name}" repeats: expected ${expected.repeats}, got ${actual.repeats}`);
      }
      totalRounds += actual.repeats;

      // Combo count
      const combos = actual.combos || [];
      if (combos.length !== expected.combos) {
        failures.push(`Round group "${expected.name}" combos: expected ${expected.combos}, got ${combos.length}`);
      }

      // comboOrder
      if (actual.comboOrder !== 'random') {
        failures.push(`Round group "${expected.name}" comboOrder: expected "random", got "${actual.comboOrder}"`);
      }

      // Segment structure
      if (canUseBag) {
        // Expect: shadow 30s, bag 30s, pushups 30s, rest 30s
        if (actual.segments.length !== 4) {
          failures.push(`Round group "${expected.name}" segments: expected 4 (canUseBag), got ${actual.segments.length}`);
        } else {
          const [shadow, bag, pushups, rest] = actual.segments;
          if (shadow.duration !== 30) failures.push(`"${expected.name}" shadow duration: expected 30, got ${shadow.duration}`);
          if (shadow.segmentType !== 'shadowboxing') failures.push(`"${expected.name}" shadow type: expected "shadowboxing", got "${shadow.segmentType}"`);

          if (bag.duration !== 30) failures.push(`"${expected.name}" bag duration: expected 30, got ${bag.duration}`);
          const expectedBagName = activeBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag';
          if (bag.name !== expectedBagName) failures.push(`"${expected.name}" bag name: expected "${expectedBagName}", got "${bag.name}"`);
          const expectedBagType = activeBag === 'heavy' ? 'combo' : 'doubleend';
          if (bag.segmentType !== expectedBagType) failures.push(`"${expected.name}" bag segmentType: expected "${expectedBagType}", got "${bag.segmentType}"`);

          if (pushups.name !== 'Pushups') failures.push(`"${expected.name}" pushups name: expected "Pushups", got "${pushups.name}"`);
          if (pushups.duration !== 30) failures.push(`"${expected.name}" pushups duration: expected 30, got ${pushups.duration}`);

          if (rest.type !== 'rest') failures.push(`"${expected.name}" rest type: expected "rest", got "${rest.type}"`);
          if (rest.duration !== 30) failures.push(`"${expected.name}" rest duration: expected 30, got ${rest.duration}`);
        }
      } else {
        // Expect: shadow 60s, pushups 30s, rest 30s
        if (actual.segments.length !== 3) {
          failures.push(`Round group "${expected.name}" segments: expected 3 (!canUseBag), got ${actual.segments.length}`);
        } else {
          const [shadow, pushups, rest] = actual.segments;
          if (shadow.duration !== 60) failures.push(`"${expected.name}" shadow duration: expected 60, got ${shadow.duration}`);
          if (shadow.segmentType !== 'shadowboxing') failures.push(`"${expected.name}" shadow type: expected "shadowboxing", got "${shadow.segmentType}"`);

          if (pushups.name !== 'Pushups') failures.push(`"${expected.name}" pushups name: expected "Pushups", got "${pushups.name}"`);
          if (pushups.duration !== 30) failures.push(`"${expected.name}" pushups duration: expected 30, got ${pushups.duration}`);

          if (rest.type !== 'rest') failures.push(`"${expected.name}" rest type: expected "rest", got "${rest.type}"`);
          if (rest.duration !== 30) failures.push(`"${expected.name}" rest duration: expected 30, got ${rest.duration}`);
        }
      }
    }

    if (totalRounds !== 10) {
      failures.push(`Total rounds: expected 10, got ${totalRounds}`);
    }
  }

  // ── Championship Rounds ──
  const champ = phases.find(p => p.name === 'Championship Rounds');
  if (!champ) {
    failures.push('Championship Rounds phase missing');
  } else {
    if (champ.repeats !== 2) failures.push(`Championship repeats: expected 2, got ${champ.repeats}`);
    if (champ.comboOrder !== 'random') failures.push(`Championship comboOrder: expected "random", got "${champ.comboOrder}"`);

    const champCombos = champ.combos || [];
    if (champCombos.length !== 1) {
      failures.push(`Championship combos count: expected 1, got ${champCombos.length}`);
    } else {
      const freestyleCombo = champCombos[0];
      if (!freestyleCombo || freestyleCombo[0] !== 'FREESTYLE') {
        failures.push(`Championship combo: expected ["FREESTYLE"], got ${JSON.stringify(freestyleCombo)}`);
      }
    }

    if (canUseBag) {
      if (champ.segments.length !== 4) {
        failures.push(`Championship segments: expected 4 (canUseBag), got ${champ.segments.length}`);
      } else {
        const [shadow, bag, burpees, rest] = champ.segments;
        if (shadow.duration !== 30) failures.push(`Championship shadow duration: expected 30, got ${shadow.duration}`);
        if (bag.duration !== 30) failures.push(`Championship bag duration: expected 30, got ${bag.duration}`);
        const expectedBagName = activeBag === 'heavy' ? 'Heavy Bag' : 'Double End Bag';
        if (bag.name !== expectedBagName) failures.push(`Championship bag name: expected "${expectedBagName}", got "${bag.name}"`);
        if (burpees.name !== 'Burpees') failures.push(`Championship burpees: expected "Burpees", got "${burpees.name}"`);
        if (burpees.duration !== 30) failures.push(`Championship burpees duration: expected 30, got ${burpees.duration}`);
        if (rest.type !== 'rest') failures.push(`Championship rest type: expected "rest", got "${rest.type}"`);
        if (rest.duration !== 30) failures.push(`Championship rest duration: expected 30, got ${rest.duration}`);
      }
    } else {
      if (champ.segments.length !== 3) {
        failures.push(`Championship segments: expected 3 (!canUseBag), got ${champ.segments.length}`);
      } else {
        const [shadow, burpees, rest] = champ.segments;
        if (shadow.duration !== 60) failures.push(`Championship shadow duration: expected 60, got ${shadow.duration}`);
        if (burpees.name !== 'Burpees') failures.push(`Championship burpees: expected "Burpees", got "${burpees.name}"`);
        if (rest.type !== 'rest') failures.push(`Championship rest type: expected "rest", got "${rest.type}"`);
      }
    }
  }

  // ── Conditioning ──
  const conditioning = phases.find(p => p.name === 'Conditioning');
  if (!conditioning) {
    failures.push('Conditioning phase missing');
  } else {
    if (conditioning.repeats !== 1) failures.push(`Conditioning repeats: expected 1, got ${conditioning.repeats}`);
    if (conditioning.segments.length !== 2) {
      failures.push(`Conditioning segments: expected 2, got ${conditioning.segments.length}`);
    } else {
      const [curlups, rest] = conditioning.segments;
      if (curlups.name !== 'Curlups') failures.push(`Conditioning exercise: expected "Curlups", got "${curlups.name}"`);
      if (curlups.duration !== 120) failures.push(`Conditioning curlups duration: expected 120, got ${curlups.duration}`);
      if (rest.type !== 'rest') failures.push(`Conditioning rest type: expected "rest", got "${rest.type}"`);
      if (rest.duration !== 60) failures.push(`Conditioning rest duration: expected 60, got ${rest.duration}`);
    }
  }

  // ── Cooldown ──
  const cooldown = phases.find(p => p.name === 'Cooldown');
  if (!cooldown) {
    failures.push('Cooldown phase missing');
  } else {
    if (cooldown.repeats !== 1) failures.push(`Cooldown repeats: expected 1, got ${cooldown.repeats}`);
    if (cooldown.section !== 'cooldown') failures.push(`Cooldown section: expected "cooldown", got "${cooldown.section}"`);
    if (cooldown.segments.length !== 1) {
      failures.push(`Cooldown segments: expected 1, got ${cooldown.segments.length}`);
    } else {
      const cd = cooldown.segments[0];
      const expectedCooldownName = hasTreadmill ? 'Treadmill' : 'Jog';
      if (cd.name !== expectedCooldownName) failures.push(`Cooldown exercise: expected "${expectedCooldownName}", got "${cd.name}"`);
      if (cd.duration !== 600) failures.push(`Cooldown duration: expected 600, got ${cd.duration}`);
    }
  }

  // ── Bag Safety Gate ──
  if (!canUseBag) {
    for (const phase of phases) {
      for (const seg of phase.segments) {
        if (seg.segmentType === 'combo' || seg.segmentType === 'doubleend') {
          failures.push(`BAG SAFETY: bag segment "${seg.name}" found when canUseBag=false`);
        }
      }
    }
  }

  // ── Speed Bag Never In Loadout ──
  for (const phase of phases) {
    for (const seg of phase.segments) {
      if (seg.segmentType === 'speedbag' || seg.name?.toLowerCase().includes('speed bag')) {
        failures.push(`SPEED BAG SAFETY: speed bag segment "${seg.name}" found in loadout`);
      }
    }
  }

  // ── Duration Check ──
  const calculatedDuration = phases.reduce((total, phase) => {
    const phaseTotal = phase.segments.reduce((acc, seg) => acc + seg.duration, 0);
    return total + phaseTotal * phase.repeats;
  }, 0);
  if (workout.duration !== calculatedDuration) {
    failures.push(`Duration mismatch: workout.duration=${workout.duration} but calculated=${calculatedDuration}`);
  }

  return failures;
}

// ─── Format equipment for readable output ─────────────
function formatEquipment(eq: UserEquipmentConfig): string {
  const items: string[] = [];
  if (eq.gloves) items.push('G');
  if (eq.wraps) items.push('W');
  if (eq.heavyBag) items.push('HB');
  if (eq.doubleEndBag) items.push('DEB');
  if (eq.speedBag) items.push('SB');
  if (eq.jumpRope) items.push('JR');
  if (eq.treadmill) items.push('TM');
  return items.length > 0 ? items.join('+') : 'NONE';
}

// ─── Run all 800 tests ───────────────────────────────
describe('Loadout Validation — Full 800-Case Matrix', () => {
  const allCases = generateAllTestCases();

  // Verify we have exactly 800 cases
  it('generates exactly 800 test cases', () => {
    expect(allCases.length).toBe(800);
  });

  // Group by tier for organized output
  const tiers = ['rookie', 'beginner', 'intermediate', 'advanced', 'pro'] as const;

  for (const tier of tiers) {
    const tierCases = allCases.filter(tc => tc.tier === tier);

    describe(`${tier.toUpperCase()} (${tierCases.length} cases)`, () => {
      for (const tc of tierCases) {
        const label = `#${tc.id} ${tier} | ${formatEquipment(tc.equipment)} | primary=${tc.primaryBag}`;

        it(label, () => {
          const failures = validateLoadout(tc);
          if (failures.length > 0) {
            throw new Error(`FAILURES:\n  ✗ ${failures.join('\n  ✗ ')}`);
          }
        });
      }
    });
  }
});

// ─── Edge Case Suite ──────────────────────────────────
describe('Loadout Validation — Critical Edge Cases', () => {
  it('Edge 1: Zero equipment, every tier', () => {
    const tiers = ['complete_beginner', 'beginner', 'intermediate', 'advanced', 'pro'];
    for (const tier of tiers) {
      const eq: UserEquipmentConfig = {
        gloves: false, wraps: false, heavyBag: false, doubleEndBag: false,
        speedBag: false, jumpRope: false, treadmill: false,
      };
      const workout = generateLoadoutWorkout(tier, eq);
      const warmupSeg = workout.phases[0].segments[0];
      expect(warmupSeg.name).toBe('Jog in Place');

      const cooldownPhase = workout.phases.find(p => p.name === 'Cooldown')!;
      expect(cooldownPhase.segments[0].name).toBe('Jog');

      // No bag segments anywhere
      for (const phase of workout.phases) {
        for (const seg of phase.segments) {
          expect(seg.segmentType).not.toBe('combo');
          expect(seg.segmentType).not.toBe('doubleend');
        }
      }
    }
  });

  it('Edge 2: Gloves+Wraps but no bags → canUseBag=false', () => {
    const eq: UserEquipmentConfig = {
      gloves: true, wraps: true, heavyBag: false, doubleEndBag: false,
      speedBag: false, jumpRope: false, treadmill: false,
    };
    const workout = generateLoadoutWorkout('beginner', eq);
    const roundPhases = workout.phases.filter(p => p.section === 'grind' && p.name !== 'Championship Rounds' && p.name !== 'Conditioning');
    for (const phase of roundPhases) {
      // Should have 3 segments (shadow 60s, pushups, rest) not 4
      expect(phase.segments.length).toBe(3);
      expect(phase.segments[0].duration).toBe(60);
    }
  });

  it('Edge 3: Both bags but no gloves → canUseBag=false', () => {
    const eq: UserEquipmentConfig = {
      gloves: false, wraps: true, heavyBag: true, doubleEndBag: true,
      speedBag: false, jumpRope: false, treadmill: false, primaryBag: 'heavy',
    };
    const workout = generateLoadoutWorkout('intermediate', eq);
    for (const phase of workout.phases) {
      for (const seg of phase.segments) {
        expect(seg.segmentType).not.toBe('combo');
        expect(seg.segmentType).not.toBe('doubleend');
      }
    }
  });

  it('Edge 4: Both bags but no wraps → canUseBag=false', () => {
    const eq: UserEquipmentConfig = {
      gloves: true, wraps: false, heavyBag: true, doubleEndBag: true,
      speedBag: false, jumpRope: false, treadmill: false, primaryBag: 'heavy',
    };
    const workout = generateLoadoutWorkout('advanced', eq);
    for (const phase of workout.phases) {
      for (const seg of phase.segments) {
        expect(seg.segmentType).not.toBe('combo');
        expect(seg.segmentType).not.toBe('doubleend');
      }
    }
  });

  it('Edge 5: Single bag + gloves + wraps → canUseBag=true, no primary star', () => {
    const eq: UserEquipmentConfig = {
      gloves: true, wraps: true, heavyBag: true, doubleEndBag: false,
      speedBag: false, jumpRope: false, treadmill: false,
    };
    const workout = generateLoadoutWorkout('rookie', eq);
    const roundPhases = workout.phases.filter(p => p.section === 'grind' && p.name !== 'Championship Rounds' && p.name !== 'Conditioning');
    for (const phase of roundPhases) {
      expect(phase.segments.length).toBe(4);
      expect(phase.segments[0].duration).toBe(30); // shadow
      expect(phase.segments[1].duration).toBe(30); // bag
      expect(phase.segments[1].name).toBe('Heavy Bag');
    }
  });

  it('Edge 6: Speed bag only → never appears in loadout', () => {
    const eq: UserEquipmentConfig = {
      gloves: false, wraps: false, heavyBag: false, doubleEndBag: false,
      speedBag: true, jumpRope: false, treadmill: false,
    };
    const workout = generateLoadoutWorkout('pro', eq);
    for (const phase of workout.phases) {
      for (const seg of phase.segments) {
        expect(seg.segmentType).not.toBe('speedbag');
        expect(seg.name?.toLowerCase()).not.toContain('speed bag');
      }
    }
  });

  it('Edge 7: All equipment, primary=heavy', () => {
    const eq: UserEquipmentConfig = {
      gloves: true, wraps: true, heavyBag: true, doubleEndBag: true,
      speedBag: true, jumpRope: true, treadmill: true, primaryBag: 'heavy',
    };
    const workout = generateLoadoutWorkout('advanced', eq);
    expect(workout.phases[0].segments[0].name).toBe('Jump Rope');
    const cooldown = workout.phases.find(p => p.name === 'Cooldown')!;
    expect(cooldown.segments[0].name).toBe('Treadmill');
    // Bag segments should be Heavy Bag
    const roundPhases = workout.phases.filter(p => p.section === 'grind' && p.name !== 'Conditioning');
    for (const phase of roundPhases) {
      const bagSeg = phase.segments.find(s => s.segmentType === 'combo' || s.segmentType === 'doubleend');
      if (bagSeg) {
        expect(bagSeg.name).toBe('Heavy Bag');
        expect(bagSeg.segmentType).toBe('combo');
      }
    }
  });

  it('Edge 8: All equipment, primary=double_end', () => {
    const eq: UserEquipmentConfig = {
      gloves: true, wraps: true, heavyBag: true, doubleEndBag: true,
      speedBag: true, jumpRope: true, treadmill: true, primaryBag: 'double_end',
    };
    const workout = generateLoadoutWorkout('pro', eq);
    expect(workout.phases[0].segments[0].name).toBe('Jump Rope');
    const cooldown = workout.phases.find(p => p.name === 'Cooldown')!;
    expect(cooldown.segments[0].name).toBe('Treadmill');
    // Bag segments should be Double End Bag
    const roundPhases = workout.phases.filter(p => p.section === 'grind' && p.name !== 'Conditioning');
    for (const phase of roundPhases) {
      const bagSeg = phase.segments.find(s => s.segmentType === 'combo' || s.segmentType === 'doubleend');
      if (bagSeg) {
        expect(bagSeg.name).toBe('Double End Bag');
        expect(bagSeg.segmentType).toBe('doubleend');
      }
    }
  });
});
