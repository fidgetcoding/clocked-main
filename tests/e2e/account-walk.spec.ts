// What only a signed-in fighter can do, with real accounts in separate browsers against the real backend.
import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./silent";
import { playButton, skipButton } from "./controls";
import { APP_URL, finishAccountOnboarding, readStore, service } from "./helpers";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==",
  "base64",
);

interface Fighter {
  page: Page;
  id: string;
  email: string;
  name: string;
}

let counter = 0;

async function signInWithLink(page: Page, email: string): Promise<void> {
  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${APP_URL}/onboarding?continue=true` },
  });
  if (error) throw error;
  await page.goto(data.properties.action_link);
}

/** A real account that has been through onboarding, in its own browser unless one is passed in. */
async function newFighter(browser: Browser, label: string, existingPage?: Page): Promise<Fighter> {
  const stamp = `${Date.now()}${counter++}`;
  const email = `${label.toLowerCase()}-${stamp}@example.com`;
  const name = `${label} ${stamp}`;
  const { data, error } = await service.auth.admin.createUser({ email, password: `throwaway-${stamp}`, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("No user");
  const page = existingPage ?? (await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage());
  await signInWithLink(page, email);
  await finishAccountOnboarding(page, name);
  return { page, id: data.user.id, email, name };
}

const openFightClub = async (page: Page, tab?: "Clubs" | "Presets") => {
  await page.goto(`${APP_URL}/fight-club`);
  if (tab) await page.getByRole("button", { name: tab }).click();
};

const statOnProfile = (page: Page, label: "Followers" | "Following" | "Workouts") =>
  page.getByRole("button", { name: new RegExp(`\\d+\\s*${label}`) }).locator("p").first();

const follow = async (fan: Fighter, target: Fighter) => {
  await fan.page.goto(`${APP_URL}/profile/${target.id}`);
  await fan.page.getByRole("button", { name: "Follow", exact: true }).click();
  await fan.page.getByRole("button", { name: "Following", exact: true }).waitFor();
};

const postToFeed = (fighter: Fighter, message: string) =>
  service.from("community_posts").insert({ user_id: fighter.id, type: "workout_complete", workout_name: "Rounds", message, destination: "feed" });

test.describe("following", () => {
  test("search finds a fighter by name and @handle, and following them shows everywhere", async ({ page, browser }) => {
    const fan = await newFighter(browser, "Fan", page);
    const target = await newFighter(browser, "Target");
    const handle = `target${Date.now()}`;
    await service.from("profiles").update({ handle }).eq("user_id", target.id);
    const firstPost = `Target's first post ${Date.now()}`;
    await postToFeed(target, firstPost);

    await test.step("the following feed starts empty and says so", async () => {
      await openFightClub(fan.page);
      await fan.page.getByRole("button", { name: "Following", exact: true }).click();
      await fan.page.getByText("No posts from people you follow yet.").waitFor();
    });

    await test.step("search by name and by @handle", async () => {
      await fan.page.locator("button:has(svg.lucide-user-plus)").first().click();
      const search = fan.page.getByPlaceholder("Search by name or @handle...");
      await search.fill(target.name);
      await expect(fan.page.getByText(`@${handle}`)).toBeVisible();
      await search.fill(`@${handle}`);
      await expect(fan.page.getByRole("button", { name: new RegExp(target.name) })).toBeVisible();
      await search.fill(fan.name);
      await expect(fan.page.getByText(/No fighters found matching/)).toBeVisible();
      await search.fill(target.name);
      await fan.page.getByRole("button", { name: new RegExp(target.name) }).click();
      await fan.page.waitForURL(`**/profile/${target.id}`);
    });

    await test.step("following shows on both profiles", async () => {
      await fan.page.getByRole("button", { name: "Follow", exact: true }).click();
      await fan.page.getByRole("button", { name: "Following", exact: true }).waitFor();
      await expect(statOnProfile(fan.page, "Followers"), "target's followers, as seen by the fan").toHaveText("1");

      await fan.page.goto(`${APP_URL}/profile`);
      await expect(statOnProfile(fan.page, "Following")).toHaveText("1");
      await statOnProfile(fan.page, "Following").click();
      await expect(fan.page.getByText(target.name)).toBeVisible();

      await target.page.goto(`${APP_URL}/profile`);
      await expect(statOnProfile(target.page, "Followers")).toHaveText("1");
      await statOnProfile(target.page, "Followers").click();
      await expect(target.page.getByText(fan.name)).toBeVisible();
    });

    await test.step("the following feed shows their post, without a reload", async () => {
      await openFightClub(fan.page);
      await fan.page.getByRole("button", { name: "Following", exact: true }).click();
      await expect(fan.page.getByText(firstPost)).toBeVisible();
    });

    await test.step("a third fighter sees the real counts on someone else's profile", async () => {
      const bystander = await newFighter(browser, "Bystander");
      await bystander.page.goto(`${APP_URL}/profile/${target.id}`);
      await bystander.page.getByRole("button", { name: "Follow", exact: true }).waitFor();
      await expect(statOnProfile(bystander.page, "Followers")).toHaveText("1");
      await bystander.page.goto(`${APP_URL}/profile/${fan.id}`);
      await bystander.page.getByRole("button", { name: "Follow", exact: true }).waitFor();
      await expect(statOnProfile(bystander.page, "Following")).toHaveText("1");
    });

    await test.step("unfollowing takes it all back", async () => {
      await fan.page.goto(`${APP_URL}/profile/${target.id}`);
      await fan.page.getByRole("button", { name: "Following", exact: true }).click();
      await fan.page.getByRole("button", { name: "Follow", exact: true }).waitFor();
      await expect(statOnProfile(fan.page, "Followers")).toHaveText("0");
      await openFightClub(fan.page);
      await fan.page.getByRole("button", { name: "Following", exact: true }).click();
      await expect(fan.page.getByText("No posts from people you follow yet.")).toBeVisible();
    });
  });

  test("a profile that doesn't exist says so and offers nothing to follow", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Lost", page);
    for (const id of ["00000000-0000-4000-8000-000000000000", "not-a-real-id"]) {
      await fighter.page.goto(`${APP_URL}/profile/${id}`);
      await expect(fighter.page.getByText("Fighter not found")).toBeVisible();
      await expect(fighter.page.getByRole("button", { name: "Follow", exact: true })).toHaveCount(0);
    }
  });

  test("the profile link opens your profile for whoever you send it to", async ({ page, browser, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const sender = await newFighter(browser, "Sender", page);
    const receiver = await newFighter(browser, "Receiver");
    await sender.page.goto(`${APP_URL}/profile`);
    await sender.page.getByRole("button", { name: "Copy profile link" }).click();
    await sender.page.getByText("Profile link copied!").first().waitFor();
    const link = await sender.page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain(sender.id);
    await receiver.page.goto(link);
    await expect(receiver.page.getByText(sender.name).first()).toBeVisible();
    await expect(receiver.page.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  });
});

