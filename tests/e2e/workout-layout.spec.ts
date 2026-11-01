// The workout screen has to fit on the phones people actually hold. Needs only a served build of the app.
import { expect, test } from "./silent";

const base = process.env.STACK_NO_BACKEND_URL as string;

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 390, height: 844 },
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

    await page.locator("button:has(svg.lucide-play)").first().click();
    await page.waitForURL("**/workout/**");
    await page.locator("button:has(svg.lucide-play)").first().click();
    const combo = page.getByText("INCOMING COMBO");
    const skip = page.locator("button:has(svg.lucide-skip-forward)");
    for (let i = 0; i < 60 && !(await combo.isVisible()); i++) await skip.click();
    await expect(combo).toBeVisible();

    const adjust = await page.getByRole("button", { name: "+30s" }).boundingBox();
    const card = await combo.locator("..").boundingBox();
    const play = await page.locator("button:has(svg.lucide-pause)").boundingBox();
    expect(adjust!.y + adjust!.height).toBeLessThanOrEqual(card!.y);
    expect(card!.y + card!.height).toBeLessThanOrEqual(play!.y);
    expect(play!.y + play!.height).toBeLessThanOrEqual(viewport.height);
  });
}
