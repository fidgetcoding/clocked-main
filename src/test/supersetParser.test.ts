import { describe, it, expect } from 'vitest';
import { parseWorkoutInput } from '@/lib/aiWorkoutParser';

describe('Superset parsing', () => {
  it('detects "superset: X and Y" pattern', () => {
    const result = parseWorkoutInput('3 rounds superset: heavy bag freestyle 1 min 30 sec and burpees 45 sec. 1 minute rest between rounds.');
    const grindPhases = result.phases.filter(p => p.section === 'grind');
    expect(grindPhases.length).toBeGreaterThanOrEqual(1);
    
    const supersetPhase = grindPhases.find(p => p.segments.filter(s => s.type === 'active').length >= 2);
    expect(supersetPhase).toBeDefined();
    expect(supersetPhase!.repeats).toBe(3);
    
    const activeSegments = supersetPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(2);
    expect(activeSegments[0].duration).toBe(90);
    expect(activeSegments[1].duration).toBe(45);
  });

  it('detects "X then Y" pattern', () => {
    const result = parseWorkoutInput('4 rounds shadowboxing 2 min then jump rope 1 min. 30 sec rest');
    const grindPhases = result.phases.filter(p => p.section === 'grind');
    const supersetPhase = grindPhases.find(p => p.segments.filter(s => s.type === 'active').length >= 2);
    expect(supersetPhase).toBeDefined();
    expect(supersetPhase!.repeats).toBe(4);
    
    const activeSegments = supersetPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(2);
  });

  it('detects "X and Y back to back" pattern', () => {
    const result = parseWorkoutInput('5 rounds heavy bag 3 min and burpees 30 sec back to back. 1 min rest');
    const grindPhases = result.phases.filter(p => p.section === 'grind');
    const supersetPhase = grindPhases.find(p => p.segments.filter(s => s.type === 'active').length >= 2);
    expect(supersetPhase).toBeDefined();
    expect(supersetPhase!.repeats).toBe(5);
  });

  it('uses independent durations per exercise', () => {
    const result = parseWorkoutInput('3 rounds superset: heavy bag 90 sec and squats 45 sec');
    const grindPhases = result.phases.filter(p => p.section === 'grind');
    const supersetPhase = grindPhases.find(p => p.segments.filter(s => s.type === 'active').length >= 2);
    expect(supersetPhase).toBeDefined();
    
    const activeSegments = supersetPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments[0].duration).toBe(90);
    expect(activeSegments[1].duration).toBe(45);
  });

  it('generates a superset name', () => {
    const result = parseWorkoutInput('3 rounds superset: heavy bag and burpees');
    expect(result.name).toContain('Superset');
  });
});