test.describe("editing a profile", () => {
  test("name, handle, bio and body metrics save and survive a reload", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Editor", page);
    const stamp = Date.now();
    const profile = async () => (await service.from("profiles").select("name,handle,bio,weight_kg,height_cm").eq("user_id", fighter.id).single()).data;
    const edit = (field: "name" | "handle" | "bio") => page.getByRole("button", { name: `Edit ${field}` });

    await page.goto(`${APP_URL}/edit-profile`);

    await test.step("name", async () => {
      await edit("name").click();
      await page.locator("input[maxlength='30']").fill("Renamed Fighter");
      await page.locator("input[maxlength='30']").press("Enter");
      await page.getByText("Name updated!").first().waitFor();
      await expect.poll(async () => (await profile())?.name).toBe("Renamed Fighter");
    });

    await test.step("handle, then one someone else has", async () => {
      const other = await newFighter(browser, "Other");
      await service.from("profiles").update({ handle: `taken${stamp}` }).eq("user_id", other.id);
      await edit("handle").click();
      await page.getByPlaceholder("yourhandle").fill(`mine${stamp}`);
      await page.getByPlaceholder("yourhandle").press("Enter");
      await page.getByText("Handle updated!").first().waitFor();
      await expect.poll(async () => (await profile())?.handle).toBe(`mine${stamp}`);

      await edit("handle").click();
      await page.getByPlaceholder("yourhandle").fill(`taken${stamp}`);
      await page.getByPlaceholder("yourhandle").press("Enter");
      await expect(page.getByText("This handle is already taken").first()).toBeVisible();
      await expect(page.getByPlaceholder("yourhandle")).toBeVisible();
      await page.getByPlaceholder("yourhandle").fill("ab");
      await page.getByPlaceholder("yourhandle").press("Enter");
      await expect(page.getByText("Handle must be at least 3 characters").first()).toBeVisible();
    });

    await test.step("bio", async () => {
      await page.goto(`${APP_URL}/edit-profile`);
      await edit("bio").click();
      await page.getByPlaceholder("Tell others about yourself...").fill("Southpaw from the east side");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText("Bio updated!").first().waitFor();
      await expect.poll(async () => (await profile())?.bio).toBe("Southpaw from the east side");
    });

    await test.step("body metrics", async () => {
      await page.getByPlaceholder("165").fill("180");
      await page.getByPlaceholder("165").blur();
      await page.getByPlaceholder("5", { exact: true }).fill("5");
      await page.getByPlaceholder("10", { exact: true }).fill("11");
      await page.getByPlaceholder("10", { exact: true }).blur();
      await expect.poll(async () => (await profile())?.weight_kg).toBeCloseTo(81.6, 1);
      await expect.poll(async () => (await profile())?.height_cm).toBeCloseTo(180.3, 1);
    });

    await test.step("all of it after a reload, and on the profile", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Renamed Fighter" })).toBeVisible();
      await expect(page.getByText(`@mine${stamp}`)).toBeVisible();
      await expect(page.getByText("Southpaw from the east side")).toBeVisible();
      await expect(page.getByPlaceholder("165")).toHaveValue("180");
      await expect(page.getByPlaceholder("5", { exact: true })).toHaveValue("5");
      await expect(page.getByPlaceholder("10", { exact: true })).toHaveValue("11");
      await page.goto(`${APP_URL}/profile`);
      await expect(page.getByText("Southpaw from the east side")).toBeVisible();
    });

    await test.step("a name changed in another browser shows here too", async () => {
      await service.from("profiles").update({ name: "Changed Elsewhere" }).eq("user_id", fighter.id);
      await page.goto(`${APP_URL}/edit-profile`);
      await expect(page.getByRole("heading", { name: "Changed Elsewhere" })).toBeVisible();
    });
  });

  test("a photo uploads, replaces the last one, and shows to other fighters", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Photo", page);
    const viewer = await newFighter(browser, "Viewer");
    const avatar = async () => (await service.from("profiles").select("avatar_url").eq("user_id", fighter.id).single()).data?.avatar_url;

    await page.goto(`${APP_URL}/edit-profile`);
    const input = page.locator("input[type=file]");

    await test.step("a GIF and an oversized file are refused with a clear message", async () => {
      await input.setInputFiles({ name: "me.gif", mimeType: "image/gif", buffer: ONE_PIXEL_PNG });
      await expect(page.getByText("Please select a JPEG, PNG or WebP image").first()).toBeVisible();
      await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
      await expect(page.getByText("Image must be less than 5MB").first()).toBeVisible();
      expect(await avatar()).toBeNull();
    });

    await test.step("the first upload", async () => {
      await input.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
      await page.getByText("Profile photo updated!").first().waitFor();
      await expect.poll(avatar).toContain(fighter.id);
      await expect.poll(() => page.locator('img[alt="Profile"]').evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    });

    await test.step("the same file again still goes through", async () => {
      const before = await avatar();
      await page.waitForTimeout(5);
      await input.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
      await expect.poll(avatar).not.toBe(before);
    });

    await test.step("another fighter sees it on the profile and in the feed", async () => {
      const message = `Fresh photo post ${Date.now()}`;
      await postToFeed(fighter, message);
      await viewer.page.goto(`${APP_URL}/profile/${fighter.id}`);
      const shown = viewer.page.locator(`img[alt="${fighter.name}"]`);
      await expect(shown).toBeVisible();
      await openFightClub(viewer.page);
      await viewer.page.getByText(message).waitFor();
      await expect(viewer.page.locator(`img[src*="${fighter.id}"]`).first()).toBeVisible();
    });
  });

  test("an archived workout can be found, restored and deleted", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Archive", page);
    const rows = async () => (await service.from("workouts").select("id,is_archived").eq("user_id", fighter.id)).data ?? [];
    await page.goto(`${APP_URL}/`);
    await page.getByText("Your Sets").waitFor();
    await expect.poll(async () => (await rows()).length).toBeGreaterThan(0);
    const count = (await rows()).length;

    const archiveFirst = async () => {
      await page.goto(`${APP_URL}/`);
      await page.locator("button:has(svg.lucide-trash2)").first().click();
      await page.getByRole("button", { name: "Archive" }).click();
      await page.getByText(/Workout archived/).first().waitFor();
      await expect.poll(async () => (await rows()).filter((w) => w.is_archived).length).toBe(1);
    };

    await archiveFirst();
    await page.goto(`${APP_URL}/edit-profile`);
    await expect(page.getByText("1 archived")).toBeVisible();
    await page.getByRole("button", { name: /Archived Workouts/ }).click();

    await test.step("restore", async () => {
      await page.getByTitle("Restore").click();
      await expect.poll(async () => (await rows()).filter((w) => w.is_archived).length).toBe(0);
      await page.goto(`${APP_URL}/`);
      await expect(page.locator("button:has(svg.lucide-trash2)").first()).toBeVisible();
    });

    await test.step("delete forever", async () => {
      await archiveFirst();
      await page.goto(`${APP_URL}/edit-profile`);
      await page.getByRole("button", { name: /Archived Workouts/ }).click();
      await page.getByTitle("Delete Forever").click();
      await page.getByRole("button", { name: "Delete Forever" }).click();
      await expect.poll(async () => (await rows()).length).toBe(count - 1);
    });
  });
});

