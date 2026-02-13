import { describe, it, expect } from 'vitest';
import { parseWorkoutInput } from '@/lib/aiWorkoutParser';

const TEST_PROMPT = `1 round warm up, 2 minutes, no rest. Light jogging.

3 rounds double end bag, 2 minutes each, 30 sec rest. Round 1: 1-2. Round 2: 1-2-3. Round 3: 1-2-5-2.

4 rounds shadowboxing, 1 min 30 sec each, 30 sec rest. Round 1: jab cross. Round 2: jab jab cross hook. Round 3: cross hook uppercut. Round 4: 1-2-3-2-1.

2 rounds superset: speed bag 2 minutes and push-ups 45 sec. 30 sec rest between rounds. Round 1: doubles. Round 2: triples.

3 rounds conditioning, 1 minute each, 15 sec rest. Round 1: box jumps. Round 2: battle ropes. Round 3: kettlebell swings.

1 round cool down, 3 minutes, no rest. Deep breathing.`;

describe('Bug Report #3 - Full prompt test', () => {
  const result = parseWorkoutInput(TEST_PROMPT);

  it('BUG #1: Double End Bag should have DB badge (doubleend segmentType)', () => {
    const dePhase = result.phases.find(p => p.name.toLowerCase().includes('double end'));
    expect(dePhase).toBeDefined();
    expect(dePhase!.repeats).toBe(3);
    
    const activeSegment = dePhase!.segments.find(s => s.type === 'active');
    expect(activeSegment).toBeDefined();
    expect(activeSegment!.segmentType).toBe('doubleend');
    
    expect(dePhase!.combos).toBeDefined();
    expect(dePhase!.combos!.length).toBe(3);
  });

  it('BUG #2: Superset speed bag drills should be parsed', () => {
    const ssPhase = result.phases.find(p => p.name.toLowerCase().includes('superset'));
    expect(ssPhase).toBeDefined();
    expect(ssPhase!.repeats).toBe(2);
    
    // Should have SB + E segments
    const activeSegments = ssPhase!.segments.filter(s => s.type === 'active');
    expect(activeSegments.length).toBe(2);
    expect(activeSegments.some(s => s.segmentType === 'speedbag')).toBe(true);
    expect(activeSegments.some(s => s.segmentType === 'exercise')).toBe(true);
    
    // DRILLS should be populated
    expect(ssPhase!.combos).toBeDefined();
    expect(ssPhase!.combos!.length).toBe(2);
  });

  it('BUG #3: Conditioning exercises should be parsed', () => {
    const condPhase = result.phases.find(p => 
      p.section === 'grind' && 
      p.segments.some(s => s.segmentType === 'exercise') &&
      !p.name.toLowerCase().includes('superset')
    );
    expect(condPhase).toBeDefined();
    expect(condPhase!.repeats).toBe(3);
    
    expect(condPhase!.combos).toBeDefined();
    expect(condPhase!.combos!.length).toBe(3);
  });
});
