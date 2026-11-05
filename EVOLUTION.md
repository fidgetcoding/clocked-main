# How Clocked got built

My words are quoted as I wrote or said them, typos fixed, nothing else. Commit hashes are from this repo. "Private note" means a dated chat or call record I keep offline. Times from 2026-11-01 are Gulf time.

## 1. The short version

Clocked started on January 18, 2026 as a question about beginner boxing drills and, minutes later, a multi-phase workout clock called Clombo. Two days later it was called Clocked, and Lovable was writing the code while I tested it by shadowboxing downstairs.

In February I added XP and it hooked me. The first XP math was vibes. It broke the day I measured a real workout (666 XP against curves built for 1,154), so I threw the estimates out and, with Claude, calculated every combo in every tier. February alone took 909 commits, 654 of them in three days.

A move to Replit and a mobile path followed and never shipped. The last Lovable commit landed May 21. On November 1 the app got a guest mode, a security pass and a camera form guide called Punch Check, and it left Lovable for good. Readers bring their own Supabase and AI key. Then the backend ran on real hosted Supabase, and rewards stopped paying out for a 5-second workout.

The next four days went to the camera and the feel. Clocked got a new look, Punch Check learned to count from any spot around a bag, calibration now runs before every camera session, and the coach voice is me, recorded in one take. Then six batches of optimization: a smaller first load, session XP credited once on the server, a security review that found nothing above low, and text that fits on every screen. I built all of that by directing Claude Code, with one day of Codex on November 4.

The original design documents are in [docs/history/](docs/history/).

## 2. Origin, in my words

Why it exists (call recording, April 13, 2026):

> "You have to buy like $1,500 worth of hardware. Like you need to buy like a custom heavy bag with sensors on it and all this stuff. And it just wasn't built for the shadow boxing community."

How it got tested:

> "I was literally upstairs. I'd code it. I'd run downstairs. I'd do a round and I'd test it. And one day I decided to add a gamification system to it."

> "And the dopamine of leveling up started hitting me so hard."

The first ask to an AI (private note, January 18):

> "I want to make an app that basically is a workout clock. Workouts have multiple phases, sometimes different time increments for different parts of it, but these can happen in cycles and sets, and I want to basically make a multi-clock system that follows my sets. I'll call it 'Clombo' like combo clock."

The premise (vision notes, undated):

> "All you need to train with Clocked is shadow boxing. No gloves. No bag. No gym. No experience."

On the math (private note, February 16):

> "The process of me doing math for the first time in years trying to build this XP system."

## 3. Timeline

| Date (2026) | What happened | Evidence |
|---|---|---|
| Jan 18 | Drills question, then the Clombo clock framework written for Lovable | Private notes |
| Jan 20 | "Call it Clocked now." First Lovable commits, 123 that day: onboarding, combo builder, timer fixes | `e11a486`, `852ae20`, `15e89fa` |
| Jan 21 | Avatars, stats, countdown voice | `2859e16`, `f3d3f7e` |
| Feb 2 to 3 | XP components, then the double-spend loop | `6bbf765`, `04b43e8` |
| Feb 5 to 6 | User data isolated, user search, wall-clock timer, haptics and sounds | `b077638`, `ebb17cd`, `9e752c1`, `f19cdd6` |
| Feb 12 | Biggest day: 308 commits. Admin portal, parser overhaul, speed bag drills, exercise library | `948b9b6`, `2c87f61`, `2717305`, `af98ffe` |
| Feb 12 | I find out a competitor, PunchLab, exists | Private note |
| Feb 13 | 226 commits. Championship rounds, prestige, badge UI, XP test suites | `0d723ab`, `ffee2b0`, `f090985`, `96cd1cc` |
| Feb 14 | Apple sign-in, workout ratings, presets reordered | `eae1a6c`, `feee6e9`, `3aa50ac` |
| Feb | XP Curves Origin Story written up | [The PDF](docs/history/xp-curves-origin-story.pdf) |
| Feb 18 to 20 | AI builder agent specced, then the Google/AI edge function | Private note, `60944af` |
| Feb 25 | KOI Coach renamed AI Coach, full test suite, gloves on profile. Same day, the move to Replit | `252052b`, `1e22c22`, `72e2f24`, private note |
| Mar 12 | Mobile version handed to another AI build tool | Private note |
| Apr 5 to 6 | Launch to-do list written. Workout editor click and drag fixes | Private note, `6a62334`, `ab20106` |
| Apr 13 | Preset names fixed. I say "about 3,500 plus different tests" on a call | `f549d28`, call recording |
| May 21 | "Fixed 6 security findings", logo scaled up. Last Lovable commit | `bd3f86d`, `3cf00f5` |
| Nov 1 | Email-link-only sign-in, guest mode, audit fixes, nav bug, totals bug, new icons, Capacitor bump, MIT | `f501bd1`, `49700e3`, `3daadfe` to `cd25c1f`, `e95ebd5` |
| Nov 1 | Leaves Lovable: a clone developed in Claude Code, with readers bringing their own Supabase and AI key | `56a97f3`, `445547b`, `071202e`, `05bea90` |
| Nov 1 | Punch Check, a fix after my first live try, a recording mode, the camera inside workouts, then tuning against that recording and quieter cues | `52f83d7`, `e1a9d2b`, `20879ec`, `af5e13f`, `bbf6da9`, `471b0fa` |
| Nov 1 | Migrations run on a new project, Data API grants made explicit | `f5d72d9`, `341f160` |
| Nov 1 | Production audit cleared, on react-router 7 | `aa2f45b`, `a81be2c` |
| Nov 1 | The backend run for real with `npm run test:stack`. Lint to zero, wired into CI | `04a9c31`, `78f9b06` |
| Nov 1 | Punch Check on phones, in WebKit and Firefox, and in long sessions | `329ca89` |
| Nov 1 | Real art for every glove and badge | `e0711d4`, `a27f2f8` |
| Nov 1 | Live training and coach tools labeled coming soon | `0d60eca`, `7e7edb9` |
| Nov 1 | Guest walk through the whole app, and its fixes | `221e222`, `ccbbae8`, `a1b5777` |
| Nov 1 | Rewards gated by what was actually trained | `cc5113c`, `54d53ef`, `9dda0c8` |
| Nov 1 | `SETUP.md` corrected from a run on real hosted Supabase | `8793b55`, `e37dfa2` |
| Nov 1 | A workout survives a reload. A signed-in walk through the app, and its fixes | `2dcaba2`, `b4233b2` |
| Nov 1 | The Ringside redesign, and Quick Session logging every punch, combo, round and cue | `2d19f1e`, `7bdf727`, `b51fa31`, `beb6a2b`, `e014471` |
| Nov 2 | Punch Check reads you from any camera angle and counts from any spot around a bag | `bbd3717`, `9b796f3`, `261af44` |
| Nov 2 | Free Side, the panel that gets out of your way. Grind and Rest replace "on air", and the TV wording leaves the app | `87df1f1`, `7a0bcb9`, `441848d`, `6a18c13` |
| Nov 2 | The production build walked like a person. Failed saves said out loud, no double logs after a reload, the camera asks before Start | `a84491f`, `923fb5a`, `ec70415`, `5ede8d3`, `eacc879` |
| Nov 2 | Dev-tool advisories cleared on Vitest 4 and Vite 6. Firefox camera spec running in CI | `c203918`, `82e76a4` |
| Nov 3 | Calibration before every camera session, with Skip. Saved early exits and hand-logged workouts count | `d6e5511`, `1056104`, `7059198`, `9ff67a5` |
| Nov 3 | The angle lab, 18 takes of me, and small moves that ride along with punches stop counting | `c10a8ad`, `7f9d1cb`, `2ddc011`, `de8bd5c` |
| Nov 3 | One tap mutes the voice everywhere, and a coach voice I can record in one take | `6b2d0aa`, `46125ef` |
| Nov 4 | My recorded coach voice: 180 takes for 174 lines | `5a75f38`, `a00af26` |
| Nov 4 | Optimization batches 1 and 2: 44% less JavaScript on first load, voice order, auth races, stale combo calls | `66f7cf4`, `4b1381e`, `1402009`, `d11fd1d` |
| Nov 5 | Batch 3: an exact session clock, training screens that work offline | `2bef108` |
| Nov 5 | Batch 4: all-or-nothing reorder, session XP credited once on the server | `f485f07` |
| Nov 5 | Batches 5 and 6, and a security review | `03a4d30` |
| Nov 5 | Text that fits on every screen | `f7dc10a` |