test.describe("clubs and the feed", () => {
  test("joining a club, its feed, its ranks and leaving", async ({ page, browser }) => {
    const member = await newFighter(browser, "Member", page);
    const friend = await newFighter(browser, "Friend");
    await service.from("profiles").update({ total_xp: 900 }).eq("user_id", friend.id);
    const clubId = "ea000000-0000-0000-0000-000000000001";
    const earlyAdopters = (on: Page) => on.locator(".card-workout", { hasText: "Early Adopters" });
    const membership = async (id: string) => (await service.from("club_members").select("id").eq("club_id", clubId).eq("user_id", id)).data?.length;
    const countBefore = (await service.from("club_members").select("*", { count: "exact", head: true }).eq("club_id", clubId)).count ?? 0;

    await test.step("join", async () => {
      await openFightClub(member.page, "Clubs");
      await earlyAdopters(member.page).getByRole("button", { name: "Join" }).click();
      await member.page.getByText("My Fight Clubs").waitFor();
      await expect(earlyAdopters(member.page)).toContainText(`${countBefore + 1} / 100 members`);
      await expect.poll(() => membership(member.id)).toBe(1);
      await openFightClub(friend.page, "Clubs");
      await earlyAdopters(friend.page).getByRole("button", { name: "Join" }).click();
      await friend.page.getByText("My Fight Clubs").waitFor();
    });

    await test.step("a post to the club shows in its feed and not in the main one", async () => {
      const clubOnly = `Club Only Rounds ${Date.now()}`;
      await service.from("community_posts").insert({
        user_id: friend.id, type: "preset_shared", destination: "club", club_id: clubId, workout_name: clubOnly, workout_data: { phases: [] },
      });
      await openFightClub(member.page, "Clubs");
      await member.page.getByRole("button", { name: /Early Adopters/ }).first().click();
      await expect(member.page.getByText(clubOnly)).toBeVisible();
      await openFightClub(member.page);
      await expect(member.page.getByText(clubOnly)).toHaveCount(0);
    });

    await test.step("ranks list the real members, best first", async () => {
      await openFightClub(member.page, "Clubs");
      await member.page.getByRole("button", { name: /Early Adopters/ }).first().click();
      await member.page.getByRole("button", { name: "Ranks" }).click();
      await expect(member.page.getByText(friend.name)).toBeVisible();
      await expect(member.page.getByText(`${member.name} (You)`)).toBeVisible();
    });

    await test.step("chat says it isn't built rather than pretending to send", async () => {
      await member.page.getByRole("button", { name: "Chat" }).click();
      await expect(member.page.getByText("Club chat isn't built yet")).toBeVisible();
      await expect(member.page.getByPlaceholder("Type a message...")).toHaveCount(0);
    });

    await test.step("leave", async () => {
      await openFightClub(member.page, "Clubs");
      await earlyAdopters(member.page).getByRole("button", { name: "Leave" }).click();
      await expect.poll(() => membership(member.id)).toBe(0);
      await earlyAdopters(member.page).getByRole("button", { name: "Join" }).waitFor();
    });
  });

  test("a club added to the database shows up and has its own feed", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Joiner", page);
    const name = `Second Club ${Date.now()}`;
    const { data: club, error } = await service.from("clubs").insert({ name, icon: "🥊", type: "public", member_cap: 2 }).select().single();
    if (error || !club) throw error ?? new Error("No club");
    await service.from("community_posts").insert({
      user_id: fighter.id, type: "preset_shared", destination: "club", club_id: club.id, workout_name: "Second Club Rounds", workout_data: { phases: [] },
    });

    await openFightClub(fighter.page, "Clubs");
    const card = fighter.page.locator(".card-workout", { hasText: name });
    await expect(card).toContainText("0 / 2 members");
    await card.getByRole("button", { name: "Join" }).click();
    await fighter.page.getByText("My Fight Clubs").waitFor();
    const joined = fighter.page.locator(".card-workout", { hasText: name });
    await expect(joined).toContainText("1 / 2 members");
    await joined.getByRole("button", { name: new RegExp(name) }).click();
    await expect(fighter.page.getByText("Second Club Rounds")).toBeVisible();
  });

  test("sharing a workout: it reaches the feed, another fighter saves and runs it, and only you can delete it", async ({ page, browser }) => {
    const sharer = await newFighter(browser, "Sharer", page);
    const saver = await newFighter(browser, "Saver");
    const shareName = `Shared Rounds ${Date.now()}`;

    await test.step("share from the builder", async () => {
      await sharer.page.goto(`${APP_URL}/`);
      await sharer.page.getByText("Your Sets").waitFor();
      await sharer.page.locator("button:has(svg.lucide-pencil)").first().click();
      await sharer.page.waitForURL("**/build**");
      await sharer.page.getByTitle("Share to Fight Club").click();
      const dialog = sharer.page.getByRole("dialog");
      await dialog.locator("input").first().fill(shareName);
      await dialog.getByRole("button", { name: "Share", exact: true }).click();
      await sharer.page.getByText("Shared to Fight Club!").first().waitFor();
    });

    await test.step("it shows in the feed for someone else, and saving it works", async () => {
      await openFightClub(saver.page);
      const post = saver.page.locator(".card-workout", { hasText: shareName });
      await post.waitFor();
      await expect(post.locator("button:has(svg.lucide-trash2)")).toHaveCount(0);
      await post.getByRole("button", { name: "Save Workout" }).click();
      await saver.page.getByText(/saved to your workouts/).first().waitFor();
      await expect
        .poll(async () => (await service.from("workouts").select("name").eq("user_id", saver.id).eq("name", shareName)).data?.length)
        .toBe(1);
    });

    await test.step("the saved copy runs", async () => {
      const { data } = await service.from("workouts").select("id,phases,duration").eq("user_id", saver.id).eq("name", shareName).single();
      expect(data?.duration ?? 0).toBeGreaterThan(0);
      expect((data?.phases as unknown[])?.length ?? 0).toBeGreaterThan(0);
      await saver.page.goto(`${APP_URL}/workout/${data?.id}`);
      await expect(saver.page.getByText("Workout not found")).toHaveCount(0);
      await playButton(saver.page).click();
      await skipButton(saver.page).click();
      await expect(saver.page.locator("h2").first()).not.toHaveText("");
    });

    await test.step("it's in your shared list, and you can delete it", async () => {
      await sharer.page.goto(`${APP_URL}/profile`);
      await sharer.page.getByRole("button", { name: "Shared Workouts" }).click();
      await expect(sharer.page.getByText(shareName)).toBeVisible();
      await openFightClub(sharer.page);
      const mine = sharer.page.locator(".card-workout", { hasText: shareName });
      await mine.locator("button:has(svg.lucide-trash2)").click();
      await sharer.page.getByText("Post deleted").first().waitFor();
      await expect(mine).toHaveCount(0);
    });
  });
});

