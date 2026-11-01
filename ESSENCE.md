# Clocked, on one page

**Try it live, no login: <https://clocked-main.vercel.app>** (camera form guide at [/punch-check](https://clocked-main.vercel.app/punch-check))

**What it is.** A boxing and shadowboxing training app: a multi-phase workout clock with combo callouts, an XP and prestige game on top, an AI workout builder, and a camera form guide that runs on your device. It's a React web app. No account needed to try it. For accounts and the AI model, you bring your own Supabase project and AI key.

**Who it's for.** Anyone who wants to throw punches with structure and has nothing but floor space. Beginners who don't know what a 1-2 is. People who already train and are bored of plain interval timers.

**Why it exists.** I wanted to shadowbox, and the serious tools started at $1,500 of sensor hardware. I built a clock by directing AI, tested it by running downstairs and doing a round, added XP one day, and got hooked on my own level-ups.

**What's different.**
- It starts from shadowboxing. Equipment is a bonus, never the entry fee.
- The XP math is calculated from real workouts, combo by combo, not guessed. That rebuild is the best story in the repo.
- Punch Check needs only a phone or laptop camera, and the video stays on the device.
- I'm not an engineer. I built it by directing AI tools, and the commit history shows all of it: Lovable first, and now a clone developed only in Claude Code.

**How to try it.** `git clone https://github.com/fidgetcoding/clocked-main && cd clocked-main && npm ci && npm run dev`, then open the address Vite prints. Onboard as a guest. Camera at `/punch-check`. For the backend, follow [SETUP.md](SETUP.md).

## What works today

- **Guest mode:** onboarding, building and running workouts, manual logs, history, stats, XP, badges and presets, all stored in the browser. Nothing reaches a backend unless you add one.
- **Rewards:** XP and badges go by what a session really did. Short sessions don't count as sessions, and the level curve and combo math stayed as they were.
- **Backend, on real hosted Supabase:** all 40 migrations, the row-level rules, the deployed functions and a real emailed link signing in. The AI function has run against a fake provider.
- **Punch Check:** live count, combo readout, one cue at a time and a round summary, on your device. On a labeled recording of me, it labeled 24 of 29 held-out reps what the prompt asked for, in one session, and that number is optimistic. 192 of 192 cross-browser checks passed on simulated cameras, in Chromium, Firefox and WebKit.
- **Tests, from a fresh clone of `9dda0c8`:** 3,832 unit tests, lint with 0 problems and a clean production audit. CI on that commit adds 43 browser tests, 23 database tests and 46 function tests against a real local Supabase.

The coach marketplace, live streaming and a native app are placeholders I'm still finishing: live training and coach tools show as coming soon, and there's no native build yet.

See [EVOLUTION.md](EVOLUTION.md) for how it got here.
