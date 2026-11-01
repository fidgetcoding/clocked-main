![Clocked](docs/images/banner.png)

# Clocked

**A boxing app where all you need is you, your phone and the air in front of you.**

## ▶ [Try it live, no login: clocked-main.vercel.app](https://clocked-main.vercel.app)

Jump straight to the camera with [Punch Check](https://clocked-main.vercel.app/punch-check). The live copy runs in guest mode, so accounts and the AI builder need your own backend.

**Want the real story?** [ESSENCE.md](ESSENCE.md) is the one-pager. [EVOLUTION.md](EVOLUTION.md) is every round of how this got built, including the parts that broke. The original design docs, the [XP system](docs/history/xp-system.pdf) and its [origin story](docs/history/xp-curves-origin-story.pdf), are design history, so where their numbers differ from the code, the code wins.

## What it is

Clocked runs your rounds, calls your combos, levels you up while you sweat, and watches you shadowbox through your camera to tell you one thing to fix at a time. No account needed. No bag. No $1,500 sensor rig.

It's a workout clock that grew into a whole training game. You build a workout out of phases and segments (warmup, rounds, conditioning, cooldown), and the timer walks you through it with bells, voice callouts and your combos on screen. Punches are numbered like a real gym, 1 through 8, with slips and rolls mixed in. Levels, ranks and prestige tiers stack on top.

It's a web app you can use right now as a guest. Everything you do as a guest stays in your browser. For accounts, clubs and the AI builder's model, you bring your own Supabase project and AI key. I don't host a backend for anybody.

It started in Lovable. Now it's a clone developed only in Claude Code.

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
- **Try Punch Check:** go to `/punch-check`, start the camera, and throw. Turn a little to one side of the camera. Dead straight on hides your jab and cross, and I'd rather tell you that here than have you think you're bad at jabbing.
- **Want accounts and the AI model?** Bring your own Supabase project and AI key, and follow [SETUP.md](SETUP.md). It has a block you can paste straight into a coding agent. Sign-in is an email link and nothing else.

Checked on 2026-11-01 from a fresh clone of `9dda0c8`: `npm ci`, lint with 0 problems, typecheck, the build and 3,832 unit tests all pass, and the production audit is clean. CI on that commit also runs 43 browser tests, 23 database tests and 46 function tests against a real local Supabase. The backend also ran on real hosted Supabase from a local build: the 40 migrations at that point, the row-level rules, two deployed functions and a real emailed link signing in.

## What's in it

- **The clock:** workouts, phases and segments, with bells, voice countdowns, and time you can add or cut mid-round.
- **Boxing notation:** 1 to 8, plus defense and movement, with a tap-to-build combo builder that starts simple and opens up as you level.
- **XP while you train:** 5 prestige tiers, 100 levels each, 10 ranks, double XP in championship rounds. Rewards follow the clock: preparation doesn't count, and sessions under 5 minutes earn no badges.
- **Punch Check:** on-device pose tracking in the browser. Counts punches, reads your combo, and calls one form cue at a time. Video never leaves your device. It's a form guide from one camera angle, so it can't judge power and it's no coach.
- **AI workout builder:** say what you want in plain words. With your own Supabase and AI key it's built to go to a model. As a guest it builds on your device and says so.
- **Fight Club:** presets anyone can save. Clubs and the feed need an account.
- **Workout log, stats, streaks, badges and gloves,** each with its own art.

The coach marketplace, live streaming and a native app are placeholders I'm still finishing: live training and coach tools show as coming soon, and there's no native build yet.

## License

Code is [MIT](LICENSE). Built by Nate Davidovich.

The Clocked logo and the glove and badge art in `public/art/` aren't covered by MIT.
