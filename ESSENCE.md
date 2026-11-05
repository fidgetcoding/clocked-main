# Clocked: the essence

**Try it live, no login: <https://getclocked.io>** (camera form guide at [/punch-check](https://getclocked.io/punch-check), also at [clocked-main.vercel.app](https://clocked-main.vercel.app))

**What it is.** A boxing and shadowboxing training app: a multi-phase workout clock that calls your combos in my recorded voice, an XP and prestige game on top, an AI workout builder, and a camera form guide that runs on your device. It's a React web app. No account needed to try it. For accounts and the AI model, you bring your own Supabase project and AI key.

**Who it's for.** Anyone who wants to throw punches with structure and has nothing but floor space. Beginners who don't know what a 1-2 is. People who already train and are bored of plain interval timers.

**Why it exists.** I wanted to shadowbox, and the serious tools started at $1,500 of sensor hardware. I built a clock by directing AI, tested it by running downstairs and doing a round, added XP one day, and got hooked on my own level-ups.

**What's different.**
- It starts from shadowboxing. Equipment is a bonus, never the entry fee.
- The XP math is calculated from real workouts, combo by combo, not guessed. That rebuild is the best story in the repo.
- Punch Check needs only a phone or laptop camera, and the video stays on the device. It calibrates before every camera session, and it counts from wherever you can prop the phone around a bag.
- The coach is me. I recorded 180 takes for 174 lines in one sitting, and one tap mutes it on every screen that talks.
- I'm not an engineer. I built it by directing AI tools, and the commit history shows all of it: Lovable first, then a clone built in Claude Code, with one day of Codex.

**How to try it.** `git clone https://github.com/fidgetcoding/clocked-main && cd clocked-main && npm ci && npm run dev`, then open the address Vite prints. Onboard as a guest. Camera at `/punch-check`. For the backend, follow [SETUP.md](SETUP.md).

**What works today.**
- **Guest mode:** onboarding, building and running workouts, Quick Session, manual logs, history, stats, XP, badges and presets, all stored in the browser. Once the app has loaded, the training screens keep working offline. Nothing reaches a backend unless you add one.
- **Rewards:** XP and badges follow the clock. Preparation doesn't count, sessions under 5 minutes earn no badges, and credit only goes to the kinds of training a session had. With an account, the server credits a session once, so a retry or a second tab can't count it twice.
- **Backend:** CI on `f7dc10a` (November 5) applies all 45 migrations to a real local Supabase and passes 38 database tests and 46 function tests against a fake AI provider. On November 1 it also ran on real hosted Supabase from a local build: the 40 migrations at that point, the row-level rules, two deployed functions and a real emailed link signing in. The AI function has only run against a fake provider.
- **Punch Check:** calibration, then a live count, combo readout, one cue at a time and a round summary, on your device. On November 1, on a labeled recording of me, it labeled 24 of 29 held-out reps what the prompt asked for: one person, one camera, one session, and that number is optimistic. On November 3, across 18 laptop takes of me shadowboxing from the floor and from a chair, one fix took mean count accuracy from 52% to 80% on the floor and 67% to 80% on the chair, each checked on the height it wasn't tuned on. Still one person, and no bag.
- **Speed:** the first load's JavaScript went from 962,407 to 535,760 bytes (44.3%) on November 4. That's measured on the build, not on a phone.
- **Security:** a read-only review on November 5 found nothing above low severity, and its fixes shipped the same day.
- **Tests:** CI on `f7dc10a`: lint with 0 warnings, typecheck, 4,108 unit tests in 59 files and the build, then 189 browser tests against the real local backend. `npm audit --omit=dev` found 0 vulnerabilities the same day.

The coach marketplace, live streaming and a native app are placeholders I'm still finishing: live training and coach tools show as coming soon, and there's no native build yet.

See [EVOLUTION.md](EVOLUTION.md) for how it got here.
