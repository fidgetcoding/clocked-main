![Clocked](docs/images/banner.png)

# Clocked

**A boxing app where all you need is you, your phone and the air in front of you.**

## ▶ [Try it live, no login: getclocked.io](https://getclocked.io)

Jump straight to the camera with [Punch Check](https://getclocked.io/punch-check). The live copy runs in guest mode, so accounts and the AI builder need your own backend. It's also at [clocked-main.vercel.app](https://clocked-main.vercel.app).

**Want the real story?** [ESSENCE.md](ESSENCE.md) is the one-pager. [EVOLUTION.md](EVOLUTION.md) is every round of how this got built, including the parts that broke. The original design docs, the [XP system](docs/history/xp-system.pdf) and its [origin story](docs/history/xp-curves-origin-story.pdf), are design history, so where their numbers differ from the code, the code wins.

## What it is

Clocked runs your rounds, calls your combos in my voice, levels you up while you sweat, and watches you shadowbox through your camera to tell you one thing to fix at a time. No account needed. No bag. No $1,500 sensor rig.

It's a workout clock that grew into a whole training game. You build a workout out of phases and segments (warmup, rounds, conditioning, cooldown), and the timer walks you through it with bells, voice callouts and your combos on screen. Punches are numbered like a real gym, 1 through 8, with slips and rolls mixed in. Levels, ranks and prestige tiers stack on top.

It's a web app you can use right now as a guest. Everything you do as a guest stays in your browser, and once it's loaded you can keep training offline. For accounts, clubs and the AI builder's model, you bring your own Supabase project and AI key. I don't host a backend for anybody.

It started in Lovable. Now it's a clone I build by directing AI coding agents: Claude Code, plus one day of Codex.

## Why I made it

I wanted to shadowbox with a real structure, and every serious option wanted my money first:

> "You have to buy like $1,500 worth of hardware. Like you need to buy like a custom heavy bag with sensors on it and all this stuff. And it just wasn't built for the shadow boxing community."

So I started building a clock. Then I'd test it the only way that counts:

> "I was literally upstairs. I'd code it. I'd run downstairs. I'd do a round and I'd test it. And one day I decided to add a gamification system to it."

> "And the dopamine of leveling up started hitting me so hard."

That was it. That's the app.

## Try it

You need Node and npm. That's the whole list.

```sh
git clone https://github.com/fidgetcoding/clocked-main
cd clocked-main
npm ci
npm run dev
```

Open the address Vite prints, walk through onboarding, and you're in. No sign-up. Your progress lives in that browser.

- **Hit a workout:** tap the play button on your loadout, or build your own with **Create Set**.
- **Just want a clock?** **Quick Session** starts one with no plan. Turn the camera on and it logs every punch, combo, round and cue.
- **Try Punch Check:** go to `/punch-check` and start the camera. Calibration runs first: it checks your setup, has you hold your guard, then asks for one of each punch. Skip it if you're in a hurry. Prop the phone in front of you at hip height, 6 to 10 feet back. If a bag's in the way, go just far enough around to see past it, because behind the bag it can't see you. On the floor it counts but adds a few extra and names fewer, and from behind you it misses some punches and can't name any. I'd rather tell you that here than have you think you're bad at jabbing.
- **Want accounts and the AI model?** Bring your own Supabase project and AI key, and follow [SETUP.md](SETUP.md). It has a block you can paste straight into a coding agent. Sign-in is an email link and nothing else.

Checked in CI on `f7dc10a`, November 5: lint with 0 warnings, typecheck, 4,108 unit tests and the build all pass. Then CI starts a real local Supabase, applies all 45 migrations with `db push`, and passes 38 database tests, 46 function tests against a fake AI provider and 189 browser tests. `npm audit --omit=dev` found 0 vulnerabilities the same day. The backend also ran on real hosted Supabase from a local build on November 1: the 40 migrations at that point, the row-level rules, two deployed functions and a real emailed link signing in.

## What's in it

- **The clock:** workouts, phases and segments, with bells, voice countdowns, and time you can add or cut mid-round.
- **My voice in your ear:** I recorded the coach myself, 180 takes for 174 lines: punch names, defense, round calls and encouragement. Any line I haven't recorded falls back to the browser's voice. One tap mutes it on every screen that talks.
- **Boxing notation:** 1 to 8, plus defense and movement, with a tap-to-build combo builder that starts simple and opens up as you level.
- **XP while you train:** 5 prestige tiers, 100 levels each, 10 ranks, double XP in championship rounds. Rewards follow the clock: preparation doesn't count, and sessions under 5 minutes earn no badges. With an account, the server credits each session once, so a retried save or a second tab can't count it twice.
- **Punch Check:** on-device pose tracking in the browser. Calibrates first, then counts punches, reads your combo, and calls one form cue at a time. The tracking dots only show while it calibrates. Video never leaves your device. It's a form guide from one camera angle, so it can't judge power and it's no coach.
- **AI workout builder:** say what you want in plain words. With your own Supabase and AI key it's built to go to a model. As a guest it builds on your device and says so.
- **Fight Club:** presets anyone can save. Clubs and the feed need an account.
- **Workout log, stats, streaks, badges and gloves,** each with its own art. A workout survives a reload, and hand-logged workouts count toward your totals.

The coach marketplace, live streaming and a native app are placeholders I'm still finishing: live training and coach tools show as coming soon, and there's no native build yet.

## Under the hood

- **App:** React 18, TypeScript, Vite 6, Tailwind and React Router 7, with Zustand and TanStack Query for state.
- **Camera:** MediaPipe's pose model runs in your browser. The punch detector, combo reader, form cues and calibration on top of it are in `src/lib/punch/`, tuned on recordings of me. `npm run punch:confusion` scores a recording.
- **Voice:** the clips are in `public/voice/coach/`, and every spoken line has an id in `src/lib/voice/lines.ts`. `npm run voice:script` writes the recording script, and `npm run voice:import` cuts one long take into clips (it needs ffmpeg).
- **Backend:** Supabase. 45 migrations with row-level rules in `supabase/migrations/`, and two edge functions, `generate-workout` and `admin-users`. Session credit, workout reorders and completion counts each happen in one database function call.
- **Tests:** Vitest unit tests in `src/test/` (most of the count is generated from the XP and loadout tables), Playwright browser tests in `tests/e2e/`, and `npm run test:stack`, which brings up a throwaway local Supabase and runs the database, function and browser suites against it. It needs Docker and the Supabase CLI. CI runs all of it on every push to `main`.
- **Engineering notes:** the optimization plan, batch by batch, with what's still open: [docs/engineering/OPTIMIZATION-PLAN.md](docs/engineering/OPTIMIZATION-PLAN.md).

## License

Code is [MIT](LICENSE). Built by Nate Davidovich.

The Clocked logo and the glove and badge art in `public/art/` aren't covered by MIT.
