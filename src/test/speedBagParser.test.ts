import { describe, it, expect } from 'vitest';
import { parseWorkoutInput, parsedResultToWorkout } from '@/lib/aiWorkoutParser';

describe('Speed Bag Drill Parsing', () => {
  it('should parse speed bag block with per-round drills (multi-block)', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest. First round jump rope. Second round dynamic stretches.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: fist rolls.`;
    const result = parseWorkoutInput(prompt);
    
    // Find the speed bag phase
    const speedBagPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'speedbag')
    );
    expect(speedBagPhase).toBeDefined();
    
    // Should have 2 repeats (2 drills)
    expect(speedBagPhase!.repeats).toBe(2);
    
    // Should have SB segment type
    const activeSegment = speedBagPhase!.segments.find(s => s.type === 'active');
    expect(activeSegment).toBeDefined();
    expect(activeSegment!.segmentType).toBe('speedbag');
    expect(activeSegment!.name).toBe('Speed Bag');
    
    // Should have 2 drills in combos
    expect(speedBagPhase!.combos).toBeDefined();
    expect(speedBagPhase!.combos!.length).toBe(2);
    expect(speedBagPhase!.combos![0]).toEqual(['Doubles']);
    expect(speedBagPhase!.combos![1]).toEqual(['Fist Rolls (Forward)']);
    
    // Should have sequential order
    expect(speedBagPhase!.comboOrder).toBe('sequential');
    
    // Duration should be 120s
    expect(activeSegment!.duration).toBe(120);
    
    // Should have rest segment at 30s
    const restSegment = speedBagPhase!.segments.find(s => s.type === 'rest');
    expect(restSegment).toBeDefined();
    expect(restSegment!.duration).toBe(30);
  });
  
  it('should pass drills through to WorkoutPhase via parsedResultToWorkout', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: fist rolls.`;
    const result = parseWorkoutInput(prompt);
    const workout = parsedResultToWorkout(result);
    
    // Find the speed bag phase in grind
    const sbPhase = workout.sections.grind.find(p => 
      p.segments.some(s => s.segmentType === 'speedbag')
    );
    expect(sbPhase).toBeDefined();
    expect(sbPhase!.combos).toBeDefined();
    expect(sbPhase!.combos!.length).toBe(2);
    expect(sbPhase!.comboOrder).toBe('sequential');
  });

  it('should default to freestyle when no drills specified', () => {
    const prompt = `2 round warm up, 90 seconds each, 30 sec rest.

3 rounds speed bag, 2 minutes each, 30 sec rest.`;
    const result = parseWorkoutInput(prompt);
    
    const speedBagPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'speedbag')
    );
    expect(speedBagPhase).toBeDefined();
    
    const activeSegment = speedBagPhase!.segments.find(s => s.type === 'active');
    expect(activeSegment!.segmentType).toBe('speedbag');
    
    // No drills = no combos
    expect(speedBagPhase!.combos).toBeUndefined();
    // Rounds should be 3
    expect(speedBagPhase!.repeats).toBe(3);
  });
  
  it('should handle heavy bag combos alongside speed bag drills in full prompt', () => {
    const prompt = `5 rounds heavy bag work, 3 minutes each, 1 minute rest. Round 1: 1-2. Round 2: 1-2-3-2. Round 3: 1-1-2-5-2. Round 4: 6-3-2-1-2. Round 5: 1-2-3-6-3-2.

2 rounds speed bag, 2 minutes each, 30 sec rest. Round 1: doubles. Round 2: fist rolls.`;
    const result = parseWorkoutInput(prompt);
    
    // Heavy bag phase should have combos
    const heavyPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'combo')
    );
    expect(heavyPhase).toBeDefined();
    expect(heavyPhase!.combos).toBeDefined();
    expect(heavyPhase!.combos!.length).toBe(5);
    
    // Speed bag phase should have drills
    const sbPhase = result.phases.find(p => 
      p.segments.some(s => s.segmentType === 'speedbag')
    );
    expect(sbPhase).toBeDefined();
    expect(sbPhase!.combos).toBeDefined();
    expect(sbPhase!.combos!.length).toBe(2);
  });
});
