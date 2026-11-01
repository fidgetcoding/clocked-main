import { createClient } from "@supabase/supabase-js";
import { expect, Page } from "@playwright/test";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Run these through npm run test:stack.`);
  return value;
}

export const APP_URL = required("STACK_APP_URL");
export const NO_BACKEND_URL = required("STACK_NO_BACKEND_URL");
const MAIL_URL = required("STACK_MAIL_URL");

export const service = createClient(required("STACK_API_URL"), required("STACK_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface MailSummary {
  ID: string;
}

const messagesTo = async (page: Page, email: string): Promise<MailSummary[]> => {
  const response = await page.request.get(`${MAIL_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  return (await response.json()).messages ?? [];
};

/** Fill in the sign-in form and wait until the mail catcher has received one more email. */
export async function requestSignInEmail(page: Page, base: string, email: string): Promise<void> {
  const before = (await messagesTo(page, email)).length;
  await page.goto(`${base}/auth`);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByRole("button", { name: "EMAIL ME A LINK" }).click();
  await page.getByRole("heading", { name: "CHECK YOUR EMAIL" }).waitFor();
  await expect.poll(async () => (await messagesTo(page, email)).length, { timeout: 15_000 }).toBeGreaterThan(before);
}

/** Open the newest email as the mail catcher renders it, and click the link in it, like a person. */
export async function clickNewestEmailLink(page: Page, email: string): Promise<string> {
  const [newest] = await messagesTo(page, email);
  await page.goto(`${MAIL_URL}/view/${newest.ID}.html`);
  const link = page.locator('a[href*="/auth/v1/verify"]').first();
  const href = (await link.getAttribute("href")) as string;
  await link.click();
  return href;
}

/** Walk the remaining onboarding steps, optionally picking something on each one. */
async function walkOnboarding(page: Page, picks: string[] = []): Promise<void> {
  const start = page.getByRole("button", { name: "START TRAINING" });
  const next = page.getByRole("button", { name: "Continue" });
  await expect(start.or(next)).toBeVisible();
  while (!(await start.isVisible())) {
    for (const pick of picks) {
      const option = page.getByText(pick, { exact: true });
      if (await option.isVisible()) await option.click();
    }
    await next.click();
    await expect(start.or(next)).toBeVisible();
  }
  await start.click();
  await page.getByText("Your Sets").waitFor();
}

export async function finishGuestOnboarding(page: Page, base: string, name: string): Promise<void> {
  await page.goto(`${base}/onboarding`);
  await page.getByRole("button", { name: "GET STARTED" }).click();
  await page.getByText("I'M A FIGHTER").click();
  await page.getByPlaceholder("Your name").fill(name);
  await walkOnboarding(page);
}

export async function finishAccountOnboarding(page: Page, name: string): Promise<void> {
  await page.getByText("Who are you?").waitFor();
  await page.getByText("I'M A FIGHTER").click();
  await page.getByPlaceholder("Your name").fill(name);
  await walkOnboarding(page, ["Advanced", "Boxing Gloves"]);
}

export const readStore = (page: Page) =>
  page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("get-clocked-user") || "{}").state || {};
    return {
      signedIn: Object.keys(localStorage).some((key) => key.startsWith("sb-")),
      name: user.user?.name ?? null,
      isGuest: user.userIsGuest,
    };
  });

export async function userIdFor(email: string): Promise<string> {
  const { data, error } = await service.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const match = (data.users as { id: string; email?: string }[]).find((user) => user.email === email);
  if (!match) throw new Error(`No account for ${email}`);
  return match.id;
}

/** Start the first workout on the home screen, leave the timer running, and finish it early. */
export async function trainAndFinish(page: Page, trainingSeconds: number): Promise<void> {
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.waitForURL("**/workout/**");
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.locator("button:has(svg.lucide-pause)").waitFor();
  await page.clock.fastForward(trainingSeconds * 1000);
  await page.getByText(formatElapsed(trainingSeconds)).first().waitFor();
  await page.getByTitle("Complete workout early").click();
  await page.getByText("XP Breakdown").waitFor();
}

const formatElapsed = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
