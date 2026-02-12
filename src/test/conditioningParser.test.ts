import { describe, it, expect } from 'vitest';
import { parseWorkoutInput, parsedResultToWorkout } from '@/lib/aiWorkoutParser';

describe('Conditioning/Bodyweight Exercise Library Parsing', () => {
  it('should parse conditioning block with per-round exercises into exercise library', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest. First round jump rope. Second round dynamic stretches.

2 rounds conditioning, 1 min 30 sec each, 45 sec rest. Round 1: mountain climbers and squat jumps. Round 2: push-ups and plank.`;
    const result = parseWorkoutInput(prompt);
    
    // Find the conditioning phase
    const condPhase = result.phases.find(p => 
      p.name.toLowerCase().includes('conditioning') || p.name.toLowerCase().includes('cardio')
    );
    expect(condPhase).toBeDefined();
    
    // Should have 2 repeats (2 exercise sets)
    expect(condPhase!.repeats).toBe(2);
    
    // Should have exercise sets in combos
    expect(condPhase!.combos).toBeDefined();
    expect(condPhase!.combos!.length).toBe(2);
    expect(condPhase!.combos![0][0]).toContain('Mountain Climbers');
    expect(condPhase!.combos![0][0]).toContain('Squat Jumps');
    expect(condPhase!.combos![1][0]).toContain('Push-Ups');
    expect(condPhase!.combos![1][0]).toContain('Plank');
    
    // Should have sequential order
    expect(condPhase!.comboOrder).toBe('sequential');
    
    // Should only have one active segment (not flat stacked)
    const activeSegments = condPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(1);
    
    // Duration should be 90s
    expect(activeSegments[0].duration).toBe(90);
    
    // Should have rest segment at 45s
    const restSegment = condPhase!.segments.find(s => s.type === 'rest');
    expect(restSegment).toBeDefined();
    expect(restSegment!.duration).toBe(45);
  });

  it('should pass exercise sets through to WorkoutPhase via parsedResultToWorkout', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest.

2 rounds conditioning, 1 min 30 sec each, 45 sec rest. Round 1: mountain climbers and squat jumps. Round 2: push-ups and plank.`;
    const result = parseWorkoutInput(prompt);
    const workout = parsedResultToWorkout(result);
    
    const condPhase = [...workout.sections.grind].find(p => 
      p.combos && p.combos.length > 0 && p.segments.every(s => s.segmentType !== 'combo' && s.segmentType !== 'speedbag')
    );
    expect(condPhase).toBeDefined();
    expect(condPhase!.combos).toBeDefined();
    expect(condPhase!.combos!.length).toBe(2);
    expect(condPhase!.comboOrder).toBe('sequential');
  });

  it('should NOT show superset badge for conditioning phases with exercise library', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest.

2 rounds conditioning, 1 min 30 sec each, 45 sec rest. Round 1: mountain climbers and squat jumps. Round 2: push-ups and plank.`;
    const result = parseWorkoutInput(prompt);
    
    const condPhase = result.phases.find(p => p.combos && p.combos.length > 0 &&
      !p.segments.some(s => s.segmentType === 'combo' || s.segmentType === 'speedbag'));
    expect(condPhase).toBeDefined();
    
    // Should have only ONE active segment (not 2+, which would trigger superset)
    const activeSegments = condPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(1);
  });

  it('should handle 4 rounds of conditioning with 4 exercise sets', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest.

4 rounds conditioning, 1 min each, 30 sec rest. Round 1: burpees. Round 2: squat jumps. Round 3: push-ups. Round 4: mountain climbers.`;
    const result = parseWorkoutInput(prompt);
    
    const condPhase = result.phases.find(p => p.section === 'grind' && p.combos && p.combos.length > 0 &&
      !p.segments.some(s => s.segmentType === 'combo' || s.segmentType === 'speedbag'));
    expect(condPhase).toBeDefined();
    expect(condPhase!.repeats).toBe(4);
    expect(condPhase!.combos!.length).toBe(4);
  });

  it('should coexist with heavy bag combos and speed bag drills', () => {
    const prompt = `5 rounds heavy bag work, 3 minutes each, 1 minute rest. Round 1: 1-2. Round 2: 1-2-3-2. Round 3: 1-1-2-5-2. Round 4: 6-3-2-1-2. Round 5: 1-2-3-6-3-2.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: fist rolls.

2 rounds conditioning, 1 min 30 sec each, 45 sec rest. Round 1: mountain climbers and squat jumps. Round 2: push-ups and plank.`;
    const result = parseWorkoutInput(prompt);
    
    // Heavy bag phase should have combos
    const heavyPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'combo')
    );
    expect(heavyPhase).toBeDefined();
    expect(heavyPhase!.combos!.length).toBe(5);
    
    // Speed bag phase should have drills
    const sbPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'speedbag')
    );
    expect(sbPhase).toBeDefined();
    expect(sbPhase!.combos!.length).toBe(2);
    
    // Conditioning phase should have exercise sets
    const condPhase = result.phases.find(p => 
      p.combos && p.combos.length > 0 && 
      !p.segments.some(s => s.segmentType === 'combo' || s.segmentType === 'speedbag')
    );
    expect(condPhase).toBeDefined();
    expect(condPhase!.combos!.length).toBe(2);
  });
});
