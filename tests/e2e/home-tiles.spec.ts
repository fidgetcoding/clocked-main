// Home's tiles carry their titles and nothing in front of them.
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

test("Home shows the tile titles without slot tags, and the main set's length on its own", async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Home Tiles");
  // Each tile's name starts with its title, so no tag sits before it
  for (const title of ["QUICK SESSION", "PUNCH CHECK", "CREATE SET", "WORKOUT LOG"]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
  // The set rows give each set's length, e.g. "12 MIN"
  await expect(page.getByText(/^\d+ min$/i).first()).toBeVisible();
  await expect(page.getByText(/Next up/)).toHaveCount(0);
});