History shape: 1,086 commits by Lovable's bot from January 20 to May 21, then 144 of mine from November 1 to 5, made by directing Claude Code and, on November 4, Codex. Lovable's by month: January 151, February 909, March 1, April 20, May 5. Mine by day: 74, 41, 19, 6 and 4.

## 4. Round by round

### Round 1: the clock (January)
- **Built:** a workout clock with phases, combos, a builder and onboarding.
- **Tested:** me, downstairs, one round at a time.
- **Broke:** timer races and UI drift. The history has "Reverted to commit" over and over on day one, and `15e89fa` fixes the timer race. Later, one timer layout got "fixed" six times. `timer_layout_final_fix.md` lists every failed attempt and ends in a one-line change.
- **Fixed:** wall-clock timer (`9e752c1`).
- **Wanted next:** a reason to keep going. That became XP.

### Round 2: vibes-based XP (early February)
- **Built:** 100 XP a level, then "I meant 1,000 XP", then Pokémon-style stagger plus prestige multipliers.
- **Tested:** in the app, with me leveling up.
- **Broke:** XP double-spend loop (`04b43e8`). Worse, the curves were calibrated to 1,154 XP from a 59-minute workout that had been scrapped. The real session came out at 666 XP, 43% less. "The entire system was broken."
- **Fixed:** three options were on the table: inflate the rates, lower the thresholds or accept slower progress. I refused to inflate, because a jab is a jab. The curves moved instead.
- **Wanted next:** numbers that come from the workouts, not from me.

### Round 3: real math (mid February)
- **Built:** a Python calculator that walked every segment of every tier's loadout. Session XP came out at 679.8, 829.8, 1,096.6, 1,706.3 and 2,291.0. Then a two-constraint solver with scipy's `fsolve`, and later a power curve, `cost(n) = A × n^B`.
- **Tested:** side-by-side curve visualizations, and test suites generated from the math.
- **Broke:** the Level 500 idea. Six-plus curve fits failed, because any continuous curve meant about 1,700 more sessions at Pro.
- **Fixed:** cut it. Level 100 is the cap, and badges carry what comes after.
- **Wanted next:** an app that could build these workouts from plain words.

### Round 4: the AI builder and the parser (February 12 to 20)
- **Built:** natural language to timer workout, with a multi-phase parser, speed bag drills, supersets (renamed megasets) and equipment-aware loadouts. A model behind an edge function, and an on-device parser in case it's not there.
- **Tested:** generated multi-round workouts, tier by tier. One Advanced loadout run logged 22 passing checks and 3 bugs (`Advanced_Loadout_Bug_Report.md`).
- **Broke:** parser edge cases and library state bleeding between blocks (`0531f61`, `b63589e`).
- **Fixed:** parsers got their own tests (`supersetParser`, `speedBagParser`, `shadowboxParser`, `conditioningParser`).
- **Wanted next:** a real phone app.

