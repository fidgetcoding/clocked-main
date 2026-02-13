# Badge System — UI & Functional Test Suite

Build a test page at `/test/badges` (dev-only, hidden from production nav) that runs automated and visual checks on the entire badge system. This page should have a "Run All Tests" button that executes every check below and displays PASS/FAIL results.

---

## TEST GROUP 1: Badge Collection Rendering

**1.1 — All badges render**
- Count total badge cards rendered in the BadgeCollection grid
- Expected: 234 (88 core + 146 post-L100)
- FAIL if any badge definition in badges.ts or postL100Badges.ts does not have a corresponding rendered card

**1.2 — Earned vs locked states**
- Mock a user with 0 earned badges: ALL 234 should render as locked (greyed silhouette)
- Mock a user with all 234 earned: ALL should render as full color
- Mock a user with exactly 5 specific earned badges: verify those 5 are colored, the other 229 are locked

**1.3 — Category filter**
- Click each category filter tab
- Verify only badges from that category are visible
- Verify badge count per category matches the expected:
  - Core: Streak 18, Combo 23, Volume 11, Time 11, Conditioning 19, In-Workout 4, Prestige 2
  - Post-L100: Mastery 7, Overflow 7, Legacy 13, Ultra Combo 4, Ultra Conditioning 12, Ultra Time 5, Ultra Volume 6, Ultra Cardio 4, Ultra Streak 8, Combat Mastery 36, Consistency 23, Performance 14, Milestones 7
- Verify "All" filter shows all 234

**1.4 — Category colors**
- Each category must have a distinct color
- Verify no two categories share the same primary color
- Render a color swatch grid showing category → color mapping

**1.5 — Placeholder shapes**
- Verify badges use at least 3 different shapes (circles, hexagons, shields, stars, diamonds, etc.)
- Shapes should vary by category — not all identical circles

---

## TEST GROUP 2: Badge Detail Modal

**2.1 — Modal opens on tap**
- Tap any badge card → modal should appear
- Modal must show: badge name, category, XP reward, requirement description, tracking stat name

**2.2 — Progress bar (unearned badge)**
- For a user with 500 total combos, open the "Combo Artist" badge (requires 1,000 combos)
- Progress bar should show 50% filled
- Text should show "500 / 1,000 combos"

**2.3 — Progress bar (earned badge)**
- For an earned badge, progress bar should be 100% filled
- Should show "Earned" or a checkmark, not a raw number

**2.4 — Edge case: 0 progress**
- For a brand new user (all stats = 0), open any badge requiring > 0
- Progress bar should show 0%
- Should not show negative numbers or errors

**2.5 — Edge case: far exceeded threshold**
- User has 50,000 combos, opens "Combo Regular" badge (requires 100)
- Should show earned state, not a progress bar overflowing past 100%

---

## TEST GROUP 3: Badge Trigger Logic

**3.1 — Session 1 badge explosion**
- Simulate a Rookie completing session 1 with stats: sessions=1, streak=1, combos=150, hours=0.667, pushups=120, burpees=15, curlups=60, jog_min=13
- Expected: 15 badges trigger (cross-reference with badge_trigger_order test data)
- Expected total badge XP: 840
- Verify each triggered badge name matches expected list

**3.2 — No double-triggering**
- Run session 1 badge check → 15 badges earned
- Run session 2 badge check with updated stats → NONE of the 15 session-1 badges should re-trigger
- Only new threshold crossings should trigger

**3.3 — Badge XP not streaked**
- Session with 1.4x streak, base 1000 XP, badge triggers worth 500 XP
- Correct total: (1000 × 1.4) + 500 = 1900
- Wrong total: (1000 + 500) × 1.4 = 2100
- Assert the correct calculation

**3.4 — Multiple badges same session**
- Simulate a session where stats cross 3 badge thresholds simultaneously
- Verify all 3 trigger, all 3 XP values are summed, all 3 appear in the post-workout summary

**3.5 — Badge persistence**
- Award badge ID "first_combo" to a mock user
- Reload the badge collection
- Verify "First Combo" still shows as earned (not reset to locked)
- Verify it's in the earned set in the DB

---

## TEST GROUP 4: Post-Workout Badge Toast Notifications

**4.1 — Toast appears on badge earn**
- Trigger 1 badge → verify a toast/notification appears with badge name and XP reward

**4.2 — Multiple toast queueing**
- Trigger 5 badges simultaneously → verify they appear sequentially (not all stacked at once)
- Each toast should be visible for at least 1 second before the next appears

**4.3 — Session 1 mass trigger (15-17 badges)**
- Simulate session 1 for a Rookie → 15 badges trigger
- Verify the UI does NOT explode — toasts should queue gracefully
- All 15 should eventually display (scrolling feed, paginated, or sequential)

**4.4 — Toast content**
- Each toast must show: badge shape (with category color), badge name, XP reward ("+840 XP" etc.)

---

## TEST GROUP 5: Post-Workout Summary Badge Section

**5.1 — Badges earned list**
- After a session with 5 badges earned, the PostWorkoutSummary should show all 5
- Each badge should display its shape, name, category color, and XP reward

**5.2 — Zero badges earned**
- After a session with 0 new badges, the badge section should either be hidden or show "No new badges this session"
- Should NOT show an empty container or broken layout

**5.3 — Scroll/pagination for many badges**
- After session 1 (15 badges), verify the list is scrollable or paginated
- All 15 should be accessible, not cut off

**5.4 — Badge XP total**
- The XP breakdown in the summary should show badge XP as a separate line item
- Verify the number matches the sum of all triggered badge XP values

---

## TEST GROUP 6: Post-L100 Badge Behavior

**6.1 — Post-L100 badges visible at L100**
- Mock user at L100 Rookie → post-L100 badges (Mastery, Overflow, etc.) should appear in the collection
- Before L100, these badges should be hidden or shown as "Locked — Reach L100 to unlock"

**6.2 — XP bar swaps to badge progress at L100**
- Mock user at L100 → XP bar should show "MAX LEVEL" and progress toward next unearned badge
- Mock user at L99 → XP bar should show normal level progress

**6.3 — Overflow XP tracking**
- Mock user at L100 with 5,000 XP past threshold → "Overflow" badge (5,000 overflow) should show 100% progress
- "Surplus" badge (15,000 overflow) should show 33% progress

---

## TEST GROUP 7: Profile & Stats Integration

**7.1 — Profile badge count**
- Profile should show "X / 234 badges earned"
- Verify count updates when new badges are awarded

**7.2 — Stats page recent badges**
- Award 3 badges → stats page "Recent Badges" section should show all 3 with dates

**7.3 — Prestige banner with badges**
- User at L100 with prestige available → PrestigeAvailableBanner visible
- Badge collection still accessible and functional beneath it

---

## OUTPUT FORMAT

Build this as a dev test page with:
- "Run All Tests" button at the top
- Each test group collapsible
- Each individual test shows ✅ PASS or ❌ FAIL with detail on expected vs actual
- Summary at top: "X / Y tests passed"
- Any FAIL should be bright red and expanded by default

This page is for internal QA only — it will not ship to production.