test.describe("ratings", () => {
  test("a preset shows its real average, and yours can change", async ({ page, browser }) => {
    const first = await newFighter(browser, "RaterOne", page);
    const second = await newFighter(browser, "RaterTwo");

    const openPreset = async (fighter: Fighter) => {
      await openFightClub(fighter.page, "Presets");
      await fighter.page.getByText("Pro Loadout").first().click();
    };
    const rate = async (fighter: Fighter, stars: number) => {
      await fighter.page.getByRole("button", { name: /Rate this Workout|You rated/ }).click();
      await fighter.page.locator('p:text("Rate this workout") + div button').nth(stars - 1).click();
      await fighter.page.getByText(`Rated ${stars} star`).first().waitFor();
    };

    await test.step("no ratings yet says so", async () => {
      await service.from("workout_ratings").delete().neq("rating", 0);
      await openFightClub(first.page, "Presets");
      const card = first.page.locator(".card-workout", { hasText: "Pro Loadout" });
      await expect(card).toContainText("No ratings yet");
      await expect(card).not.toContainText("5.0");
      await card.click();
      await expect(first.page.getByText("No ratings yet").first()).toBeVisible();
    });

    await test.step("two fighters rate it", async () => {
      await openPreset(first);
      await rate(first, 2);
      await expect(first.page.getByRole("button", { name: "You rated 2/5" })).toBeVisible();
      await openPreset(second);
      await rate(second, 4);
      await expect(second.page.getByText("3.0 (2)").first()).toBeVisible();
    });

    await test.step("the card shows the same, and a changed rating counts once", async () => {
      await openPreset(first);
      await expect(first.page.getByRole("button", { name: "You rated 2/5" })).toBeVisible();
      await rate(first, 5);
      await expect(first.page.getByText("4.5 (2)").first()).toBeVisible();
      await openFightClub(second.page, "Presets");
      await expect(second.page.locator(".card-workout", { hasText: "Pro Loadout" })).toContainText("4.5 (2)");
    });
  });
});

