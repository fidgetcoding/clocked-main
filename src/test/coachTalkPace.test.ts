import { expect, it } from 'vitest';
import { appendPunchSample, paceDropped, type PunchSample } from '@/lib/voice/coachTalk';

it('keeps a long round bounded while preserving its pace decisions', () => {
  const retained: PunchSample[] = [];
  const full: PunchSample[] = [];
  let punches = 0;
  let drops = 0;
  for (let at = 0; at < 3600; at++) {
    // Repeated fast stretches followed by pauses exercise both outcomes.
    if (at % 90 < 60) punches += 2;
    const sample = { at, punches };
    full.push(sample);
    appendPunchSample(retained, sample);
    const dropped = paceDropped(retained, at);
    expect(dropped).toBe(paceDropped(full, at));
    if (dropped) drops++;
    expect(retained.length).toBeLessThanOrEqual(17);
    expect(retained[0]).toBe(full[0]);
  }
  expect(drops).toBeGreaterThan(0);
  expect(drops).toBeLessThan(full.length / 2);
});