### Round 5: the first try at leaving Lovable (February 25 to March 12)
- **Built:** a Replit port and a separate mobile path, with Claude Code comparing the two codebases.
- **Tested:** me on the port, the same night.
- **Broke:** "when I moved to Replit I started having weird shit": XP not animating, and skipping four segments jumped me to level 4 (private note, February 26).
- **Fixed:** not to the point of shipping.
- **Wanted next:** I handed mobile to another tool and went back to polishing the web app in Lovable. No mobile release is on record.

### Round 6: last polish (April to May)
- **Built:** editor fixes, preset names, profile trigger, security fixes (`08867b8`, `f549d28`, `bd3f86d`).
- **Tested:** by hand.
- **Broke:** drag handles swallowing clicks (`90e460c`, `ab20106`).
- **Wanted next:** launch work from the April to-do: coach-made presets, testing with non-boxers, glove art.

### Round 7: opening it up (November 1)
- **Built:** guest mode that stores everything in the browser, email-link sign-in, Punch Check. Lovable is the true start of this codebase, but development moved to this clone, worked on in Claude Code, and anyone who wants the backend brings their own Supabase and AI key.
- **Tested:** see section 6.
- **Broke, found in testing:**
  - The bottom nav covered modal submit buttons on phone and desktop. Fixed in `c1f3d14`.
  - Logging a session passed a local id, which zeroed an account's totals in a stubbed test: 12 workouts became 0. Real accounts may have been showing zeroed totals. Fixed in `327eb90`.
  - A coach test only passed on a UTC machine (`36d0550`).
  - `club_members` reads failed with infinite recursion. Fixed in `21efa69`.
  - Punch Check: on a real camera, jabs came in as 5 and crosses as 4 (uppercut numbers). A straight became the default, and hooks and uppercuts now have to prove themselves.
  - Punch Check again: my labeled recording scored 11 of 29 on held-out reps, and lead uppercuts were almost never seen. Most of it was the detector, not the thresholds. Real uppercuts come back up only to guard height, so they were being thrown out as hands returning. A hook's wind-up and the other hand's recoil counted as punches. After tuning it's 24 of 29 on that one recording: one person, one camera, one session. That's optimistic, since the fixes came from studying it.
  - A guest walk through the whole app found that saved presets had no phases and ran empty, the AI Coach's Generate Workout opened an empty builder, and the mic on the workout log typed a canned sentence instead of listening. Speed bag drills and double-end combos were saved but never shown, and the time buttons sat on the combo card on short phones and laptops.
- **Fixed:** the audit list below, and all of the above.
- **Wanted next:** to find out if any of the backend really works.

### Round 8: real backend, real rewards (November 1)
- **Built:** `npm run test:stack`, a throwaway local Supabase with a real `db push`, functions against a fake AI provider, and a real browser clicking the link in the mail catcher. Then a run on real hosted Supabase, and `SETUP.md` corrected from it.
- **Tested:** see section 6.
- **Broke:**
  - Every fresh `db push` stopped at migration 19 of 39, on a seeded admin that doesn't exist on a new project (`f5d72d9`).
  - On a new project every query failed with 42501, since Supabase stopped exposing new tables by default (`341f160`).
  - A new account's first workout got a 406 from hosted Supabase, and the live badge check sat on a timer that restarted every second, so it never fired (`54d53ef`).
  - A 5-second test workout earned 13 badges and 1,267 XP (`cc5113c`). Pressing -30 to the end of a run earned +10 XP with nothing trained, and a first 6-minute run earned 7 badges for +430 XP (`9dda0c8`).
  - The feed showed a fake LIVE stream with invented viewers (`0d60eca`).
- **Fixed:** all of those. Preparation time no longer counts as training, sessions earn credit only for the kinds of training they had, four in-workout badges have real conditions, and live training and coach tools now say they're coming soon. The level curve and the combo math stayed as they were.
- **Wanted next:** a look that feels like fight night, and a camera that copes with a bag in the way.

### Round 9: Ringside, and a bag in the way (November 1 and 2)
- **Built:** the Ringside redesign: one token file, a set of shared plates, and a run screen where the camera fills the background behind the clock. Quick Session started logging every punch, combo, round and cue. A running workout now survives a reload: it comes back paused and offers to resume (`2dcaba2`). Then Punch Check learned to read me from any camera angle, count from any spot around a bag, and tell you what your spot gives you (`bbd3717`, `9b796f3`). Free Side put the clock, the combo and the count in one panel that jumps to the emptier side of the screen when your body crowds it (`87df1f1`).
- **Tested:** a signed-in walk through the app on the real local backend. Then, because "the whole app needs to be tested end to end to make sure it works," the production build walked like a person in Chromium, Firefox and WebKit. Bag spots were checked on a rendered figure through the real pose model, which says nothing about accuracy on real people.
- **Broke:**
  - I'd pictured the camera wrong. All the camera work assumed a laptop at desk height in open space. My note: "Imagine there is a bag in front of the person. They can't have the camera head on unless it's strapped to the bag, but they might not have the equipment to strap it to the bag, so they need something else" (private note, November 2).
  - The signed-in walk found wrong follower counts on other profiles, a profile link that opened your own profile, archived sets nobody could find, made-up ratings and downloads on presets, empty club ranks, club chat that only pretended to send, and only one club ever showing (`b4233b2`).
  - The person-style walk found new screens that wouldn't scroll, round numbers off by one, and clipped summaries and landscape columns (`a84491f`). Failed saves were parked quietly as offline (`923fb5a`). "Logged" showed before the streak and totals were saved, and logging again after a reload could add a run twice (`ec70415`, `5ede8d3`). The camera screen went black when its code couldn't load (`48b5920`). Firefox threw a sign-in lock error on every page and held you at Start for as long as you ignored its camera prompt (`a5d2438`, `784788d`).
  - The look said "on air" and "Go live". I said: "Instead of 'on air' it should be like rest vs grind or some kind of words like that."
