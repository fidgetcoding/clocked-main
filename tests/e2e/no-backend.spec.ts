// The build with no Supabase settings at all, which is what a stranger gets on a fresh clone.
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL, readStore, trainAndFinish } from "./helpers";

test("every glove on the gloves page shows real art", async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Art Check");
  await page.goto(`${NO_BACKEND_URL}/gloves`);
  const art = page.locator('img[src*="/art/gloves/"]');
  await expect(art.first()).toBeVisible();
  expect(await art.count()).toBeGreaterThanOrEqual(52);

  for (const image of await art.all()) await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => art.evaluateAll((images) => images.filter((image) => !(image as HTMLImageElement).naturalWidth).length))
    .toBe(0);
});

test("a fresh clone runs as a guest, gates rewards, and never calls a backend", async ({ page }) => {
  const backendCalls: string[] = [];
  page.on("request", (request) => {
    if (/supabase|\/rest\/v1\/|\/auth\/v1\/|\/functions\/v1\//.test(request.url())) backendCalls.push(request.url());
  });
  await page.clock.install();

  await finishGuestOnboarding(page, NO_BACKEND_URL, "Local Only");
  expect(await readStore(page)).toMatchObject({ signedIn: false, name: "Local Only", isGuest: true });

  await trainAndFinish(page, 5);
  await expect(page.getByText("Train for at least 5 minutes to earn badges and keep your streak going.")).toBeVisible();
  await expect(page.getByText(/Badge XP/)).toHaveCount(0);

  await page.goto(`${NO_BACKEND_URL}/auth`);
  await page.getByRole("heading", { name: "NO BACKEND CONFIGURED" }).waitFor();

  expect(backendCalls).toEqual([]);
});

test("live training and coach tools say coming soon instead of pretending", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await test.step("the feed labels live training and offers nothing to watch", async () => {
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Placeholder Check");
    await page.goto(`${NO_BACKEND_URL}/fight-club`);
    const card = page.getByTestId("live-training-placeholder");
    await expect(card).toContainText("Coming soon");
    await expect(page.getByRole("button", { name: "Watch" })).toHaveCount(0);
    await expect(page.getByText("LIVE", { exact: true })).toHaveCount(0);
  });

  await test.step("the preview says it's a preview, with no viewers or chat to mistake for real", async () => {
    await page.getByRole("button", { name: "See the preview" }).click();
    const preview = page.getByTestId("live-stream-preview");
    await expect(preview).toContainText("Nothing is streaming and nobody is watching.");
    await expect(preview.getByRole("textbox")).toHaveCount(0);
    await expect(preview.getByText("Live Chat")).toHaveCount(0);
    await expect(preview.getByRole("button")).toHaveText(["Close"]);
    await preview.getByRole("button", { name: "Close" }).click();
    await expect(preview).toHaveCount(0);
  });

  await test.step("coach sign-up promises nothing and asks for nothing it can't save", async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${NO_BACKEND_URL}/onboarding`);
    await page.getByRole("button", { name: "GET STARTED" }).click();
    await expect(page.getByRole("button", { name: /I'M A COACH/ })).toContainText("Coach tools are coming soon");
    await page.getByText("I'M A COACH").click();
    await page.getByPlaceholder("Your name").fill("Placeholder Coach");

    const next = page.getByRole("button", { name: "Continue" });
    await next.click();
    await next.click();
    await page.getByRole("heading", { name: "Coach Tools Are Coming" }).waitFor();
    await expect(page.getByPlaceholder("e.g. Iron Fist Boxing")).toHaveCount(0);

    await next.click();
    await next.click();
    await expect(page.getByText("Your Fight Club is ready")).toHaveCount(0);
    await page.getByRole("button", { name: "LET'S WORK" }).click();
    await page.getByText("Your Sets").waitFor();
  });

  expect(pageErrors).toEqual([]);
});