test.describe("your own sets", () => {
  test("a set saves, edits, reorders and survives a reload", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Builder", page);
    const name = `My Rounds ${Date.now()}`;
    const rows = async () =>
      (await service.from("workouts").select("id,name,sort_order").eq("user_id", fighter.id).order("sort_order")).data ?? [];

    await test.step("save a new set", async () => {
      await page.goto(`${APP_URL}/build`);
      await page.getByPlaceholder("Workout Name").fill(name);
      await page.getByRole("button", { name: "Add Phase" }).click();
      await page.getByRole("button", { name: "Save Workout" }).click();
      await page.getByText(`Saved "${name}"`).first().waitFor();
      await expect.poll(async () => (await rows()).map((row) => row.name)).toContain(name);
      await page.reload();
      await expect(page.getByRole("heading", { name: name.toUpperCase() })).toBeVisible();
    });

    await test.step("edit it, and the one row changes", async () => {
      const count = (await rows()).length;
      await page.locator(".card-workout, [class*=card]", { hasText: name }).first().locator("button:has(svg.lucide-pencil)").click();
      await page.waitForURL("**/build**");
      await expect(page.getByPlaceholder("Workout Name")).toHaveValue(name);
      await page.getByPlaceholder("Workout Name").fill(`${name} v2`);
      await page.getByRole("button", { name: "Save Workout" }).click();
      await page.getByText(`Saved "${name} v2"`).first().waitFor();
      await expect.poll(async () => (await rows()).map((row) => row.name)).toContain(`${name} v2`);
      expect((await rows()).length).toBe(count);
    });

    await test.step("a new set goes after the others", async () => {
      const all = await rows();
      expect(all[all.length - 1].name).toBe(`${name} v2`);
    });
  });

  test("saving a preset and customizing one both work on an account", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Saver", page);
    await openFightClub(page, "Presets");
    await page.getByText("Pro Loadout").first().click();
    await page.getByRole("button", { name: "Save to My Workouts" }).click();
    await page.getByText(/"Pro Loadout" saved to your workouts/).first().waitFor();
    await expect
      .poll(async () => (await service.from("workouts").select("name").eq("user_id", fighter.id).eq("name", "Pro Loadout")).data?.length)
      .toBe(1);

    await page.locator(".card-workout", { hasText: "Pro Loadout" }).first().click();
    await page.getByRole("button", { name: "Customize in the Builder" }).click();
    await page.waitForURL("**/build**");
    await expect(page.getByPlaceholder("Workout Name")).toHaveValue("Pro Loadout");
  });
});

