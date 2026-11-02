// Sign-in that has to hold up in every browser: the email link, a token refresh, two tabs at once,
// and signing out. Firefox used to throw on every page from the sign-in lock between tabs.
import { expect, test } from "./silent";
import { clickNewestEmailLink, finishAccountOnboarding, readStore, requestSignInEmail } from "./helpers";
import { watch } from "./person";

const APP = process.env.STACK_PROD_URL as string;
const HOUR = 60 * 60 * 1000;

const accessToken = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith("sb-") && name.endsWith("-auth-token"));
    return key ? (JSON.parse(localStorage.getItem(key) as string).access_token as string) : null;
  });

test("sign in, two tabs and sign out", async ({ context, page }) => {
  test.setTimeout(150_000);
  const first = watch(page, "auth-first-tab");
  const email = `tabs-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Two Tabs");
  expect(await readStore(page)).toMatchObject({ signedIn: true });

  const secondPage = await context.newPage();
  const second = watch(secondPage, "auth-second-tab");
  await secondPage.goto(`${APP}/profile`);
  await expect(secondPage.getByText("Two Tabs").first()).toBeVisible();

  await test.step("signing out in one tab signs out the other", async () => {
    await page.goto(`${APP}/settings`);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect.poll(() => readStore(page).then((store) => store.signedIn)).toBe(false);
    await secondPage.reload();
    await expect.poll(() => readStore(secondPage).then((store) => store.signedIn)).toBe(false);
  });

  expect([...first.problems, ...second.problems]).toEqual([]);
});

// Its own test, since the clock it fast-forwards stays ahead of the server's for the rest of the page's life
test("an hour later both tabs have refreshed their sign-in and still load their data", async ({ context, page }) => {
  test.setTimeout(150_000);
  await context.clock.install();
  const first = watch(page, "refresh-first-tab");
  const email = `refresh-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Two Tabs");
  const secondPage = await context.newPage();
  const second = watch(secondPage, "refresh-second-tab");
  await secondPage.goto(`${APP}/profile`);
  await expect(secondPage.getByText("Two Tabs").first()).toBeVisible();
  {
    const before = await accessToken(page);
    await context.clock.fastForward(HOUR + 5 * 60 * 1000);
    await expect.poll(() => accessToken(page), { timeout: 30_000 }).not.toBe(before);
    await page.goto(`${APP}/history`);
    await expect(page.getByText("NO HISTORY YET", { exact: false })).toBeVisible();
    await secondPage.reload();
    await expect(secondPage.getByText("Two Tabs").first()).toBeVisible();
  }

  expect([...first.problems, ...second.problems]).toEqual([]);
});