- **Fixed:** all of it. Grind, Rest and Paused show the state, Start replaced Go live, and the TV wording left the app for gym words (`7a0bcb9`, `441848d`, `6a18c13`). The camera asks for permission before Start (`eacc879`). The critical and high dev-tool advisories went with Vitest 4 and Vite 6 (`c203918`).
- **Wanted next:** proof the camera sees real punches from real spots, and a setup step before any punch counts.

### Round 10: calibration and the angle lab (November 3)
- **Built:** calibration before every camera session: setup tips, a guard hold, one of each punch, then what to expect, with Skip at every step. Punches thrown for it are read but never counted, and once it's done the dots and lines on your body go away (`d6e5511`, `1056104`, `efb1fbc`). That came straight from my note: "Camera should always calibrate first thing, before you start the workout... it needs to tell you like, don't do this, show your hips, etc... make sure you throw all the punches correctly." A saved early exit now counts as a completion, and hand-logged workouts count toward your total (`7059198`, `9ff67a5`). Then a dev-only angle lab: a top-down diagram and spoken setup for each camera spot, with each take scored in the page (`c10a8ad`).
- **Tested:** I filmed 18 takes on my laptop webcam: 8 spots around me on the floor, the same 8 from a chair, a swing check, and the front with no bag. Nothing higher than a chair was to hand. And no bag at all: "I had no bag in front of me, it was pure shadow boxing."
- **Broke:** it over-counted. Mid-run I wrote: "So far both times it's counted 22 punches or more instead of the 18 that I threw." From the front floor it counted 35 of 18. The extras were small moves riding along with real punches, mostly the other hand dragged by the turn or snapping back to guard. From behind it under-counted and named nothing.
- **Fixed:** a move under a third of my usual punch, measured as travel times peak speed, isn't counted. Tuned on one ring and checked on the other, mean count accuracy went from 52% to 80% on the floor and 67% to 80% on the chair. The setup advice now points to the front at hip height (`de8bd5c`).
- **Wanted next:** a real voice. "It should be super easy to mute or unmute the voice in general," and "maybe I just get you a bunch of recordings of things the coach might say."

### Round 11: my voice, then "optimize everything" (November 3 and 4)
- **Built:** one tap mutes everything the app says, on every screen that talks (`6b2d0aa`). Every spoken line got an id, and an importer splits one long take on its pauses, with "again" for retakes (`46125ef`). Then I read the whole sheet in one three-minute take: 180 takes for 174 lines, including punch names, defensive moves, round calls and encouragement (`5a75f38`). Six defense calls I read twice became alternate takes, and the app picks one at random. Raw audio stays out of the repo. Next I asked for the big one: "I would like to optimize everything in Clocked code wise, make it smoother, better, faster, less buggy, etc... go through everything in max detail, present a gameplan of what you'll do, and start implementing." Batch 1 split the secondary screens out of the first load, which cut its JavaScript from 962,407 to 535,760 bytes, 44.3% (`66f7cf4`). Batch 2 stopped stale session and profile results from restoring the wrong account, kept a late sign-out from clearing a newer login, and cancelled combo calls that outlived a pause or skip (`4b1381e`). I ran this day in Codex.
- **Tested:** silently, every time. See section 6. Me listening through a whole workout is still the last check on the voice.
- **Broke:**
  - Recorded calls could play out of order when a later clip loaded first. A delayed combo call outlived its segment. Reorder errors looked like success, and a reorder was several writes that could half land.
  - Hosted CI went red. On the first voice commits, calibration checks still expected the browser's voice instead of my recordings. On batch 2's commit, 185 browser tests passed and one failed: an offline guest couldn't start Quick Session.
- **Fixed:** recorded calls keep the order they were asked for, delayed calls cancel on pause, skip, mute and exit, and reorder errors reach the error screen. The calibration checks now look for real playback. The offline failure carried into round 12.
- **Wanted next:** close the batch without losing a single workout or point of XP. I moved the rest back to Claude Code to save credits.

### Round 12: closing the batches, and a security review (November 5)
- **Built:**
  - Batch 3: a camera restart stops the old stream, the pose model is released even mid-recovery, saved sessions are checked before they're restored, a failed first sign-in lookup opens guest mode with an explanation, and long rounds keep a bounded pace window. Workout and Quick Session load right after the first screen, so a guest who goes offline can still train (`2bef108`).
  - Batch 4: reordering saves the whole new order in one database statement, so a dropped connection can't leave half the list moved. Logging a session credits its XP and counters on the server once per history entry, so a retried save or a second tab can't count it twice, and two sessions logged at once both count. Quick Session and hand-logged XP add on the server too. Saved workouts and round ratings are checked when loaded: damaged phases are repaired or left out instead of crashing a screen, and repeats are capped at 100 (`f485f07`).
  - Batch 5 closed the remaining lost updates. A badge already earned in another tab no longer drops the rest of a session's badges. The starter workout is seeded once per account, even after a guest session or an account switch, and two tabs signing in together get one. A run's completion count is added on the server and retried by End & Save. Dictation ignores results that arrive after it stops. The admin list reads every page instead of the first 1,000, and fails loudly rather than showing an admin as a regular user.
  - A read-only security review found nothing above low severity. Fixed: `has_role` no longer answers about other users, private clubs are hidden from non-members, avatars from outside the app's own storage aren't shown, a `/build?coachPrompt=` link no longer spends a generation on opening, and new tables and functions start with no grants.
  - Batch 6 was cleanup. Punch-tracking objects are built once instead of every render, and the session screen and builder shed their pure helpers into their own modules, 1,481 to 1,176 lines and 1,870 to 1,557 (`03a4d30`).