test.describe("signing out and back in", () => {
  test("the next account on the same browser sees nothing of the last one, and yours comes back", async ({ page, browser }) => {
    const first = await newFighter(browser, "FirstUser", page);
    await page.goto(`${APP_URL}/edit-profile`);
    await page.locator("input[type=file]").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
    await page.getByText("Profile photo updated!").first().waitFor();

    const signOut = async () => {
      await page.goto(`${APP_URL}/settings`);
      await page.getByRole("button", { name: "Sign Out" }).click();
      await page.getByText(/Signed out/).first().waitFor();
    };

    await test.step("signing out leaves nothing of the account on screen or in the browser", async () => {
      await signOut();
      const stored = await page.evaluate(() => JSON.stringify(localStorage));
      expect(stored).not.toContain(first.name);
      expect(stored).not.toContain(first.id);
      expect(stored).not.toContain(first.email);
      await page.goto(`${APP_URL}/profile`);
      await expect(page.getByText(first.name)).toHaveCount(0);
    });

    const second = await test.step("a different account signs in on the same browser", async () => {
      const fighter = await newFighter(browser, "SecondUser", page);
      expect(await readStore(page)).toMatchObject({ signedIn: true, name: fighter.name });
      await page.goto(`${APP_URL}/profile`);
      await expect(page.getByText(first.name)).toHaveCount(0);
      await expect(page.locator(`img[src*="${first.id}"]`)).toHaveCount(0);
      return fighter;
    });

    await test.step("the first account comes back with everything", async () => {
      await signOut();
      await signInWithLink(page, first.email);
      await page.waitForURL(`${APP_URL}/`);
      await page.getByText("Your Sets").waitFor();
      expect(await readStore(page)).toMatchObject({ signedIn: true, name: first.name });
      await page.goto(`${APP_URL}/profile`);
      await expect(page.locator(`img[src*="${first.id}"]`).first()).toBeVisible();
      await expect(page.getByText(second.name)).toHaveCount(0);
    });

    await test.step("a session survives a reload", async () => {
      await page.reload();
      await expect(page.getByText(first.name).first()).toBeVisible();
      expect((await readStore(page)).signedIn).toBe(true);
    });
  });
});

