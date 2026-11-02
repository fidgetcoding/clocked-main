// The workout screen has to fit on the phones people actually hold. Needs only a served build of the app.
import { expect, test } from "./silent";
import { playButton, pauseButton, skipButton } from "./controls";

const base = process.env.STACK_NO_BACKEND_URL as string;

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 390, height: 844 },
  { width: 1280, height: 720 },
  { width: 1440, height: 800 },
]) {
  test(`the timer buttons stay clear of the combo card at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/onboarding`);
    await page.getByRole("button", { name: "GET STARTED" }).click();
    await page.getByText("I'M A FIGHTER").click();
    await page.getByPlaceholder("Your name").fill("Short Screen");
    const start = page.getByRole("button", { name: "START TRAINING" });
    while (!(await start.isVisible())) await page.getByRole("button", { name: "Continue" }).click();
    await start.click();
    await page.getByText("Your Sets").waitFor();

    await playButton(page).click();
    await page.waitForURL("**/workout/**");
    await playButton(page).click();
    const combo = page.getByText("INCOMING COMBO");
    const skip = skipButton(page);
    for (let i = 0; i < 60 && !(await combo.isVisible()); i++) await skip.click();
    await expect(combo).toBeVisible();
    // The combo card slides in, so measure where it lands rather than where it is mid-slide.
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));

    const adjust = await page.getByRole("button", { name: "+30s" }).boundingBox();
    const card = await combo.locator("..").boundingBox();
    const play = await pauseButton(page).boundingBox();
    expect(adjust!.y + adjust!.height).toBeLessThanOrEqual(card!.y);
    expect(card!.y + card!.height).toBeLessThanOrEqual(play!.y);
    expect(play!.y + play!.height).toBeLessThanOrEqual(viewport.height);
  });
}
