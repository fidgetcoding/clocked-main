import { test, expect } from './silent';
import { finishGuestOnboarding, NO_BACKEND_URL } from './helpers';
import { pauseButton, playButton, skipButton } from './controls';
import type { SessionSnapshot } from '../../src/lib/sessionRecovery';

for (const scenario of [
  { name: 'across segments', elapsed: 25_000, skipPrep: true, trained: 25 },
  { name: 'beyond the workout end', elapsed: 300_000, skipPrep: true, trained: 50 },
  { name: 'across preparation', elapsed: 55_000, skipPrep: false, trained: 25 },
]) {
test(`a delayed tick matches regular training and XP ${scenario.name}`, async ({ browser }) => {
  const results: SessionSnapshot[] = [];
  for (const mode of ['runFor', 'fastForward'] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await finishGuestOnboarding(page, NO_BACKEND_URL, 'Clock check');
      const id = await page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem('get-clocked-workouts')!);
        const workout = stored.state.guestWorkouts[0];
        workout.phases = [{ id: 'clock-round', name: 'Clock round', section: 'grind', repeats: 1, segments: [
          { id: 'push', name: 'Pushups', type: 'active', segmentType: 'exercise', duration: 10 },
          { id: 'rest', name: 'Rest', type: 'rest', segmentType: 'rest', duration: 10 },
          { id: 'burpees', name: 'Burpees', type: 'active', segmentType: 'exercise', duration: 30 },
        ] }];
        localStorage.setItem('get-clocked-workouts', JSON.stringify(stored));
        return workout.id;
      });
      await page.goto(`${NO_BACKEND_URL}/workout/${id}`);
      await page.getByTestId('run-stage').waitFor();
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      await playButton(page).click();
      await pauseButton(page).waitFor();
      if (scenario.skipPrep) await skipButton(page).click();
      await page.clock[mode](scenario.elapsed);
      const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('get-clocked-session')!) as SessionSnapshot);
      // A long tick crosses segments one render at a time; compare only the settled position.
      await expect.poll(async () => {
        const snapshot = await read();
        return snapshot?.isComplete || (snapshot?.timeRemaining ?? 0) > 0 ? snapshot?.totalElapsed : 'settling';
      }).toBe(scenario.trained);
      results.push(await read());
    } finally {
      await context.close();
    }
  }
  expect(results[1].segmentIndex).toBe(results[0].segmentIndex);
  expect(results[1].timeRemaining).toBe(results[0].timeRemaining);
  expect(results[1].log).toEqual(results[0].log);
  expect(results[1].timerXP).toBeCloseTo(results[0].timerXP, 5);
});
}
