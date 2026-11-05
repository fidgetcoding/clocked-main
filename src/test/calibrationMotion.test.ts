import { expect, it } from 'vitest';
import { PunchDetector } from '@/lib/punch/detector';
import { calibrationMotion } from './calibrationMotion';

it('keeps the synthetic uppercut legible across browser frame rates and sampling offsets', () => {
  const frames = calibrationMotion({ hand: 'lead', shape: 'uppercut' });
  for (const fps of [24, 25, 30, 60]) for (const offset of [0, 5, 10, 15, 20, 25, 30]) {
    const detector = new PunchDetector('orthodox');
    const seen: string[] = [];
    for (let t = 0; t < 3000; t += 1000 / fps) {
      const time = t < 1500 ? 0 : t - 1500 + offset;
      const landmarks = frames[Math.min(frames.length - 1, Math.floor(time / (1000 / 30)))].landmarks;
      for (const event of detector.push({ t, landmarks })) if (event.type === 'punch') seen.push(event.punch);
    }
    expect(seen, `${fps} fps, offset ${offset} ms`).toContain('lead_uppercut');
  }
});
