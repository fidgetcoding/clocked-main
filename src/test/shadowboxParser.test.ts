import { describe, it, expect } from 'vitest';
import { parseWorkoutInput, parsedResultToWorkout } from '@/lib/aiWorkoutParser';

describe('Shadowboxing + Superset + Warmup/Cooldown Parsing', () => {
  it('Bug #1: should parse shadowboxing with word combos correctly (multi-block)', () => {
    const prompt = `1 round warm up, 3 minutes, no rest. Dynamic stretches.

3 rounds shadowboxing, 2 minutes each, 30 sec rest. Round 1: jab cross hook. Round 2: double jab cross uppercut. Round 3: 1-2-3-6-3-2.`;
    const result = parseWorkoutInput(prompt);
    
    // Should have a shadowboxing phase
    const shadowPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'shadowboxing')
    );
    expect(shadowPhase).toBeDefined();
    
    // S badge, not E
    const activeSegment = shadowPhase!.segments.find(s => s.type === 'active');
    expect(activeSegment!.segmentType).toBe('shadowboxing');
    
    // ×3 repeats
    expect(shadowPhase!.repeats).toBe(3);
    
    // 3 combos parsed
    expect(shadowPhase!.combos).toBeDefined();
    expect(shadowPhase!.combos!.length).toBe(3);
    
    // Round 1: jab cross hook → 1-2-3
    expect(shadowPhase!.combos![0]).toEqual(['1', '2', '3']);
    
    // Round 2: double jab cross uppercut → 1-1-2-5
    expect(shadowPhase!.combos![1]).toEqual(['1', '1', '2', '5']);
    
    // Round 3: 1-2-3-6-3-2
    expect(shadowPhase!.combos![2]).toEqual(['1', '2', '3', '6', '3', '2']);
    
    // Should be a single segment, not split into multiple
    const activeSegments = shadowPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(1);
  });

  it('Bug #2: should parse superset with per-round combos routed to phase (multi-block)', () => {
    const prompt = `1 round warm up, 3 minutes, no rest. Dynamic stretches.

3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest between rounds. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-1-2-3-2.`;
    const result = parseWorkoutInput(prompt);
    
    // Should have a superset phase with 2+ active segments
    const supersetPhase = result.phases.find(p => 
      p.segments.filter(s => s.type === 'active').length >= 2 && p.section === 'grind'
    );
    expect(supersetPhase).toBeDefined();
    
    // Phase name should NOT contain "Round 1:" text
    expect(supersetPhase!.name).not.toContain('Round 1');
    expect(supersetPhase!.name).toContain('Heavy Bag');
    expect(supersetPhase!.name).toContain('Burpees');
    
    // H segment should exist
    const hSegment = supersetPhase!.segments.find(s => s.segmentType === 'combo');
    expect(hSegment).toBeDefined();
    expect(hSegment!.name).toBe('Heavy Bag');
    
    // E segment name should be clean "Burpees"
    const eSegment = supersetPhase!.segments.find(s => s.segmentType === 'exercise');
    expect(eSegment).toBeDefined();
    expect(eSegment!.name).toBe('Burpees');
    expect(eSegment!.name).not.toContain('Round');
    
    // Combos should be on the phase
    expect(supersetPhase!.combos).toBeDefined();
    expect(supersetPhase!.combos!.length).toBe(3);
    expect(supersetPhase!.combos![0]).toEqual(['1', '2']);
    expect(supersetPhase!.combos![1]).toEqual(['1', '2', '3']);
    expect(supersetPhase!.combos![2]).toEqual(['1', '1', '2', '3', '2']);
    
    // ×3 repeats
    expect(supersetPhase!.repeats).toBe(3);
  });

  it('Bug #3: should preserve "Dynamic Stretches" in warmup block', () => {
    const prompt = `1 round warm up, 3 minutes, no rest. Dynamic stretches.

3 rounds shadowboxing, 2 minutes each, 30 sec rest.`;
    const result = parseWorkoutInput(prompt);
    
    const warmupPhase = result.phases.find(p => p.section === 'warmup');
    expect(warmupPhase).toBeDefined();
    expect(warmupPhase!.name).toBe('Dynamic Stretches');
  });

  it('Bug #4: should recognize "Foam Rolling" in cooldown block', () => {
    const prompt = `3 rounds shadowboxing, 2 minutes each, 30 sec rest.

1 round cool down, 3 minutes, no rest. Foam rolling.`;
    const result = parseWorkoutInput(prompt);
    
    const cooldownPhase = result.phases.find(p => p.section === 'cooldown');
    expect(cooldownPhase).toBeDefined();
    expect(cooldownPhase!.name).toBe('Foam Rolling');
  });

  it('Full prompt: all 6 blocks parse correctly together', () => {
    const prompt = `1 round warm up, 3 minutes, no rest. Dynamic stretches.

3 rounds shadowboxing, 2 minutes each, 30 sec rest. Round 1: jab cross hook. Round 2: double jab cross uppercut. Round 3: 1-2-3-6-3-2.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: side to side. Round 2: backfists.

3 rounds superset: heavy bag 2 minutes and burpees 1 minute. 45 sec rest between rounds. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-1-2-3-2.

3 rounds conditioning, 45 seconds each, 20 sec rest. Round 1: plank. Round 2: jumping lunges. Round 3: squat jumps.

1 round cool down, 3 minutes, no rest. Foam rolling.`;
    
    const result = parseWorkoutInput(prompt);
    
    // Should have 6 phases
    expect(result.phases.length).toBe(6);
    
    // Phase 1: warmup — Dynamic Stretches
    expect(result.phases[0].section).toBe('warmup');
    expect(result.phases[0].name).toBe('Dynamic Stretches');
    
    // Phase 2: shadowboxing with S badge
    const shadowPhase = result.phases[1];
    expect(shadowPhase.segments.find(s => s.type === 'active')!.segmentType).toBe('shadowboxing');
    expect(shadowPhase.repeats).toBe(3);
    expect(shadowPhase.combos!.length).toBe(3);
    
    // Phase 3: speed bag
    const sbPhase = result.phases[2];
    expect(sbPhase.segments.find(s => s.type === 'active')!.segmentType).toBe('speedbag');
    expect(sbPhase.repeats).toBe(2);
    
    // Phase 4: superset with combos
    const supersetPhase = result.phases[3];
    expect(supersetPhase.segments.filter(s => s.type === 'active').length).toBeGreaterThanOrEqual(2);
    expect(supersetPhase.combos!.length).toBe(3);
    expect(supersetPhase.name).not.toContain('Round 1');
    
    // Phase 5: conditioning
    const condPhase = result.phases[4];
    expect(condPhase.repeats).toBe(3);
    expect(condPhase.combos!.length).toBe(3);
    
    // Phase 6: cooldown — Foam Rolling
    expect(result.phases[5].section).toBe('cooldown');
    expect(result.phases[5].name).toBe('Foam Rolling');
  });
});