- **Tested:** see section 6. The local Supabase CLI was 2.109 and stalled serving functions. It now matches CI's 2.122.0, so the whole stack runs on my Mac, logged-in browser flows included.
- **Broke:**
  - The session clock dropped its partial second on every segment change: a 25-second run recorded 24 in WebKit. The timer restarted on every transition.
  - CI's offline failure was real. Batch 1's lazy loading meant an offline guest never got the Workout or Quick Session screen.
  - The calibration test's fake uppercut aliased at 24 and 25 frames a second, and two reward tests expected the wrong thing.
  - Before batch 4, the browser wrote totals it had added up from its own copy of the profile, so the last tab to save won. Then the new credit path forgot guests: 9 recovery checks caught guest logs failing, and hosted CI failed five specs that still intercepted the old profile write.
  - The first clubs policy fix hid every club from anonymous visitors, because Postgres checks function permissions at plan time. The local stack caught it.
  - Unit testing the moved segment flattening found megaset rounds restarting at "Round 1" in a one-phase grind.
  - After a reload, retrying a failed save credited the resumed run's XP, which no longer counts the badges the first attempt already saved. The account lost that badge XP for good: 75 credited against 115 recorded in the test.
- **Fixed:** all of those. The timer restarts only on play and pause, and a long delayed tick credits each segment it crosses, skips preparation and stops at the workout's end. The clubs policy was split in two. The profile is credited with the XP its history entry recorded.
- **Wanted next:** a real phone, my real webcam and a real bag. Synthetic cameras can't prove accuracy, battery or heat.

### Round 13: text that fits (November 5)
- **Built:** an audit of every guest screen at 320, 390 and sideways phone widths and at laptop and desktop sizes, in Chromium and WebKit (`f7dc10a`).
- **Tested:** see section 6.
- **Broke:**
  - The up-next exercise lost the slanted start of its first letter at every size, because truncation clipped the italic overhang.
  - Set names were cut to "…" on phones.
  - One-word badge and glove names ("IMMORTALIZED", "BLOODSTONE") were clipped on small phones.
  - The first label fix did nothing. `cn()` merges Tailwind classes, read the new `text-fit-label` class as a text color and dropped it.
- **Fixed:** the up-next name wraps with room for the slant. Set names take two lines, hyphenate a word too long for the line, and step down one size below 360px. Badge and glove names size to their cell, 16px wherever they already fit. The class became `fit-label`. The set card's edit and remove buttons grew from 36 to 44px wide.
- **Wanted next:** the real-device session from round 12.

## 5. Feature family tree

```
beginner drills question
└─ workout clock (Clombo)
   ├─ combo notation → combo builder → tier-gated combos
   ├─ timer engine → voice callouts, haptics → championship rounds
   ├─ workout logging → stats → streaks
   └─ testing it by punching
      └─ "add a gamification system"
         └─ XP → prestige → badges → earned gloves → real art
            └─ 666 XP problem → granular calculator → solver → power curves
               └─ generated test fixtures (2,700+ tests)
   clock + notation + XP tiers
   └─ loadouts → AI builder → parser suite → coach engine
      └─ edge function quota + on-device fallback → guest AI builder
   no account for strangers → guest mode → Punch Check works with no backend
   5-second workout, 13 badges → rewards that follow the clock
   leaving Lovable → Claude Code → bring your own Supabase and AI key → SETUP.md
   "no bag, no hardware" premise + phone camera → Punch Check → form cues in the log
   "a bag in front of the person" → counting from any spot → Free Side panel
      └─ angle lab, 18 takes → small moves stop counting → advice points to the front
   "calibrate first thing" → calibration with Skip → dots only while calibrating
   "super easy to mute" → one-tap mute → my recorded voice, 180 takes
   "optimize everything" → batches 1 to 6 → saves credited once on the server → security review
      └─ text-fit audit → every label fits at seven widths
```

## 6. Test log

