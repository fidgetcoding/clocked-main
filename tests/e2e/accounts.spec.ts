// A real browser, the real auth server, and the real email: the link is clicked in the mail catcher.
import { expect, test } from "@playwright/test";
import {
  APP_URL,
  clickNewestEmailLink,
  finishAccountOnboarding,
  finishGuestOnboarding,
  readStore,
  requestSignInEmail,
  service,
  userIdFor,
} from "./helpers";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);

test("a guest signs up by email link and uses every account feature", async ({ page }) => {
  const stamp = Date.now();
  const email = `fighter-${stamp}@example.com`;
  const rivalName = `Rival ${stamp}`;

  const { data: rival, error } = await service.auth.admin.createUser({ email: `rival-${stamp}@example.com`, password: `throwaway-${stamp}`, email_confirm: true });
  if (error || !rival.user) throw error ?? new Error("No rival");
  await service.from("profiles").update({ name: rivalName, handle: `rival${stamp}` }).eq("user_id", rival.user.id);
  await service.from("community_posts").insert({ user_id: rival.user.id, type: "preset_shared", destination: "feed", message: `Shared by ${rivalName}` });

  await test.step("start as a guest, with nothing on the server", async () => {
    await finishGuestOnboarding(page, APP_URL, "Guest Before Link");
    const store = await readStore(page);
    expect(store).toMatchObject({ signedIn: false, name: "Guest Before Link", isGuest: true });
  });

  let usedLink = "";
  await test.step("click the real email link and land on the role step", async () => {
    await requestSignInEmail(page, APP_URL, email);
    usedLink = await clickNewestEmailLink(page, email);
    await finishAccountOnboarding(page, "Real Fighter");
    expect(await readStore(page)).toMatchObject({ signedIn: true, name: "Real Fighter" });
  });

  const userId = await userIdFor(email);

  await test.step("the profile reached the database", async () => {
    await expect
      .poll(async () => (await service.from("profiles").select("name").eq("user_id", userId).single()).data?.name)
      .toBe("Real Fighter");
  });

  await test.step("the feed shows another fighter's post with their name", async () => {
    await page.goto(`${APP_URL}/fight-club`);
    await page.getByText(rivalName).first().waitFor();
  });

  await test.step("search finds that fighter", async () => {
    await page.locator("button:has(svg.lucide-user-plus)").first().click();
    await page.getByPlaceholder(/search/i).first().fill("rival");
    await expect(page.locator("body")).toContainText(rivalName);
  });

  await test.step("join a club", async () => {
    await page.goto(`${APP_URL}/fight-club`);
    await page.getByRole("button", { name: "Clubs" }).click();
    await page.getByRole("button", { name: "Join" }).first().click();
    await page.getByText(/Joined/).first().waitFor();
    await expect
      .poll(async () => (await service.from("club_members").select("*", { count: "exact", head: true }).eq("user_id", userId)).count)
      .toBe(1);
  });

  await test.step("rate a preset", async () => {
    await page.getByRole("button", { name: "Presets" }).click();
    await page.getByText("Pro Loadout").first().click();
    await page.getByRole("button", { name: "Rate this Workout" }).click();
    await page.locator('p:text("Rate this workout") + div button').nth(4).click();
    await page.getByText("Rated 5 stars!").first().waitFor();
    const { data } = await service.from("workout_ratings").select("rating").eq("user_id", userId);
    expect(data).toEqual([{ rating: 5 }]);
  });

  await test.step("log a past workout and see it after a reload", async () => {
    await page.goto(`${APP_URL}/history`);
    await page.getByRole("button", { name: "Log Workout" }).first().click();
    await page.getByPlaceholder("e.g., Heavy Bag Session").fill("Logged By Hand");
    await page.getByRole("button", { name: "Log Workout" }).last().click();
    await page.getByRole("heading", { name: "Log Past Workout" }).waitFor({ state: "hidden" });
    await page.reload();
    await page.getByText("Logged By Hand").first().waitFor();
  });

  await test.step("upload a profile photo to real storage", async () => {
    await page.goto(`${APP_URL}/edit-profile`);
    await page.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
    await page.getByText("Profile photo updated!").first().waitFor();
    const { data } = await service.storage.from("avatars").list(userId);
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  await test.step("the AI builder goes through the real function to the fake provider", async () => {
    await page.goto(`${APP_URL}/build`);
    await page.getByRole("button", { name: "AI Builder" }).click();
    await page.getByRole("button", { name: "5 round heavy bag boxing" }).click();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByRole("textbox", { name: "Workout Name" })).toHaveValue("Fake AI Heavy Bag");
  });

  await test.step("signing out brings the guest back", async () => {
    await page.goto(`${APP_URL}/settings`);
    await page.getByRole("button", { name: "Sign Out" }).click();
    await page.getByText("Your Sets").waitFor();
    await expect.poll(() => readStore(page)).toMatchObject({ signedIn: false, name: "Guest Before Link", isGuest: true });
  });

  await test.step("a used link is refused with a clear message", async () => {
    await page.goto(usedLink);
    await page.waitForURL("**/auth");
    await page.getByText("That sign-in link has expired").first().waitFor();
    expect((await readStore(page)).signedIn).toBe(false);
  });

  await test.step("a returning account skips onboarding and keeps its data", async () => {
    await page.waitForTimeout(5500); // the auth server's minimum gap between emails to one address
    await requestSignInEmail(page, APP_URL, email);
    await clickNewestEmailLink(page, email);
    await page.waitForURL(`${APP_URL}/`);
    await page.getByText("Your Sets").waitFor();
    await expect(page.getByText("Who are you?")).toHaveCount(0);
    expect(await readStore(page)).toMatchObject({ signedIn: true, name: "Real Fighter" });
  });
});

test("a link for another browser cannot be replayed once it has been used", async ({ page, browser }) => {
  const email = `onetime-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  const link = await clickNewestEmailLink(page, email);
  await page.getByText("Who are you?").waitFor();

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.goto(link);
  await otherPage.waitForURL("**/auth");
  await otherPage.getByText("That sign-in link has expired").first().waitFor();
  await otherContext.close();
});