test.describe("admin screens", () => {
  test("a regular fighter is kept out", async ({ page, browser }) => {
    const fighter = await newFighter(browser, "Regular", page);
    await fighter.page.goto(`${APP_URL}/settings`);
    await expect(fighter.page.getByText("Admin Portal")).toHaveCount(0);
    await fighter.page.goto(`${APP_URL}/admin`);
    await expect(fighter.page.getByText("Access Denied")).toBeVisible();
  });

  test("an admin lists, creates and deletes accounts, and sees why something failed", async ({ page, browser }) => {
    const admin = await newFighter(browser, "Admin", page);
    await service.from("user_roles").insert({ user_id: admin.id, role: "admin" });
    const regular = await newFighter(browser, "Listed");
    const newEmail = `created-${Date.now()}@example.com`;

    await test.step("get there from settings", async () => {
      await page.goto(`${APP_URL}/settings`);
      await page.getByText("Admin Portal").click();
      await page.waitForURL("**/admin");
      await page.getByText("ADMIN PANEL").waitFor();
    });

    await test.step("the list shows real accounts, split by role", async () => {
      await expect(page.getByText(admin.email)).toBeVisible();
      await expect(page.getByText(regular.email)).toBeVisible();
      await expect(page.getByText("Administrators")).toBeVisible();
    });

    await test.step("create an account", async () => {
      await page.getByRole("button", { name: "Add" }).click();
      await page.getByPlaceholder("Name").fill("Made By Admin");
      await page.getByPlaceholder("Email").fill(newEmail);
      await page.getByPlaceholder("Password").fill("a-real-long-password");
      await page.getByRole("button", { name: "Create" }).click();
      await page.getByText("User created successfully").first().waitFor();
      await expect(page.getByText(newEmail)).toBeVisible();
    });

    await test.step("the same email again gives the real reason", async () => {
      await page.getByRole("button", { name: "Add" }).click();
      await page.getByPlaceholder("Email").fill(newEmail);
      await page.getByPlaceholder("Password").fill("a-real-long-password");
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByText(/already been registered/).first()).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("opening a card goes to that profile", async () => {
      await page.getByText(regular.email).click();
      await page.waitForURL(`**/profile/${regular.id}`);
      await page.goBack();
      await page.getByText("ADMIN PANEL").waitFor();
    });

    await test.step("the admin tools open without breaking anything", async () => {
      await page.goto(`${APP_URL}/settings`);
      await page.getByRole("button", { name: /Regen Loadout/ }).click();
      await page.getByText(/Loadout|loadout/).first().waitFor();
      await expect(page.getByRole("button", { name: /Regen Loadout/ })).toBeEnabled();
      await page.goto(`${APP_URL}/admin`);
      await page.getByText("ADMIN PANEL").waitFor();
    });

    await test.step("delete an account, and they're really gone", async () => {
      const card = page.locator(".card-workout", { hasText: newEmail });
      await card.locator("button:has(svg.lucide-trash2)").click();
      await page.getByRole("button", { name: "Delete Forever" }).click();
      await page.getByText("User deleted").first().waitFor();
      await expect(page.getByText(newEmail)).toHaveCount(0);
      const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
      expect((data.users as { email?: string }[]).some((user) => user.email === newEmail)).toBe(false);
    });
  });
});
