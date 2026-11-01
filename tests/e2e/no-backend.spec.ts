// The build with no Supabase settings at all, which is what a stranger gets on a fresh clone.
import { expect, test } from "@playwright/test";
import { finishGuestOnboarding, NO_BACKEND_URL, readStore, trainAndFinish } from "./helpers";

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