| When | What | Result | Where |
|---|---|---|---|
| Feb | Advanced loadout, by hand | 22 pass, 3 bugs | `Advanced_Loadout_Bug_Report.md` |
| Apr 13 | My claim, "about 3,500 plus" | Confirmed by today's 3,588 count | Call recording, run below |
| Nov 1, published tip `e95ebd5`, fresh clone | `npm ci`, build, tests | Pass, 3,588 tests | Run while writing this |
| Nov 1, local tip with Punch Check | Vitest | 3,716 pass in 16 files: `xpVerification` 2,015, `loadoutValidation` 809, `xpExtended` 692, `punchDetector` 105, `coachEngine` 28, `punchRound` 17, the rest smaller | Run while writing this |
| Nov 1 | Timezones | Suite passed in 10 zones before the last small commits, and Tokyo on the later tree | Audit report |
| Nov 1 | Migrations on throwaway Postgres with stubbed auth | All 39 replay, 62 of 62 behavior checks as anon, authenticated, service role | Audit report |
| Nov 1 | Guest pass against the old Lovable-hosted backend | One Supabase request, `GET /rest/v1/clubs`, no writes, no console errors | Audit report |
| Nov 1 | Manual log | Real click at 390x844 and 1440x900, survives reload | Audit report |
| Nov 1 | `npm audit --omit=dev` | 13, down from 21, 0 critical | Audit report |
| Nov 1 | Punch Check on one labeled real recording: me, orthodox, one camera, one session, 10 of each punch plus guard (`?record=1`, kept out of this repo). Labels are what the prompt asked for, since nobody checked what I actually threw. Reps were split odd and even, with limits set on odd only | Held-out even reps labeled what was asked: 11 of 29 (38%) before, **25 of 29 (86%)** after. Odd reps: 10 of 30 to 25 of 30. Extra punches on even reps: 11 to 3. False punches in guard: 0 before and after. Across both halves: jabs 6 of 9, crosses 10 of 10, lead hooks 6 of 10, rear hooks 9 of 10, lead uppercuts 10 of 10, rear uppercuts 9 of 10. The fixes themselves came from looking at the whole recording, so 86% is likely optimistic. One person, so **not a general accuracy number** | `npm run punch:confusion -- file --split`, `bbf6da9` |
| Nov 1 | Punch Check on a rendered mannequin through the real pose model, 12 punches, on `bbf6da9` | Straight on: 9 found, 8 labeled right, 0 extras (was 9, 8, 3). Turned +35°: 11, 8, 0 (was 10, 6, 3). Turned -35°: 7, 5, 1 (was 8, 4, 1). Not a person, so not an accuracy number | Test recordings, rescored |
| Nov 1 | Punch Check on two public-domain US Air Force clips (Wikimedia Commons, DVIDS 955484 and 953899), on `bbf6da9` | 10 and 1 punch events (were 23 and 6). No ground truth, so counts only. No false punches in the mostly-interview openings, and that's weak evidence | Test recordings |
| Nov 1 | Punch Check, my first live try | Jabs read as 5 and crosses as 4, which led to the first fix | Commit message |
| Nov 1 | Punch Check personal calibration, offline on my one recording. First 3 reps of each punch calibrate, the rest are scored. Nearest-match relabeling only, method fixed before the final run | Remaining reps: generic 37 of 41, calibrated 36 of 41, 0 false punches in guard for both. **No win, so it didn't ship.** The generic limits were tuned on me, so this test can't show what it would do for anyone else. On the mannequin, which the limits weren't tuned on, it moved 25 to 28, 21 to 32 and 16 to 20 of 42 across three camera angles. That's a hint, not a person | Offline runs, not in this repo |
| Nov 1, `bbf6da9` | Vitest | 3,763 pass in 21 files, 157 of them for Punch Check | Run while tuning |
| Nov 1, `471b0fa` | Punch Check form cues on my one recording. Nobody knows which reps had real faults, so the only check is an independent measure from the picture: is the other hand below its own shoulder? | Punches with a cue: 19 of 31 down to 9 of 31 on odd reps, 20 of 32 down to 11 of 31 on even. "Elbow in" went from 13 to 0, and "reach all the way" from 7 to 1. "Other hand" now agrees with the picture on 6 of 8 drops on odd reps and 8 of 8 on even, with 2 and 1 cues the picture didn't back up. That shows the cues are consistent, **not that they're right**, and none has been tested against a fault I threw on purpose | `npm run punch:confusion -- file --cues` |
| Nov 1, `471b0fa` | Punch Check straights thrown at the camera | Mannequin straight on, 10 of each: jabs 4 to 7, crosses 4 to 5. On my recording, reps labeled what was asked: odd 25 to 26 of 30, held-out even 25 to 24 of 29, so 50 of 59 either way. The lost one is a held-out jab, and I'd already looked at that half once, so read the 83% with that in mind. Jabs stay 6 of 9 and crosses 10 of 10. 0 false punches in guard. Still one person | Offline runs, not in this repo |
| Nov 1, `471b0fa` | Vitest | 3,777 pass in 22 files | Fresh clone |
| Nov 1, `329ca89` | Punch Check in Chromium, Firefox and WebKit at phone sizes and in landscape, on the production build, with a canvas standing in for the camera so the same frames reach the real model | 192 of 192. Testing it found the camera panel over the workout timer on phones under 700 px tall, and the Play button and combo card overrun in landscape. Both fixed. The same frames went in everywhere, so this shows it runs and says nothing about accuracy. Not a real phone, and WebKit on a Mac isn't iOS Safari | Test recordings |
| Nov 1 | A 30-minute live Quick Session in Chromium with the real model and a fake camera, one commit before `329ca89` | 52,995 frames, a steady 30 fps, 509 punches counted but not scored, no errors, flat page and listener counts. JS heap went from 7 to 27 MB, which traces to the model's own GL tables, not my code. It also showed the session clock running about 10% slow, now fixed and checked over 90 s | Test recordings |
| Nov 1, `329ca89` | Vitest, lint, build | 3,804 pass in 24 files. Lint and build clean | Fresh clone |
| Nov 1, `a1b5777` | Guest walk through onboarding, building and running all 7 segment types, manual logs, history, stats, badges, presets and clubs in Chromium at 320x568, 390x844 and 1440x900, on the production build | 0 console errors at the end. 26 browser tests added, covering each bug. Clubs only got their no-backend message, since they need an account. Firefox, WebKit and real phones were not part of this walk | Scripted browser run |
| Nov 1, `a1b5777` | Timer buttons against the combo card, 253 screen sizes from 320 to 1920 wide and 480 to 932 tall | 0 overlaps. The page scrolls only under 560 px tall | Same run |
| Nov 1 | Real hosted Supabase, from a local build | The 40 migrations at that point applied in order through SQL. Database tests 23 of 23, no-key function tests 12 of 12. `generate-workout` and `admin-users` deployed, with `generate-workout` proving its fallback when there's no key. A real emailed link signed in | `8793b55`, session notes |
| Nov 1, `9dda0c8` | CI: lint, typecheck, unit tests, build, then the real local backend | Green. 3,832 unit tests, 43 browser tests, 23 database tests, 46 function tests (34 with an AI key set up, 12 without), all against a fake AI provider | GitHub Actions |
| Nov 1, fresh clone of `9dda0c8` | `npm ci`, lint, typecheck, build, unit tests, `npm audit --omit=dev` | All pass. 3,832 tests in 28 files. Lint 0 problems. 0 vulnerabilities | Run while writing this |
| Nov 2, `702c573` | CI after Ringside, bag spots and the person-style walk merged | Green. 3,924 unit tests, 26 database tests, 46 function tests, 167 browser tests. Before the merge, the person-style walk passed in Chromium, Firefox and WebKit | GitHub Actions, session notes |
| Nov 3 | Punch Check on 18 angle-lab takes: me shadowboxing in front of a laptop webcam, no bag, 8 spots around me from the floor and from a chair, 3 of each punch (10 at one spot). The extras were small moves riding along with real punches, mostly the other hand dragged by the turn or snapping back to guard. New rule: a move under a third of my usual punch, as travel times speed, isn't counted. Tuned on the floor ring and checked on the chair ring, then the other way round | Front floor 35 to 17 of 18, front-right floor 30 to 22, right floor 31 to 21, front-left chair 79 to 61 of 60. Mean count accuracy, floor 52% to 80%, chair 67% to 80%, and the same on whichever ring it wasn't tuned on. Names unchanged: best straight in front at hip height, none from behind. From behind it still counts 11 to 14 of 18. Still one person, and no bag | `src/test/punchRealRecordings.test.ts` |
| Nov 3, `efa94ee` | CI with calibration in | Green. 3,964 unit tests, 177 browser tests | GitHub Actions |
| Nov 3, `de8bd5c` | CI with the angle-lab fix and real takes replayed as tests | Green. 4,025 unit tests, 183 browser tests | GitHub Actions |
| Nov 4, `5a75f38` | My recorded voice | Lint, typecheck, 4,036 unit tests and the build passed. All 180 clips decoded offline. 7 silent Chromium browser checks on phone and laptop layouts: recorded workout calls, mute that sticks, calibration controls, falling back when a clip is missing, and decoding every clip. The old tests counted an empty speech warm-up as a call, and now count real speech and recorded clips | Session notes |
| Nov 4, `66f7cf4` | Batch 1 | 4,039 unit tests, 41 production-preview browser checks, lint, typecheck, build. Three regressions reproduced before their fixes. First-load JavaScript 962,407 to 535,760 bytes, gzip 289,508 to 171,356. A synthetic startup test, three cold-cache runs each way with a 4x CPU slowdown, 100 ms latency and 200 kB/s, moved the median from 2,025 to 1,413 ms. Not a real device | `npm run build -- --manifest`, then `node scripts/bundle-report.mjs`; session notes |
| Nov 4, `4b1381e` | Batch 2 | 4,054 unit tests, lint, typecheck, build, 84 production-preview browser checks in Chromium and Firefox, plus synthetic-camera calibration and voice checks | Session notes |
| Nov 4 | CI on the day's commits | Red. The first two voice commits failed 3 and then 2 calibration and mute checks; the 2 were outdated checks that still expected the browser's voice. On `1402009`, 185 browser tests passed and 1 failed: an offline guest couldn't start Quick Session, a real regression from batch 1 | GitHub Actions |
| Nov 5, `2bef108` | Batch 3 | 4,073 unit tests in 52 files, lint with 0 warnings, typecheck, build. In Chromium, Firefox and WebKit: 138 production guest checks, 78 clock, reward and completion checks (two repeats), the offline walkthrough 6 of 6, and 60 synthetic-camera checks before the closing fixes. First load 537,007 bytes, 172,020 gzip. The two clock failures and the offline failure were each reproduced before their fixes | Session notes |
| Nov 5, `2bef108` | CI | Green. 4,073 unit tests, 26 database tests, 46 function tests, 189 browser tests | GitHub Actions |
| Nov 5, `f485f07` | Batch 4 | 4,087 unit tests in 54 files, lint, typecheck, build. A real local Supabase applied every migration with `db push` and passed 33 database tests, 7 of them new: all-or-nothing reorder, credit once, two sessions both counted, refused inputs, anonymous callers denied. Guest checks in three browsers: 177 on the first pass, where 9 recovery checks caught guest logs failing on the new credit path. After the fix, the 114 recovery, guest-pass and completion checks and the offline walkthrough passed | Session notes |
| Nov 5, `f485f07` | CI | Red. 4,087 unit tests and 33 database tests passed. 184 browser tests passed and 5 failed, all specs that intercepted the old profile write | GitHub Actions |
| Nov 5, `03a4d30` | Batches 5 and 6, with the local Supabase CLI moved to CI's 2.122.0 | 4,108 unit tests in 59 files, lint with 0 warnings, typecheck, build, and a Deno check of `admin-users`. Full local stack: 38 database tests (12 new), 12 + 34 function tests, and 185 of 189 browser tests, the 4 failures being the specs above, whose focused reruns passed after the fix. Guest suites in three browsers: 177, plus the offline walkthrough. The 15-minute button sweep timed out once while other test runs shared the Mac, and passed alone in 9.7 minutes | Session notes |
| Nov 5, `03a4d30` | CI | Green. 4,108 unit tests, 38 database tests, 46 function tests, 189 browser tests | GitHub Actions |
| Nov 5, `f7dc10a` | Text-fit audit in Chromium and WebKit at seven widths | Every set name, all 234 badge and 52 glove labels, and the up-next name fit. 198 guest browser checks in Chromium, Firefox and WebKit. 4,108 unit tests, lint and typecheck | Session notes |
| Nov 5, `f7dc10a` | CI | Green. Lint with 0 warnings, typecheck, 4,108 unit tests in 59 files, build. A real local Supabase took all 45 migrations with `db push` and passed 38 database tests, 46 function tests against a fake AI provider and 189 browser tests | GitHub Actions run 42011319943 |
| Nov 5, `f7dc10a` | `npm audit --omit=dev` | 0 vulnerabilities | Run while writing this |

Most of the big count is generated from the XP and loadout data. It proves the math and the loadouts. It says nothing about whether a workout feels good.

### Numbers that disagree, on purpose

| Source | Rookie total to L100 | Formula |
|---|---|---|
| Origin Story PDF, chapter 5 | 14,276 | `BASE + COEFF × n^1.15` |
| Origin Story PDF, chapter 7 | 30,000 | `A × n^B`, A 142.70, B 0.200 |
| XP System PDF | 63,470 | Linear, `220 + n × 8.8` |
| Shipped `src/lib/xpSystem.ts` | 30,000 | A 180.50, B 0.1376 |

The PDFs are design history, not current numbers. The code wins.

## 7. Roads not taken

- **Inflating XP rates** to save the old curves. A jab is a jab.
- **Level 500, then 200.** Hard resets, soft resets, flat phases, piecewise curves and exponent swaps all failed. Level 100 stayed.
- **The compressed first session** (L5 to L3). The curve went flat. The version with seven level-ups in 40 minutes won.
- **Sensors as the entry fee.** The whole point is that you don't need them.
- **Personal calibration for Punch Check, for now.** I had the idea: throw about 3 of each punch so it learns your body and camera. On my own recording it scored 36 of 41 against 37 of 41 without it, so it didn't earn a place. Most of what's left is punches it never sees, and relabeling can't fix those. A recording from a second person or a new camera angle would be the fair test. The calibration that shipped on November 3 checks your setup and that it can see each punch. It doesn't retune anything.
- **Google, Apple and password sign-in.** All removed November 1. Email link only.
- **Loosening database rules so strangers could try it.** Guest data stays in the browser instead.
- **Staying on Lovable.** The clone moved to bring-your-own instead.
- **The TV framing.** "On air", "Go live" and the filler tickers went. Grind, Rest and Start are what a gym says.
- **Fight-card names on Home** (Main event, Co-main, Prelim, Weigh-in). "I don't need this at all." Dropped November 3.
- **Filming from chest height and up.** Nothing higher than a chair was to hand, so those spots are still unfilmed.

## 8. What it looks like

Home, Punch Check setup and the gloves, November 1, in guest mode on the live site. These are from a few hours before the Ringside redesign, so the live site looks different now:

<p>
  <img src="docs/images/home.png" alt="Home screen" width="260">
  <img src="docs/images/punch-setup.png" alt="Punch Check setup" width="260">
  <img src="docs/images/gloves.png" alt="Gloves" width="260">
</p>

Design documents from the build. They're design history, so their numbers differ from the shipped code, and the code wins:

- [XP Curves Origin Story](docs/history/xp-curves-origin-story.pdf), February 2026: how the progression system was built, broken and rebuilt.
- [XP System](docs/history/xp-system.pdf): the full XP and gamification design (63,470 here, 30,000 in `xpSystem.ts`).

## 9. My method

1. **Be the user, physically.** Change it, go do a round, come back with notes.
2. **Measure, then design.** If the numbers disagree with reality, the numbers move. Never inflate the input to save the model.
3. **Kill the requirement when the math keeps fighting you.** Six failed fits meant Level 500 was the bug.
4. **Turn your specs into tests.** The XP tables became thousands of generated checks.
5. **Write down what failed.** `timer_layout_final_fix.md` lists six wrong fixes so the seventh prompt can't repeat them.
6. **Reproduce it before you fix it.** The clock, offline and reward failures in batch 3 were each made to fail on the old code first, so each fix is proven against the real bug.

## 10. What's next

- Real-device sessions: my phone and my webcam, with a real bag, checking sound, counting at different bag spots, battery and heat. Synthetic cameras can't prove any of that.
- Record more people with `?record=1`, build a confusion table, then do more with the form data.
- Run the AI builder with a real model and a real key.
- Split the session screen and the builder further. Both are still over 1,100 lines, and the next split moves their stateful effects.
- Check the grants on a live hosted project. The security review read the migrations only.
- Coach-made presets, and testing with non-boxers.
- The coach marketplace, live streaming and a native app are placeholders I'm still finishing: live training and coach tools show as coming soon, and there's no native build yet.
- A potential partnership with a sensor company, and a potential growth strategy with pro fighters. Both are only potential, and I'm not naming names, for privacy reasons.
- Other training styles someday. The clock doesn't care if it's boxing.

## 11. Sources

- Commits: `git log` of `fidgetcoding/clocked-main`. CI: the GitHub Actions runs on `main`.
- Code: `src/lib/xpSystem.ts`, `src/lib/punch/`, `src/lib/voice/`, `public/voice/coach/`, `src/test/`, `tests/`, `supabase/migrations/`. Setup: `SETUP.md`. Engineering plan and open items: [docs/engineering/OPTIMIZATION-PLAN.md](docs/engineering/OPTIMIZATION-PLAN.md).
- Private, kept by me: chat records dated January 18 to April 18, 2026, and November 1 to 5, 2026. Call recording, April 13, 2026. `knowledge/clocked-todo.md`, `Advanced_Loadout_Bug_Report.md`, `timer_layout_final_fix.md`. Vision notes. XP PDFs above.
- Audit and test report, November 1, 2026 (session notes), the evidence logs from the November 4 and 5 batches, plus test runs made while writing this.
