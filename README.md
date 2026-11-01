# Clocked

Knockout Intelligence: a boxing trainer that lives in your browser and yells combos at you so your coach can have a day off.

## ▶ [Try it live, no login: clocked-main.vercel.app](https://clocked-main.vercel.app)

Jump straight to the camera with [Punch Check](https://clocked-main.vercel.app/punch-check). The live copy runs in guest mode, so accounts and the AI builder need your own backend.

Open it and start swinging. There's no account wall, no signup, no "enter your email to see the workouts." Everything you do is saved right there in your browser until you decide you'd like an account.

## What's in the corner

- **Workouts that fit your gear.** Tell it what you've got and it builds a loadout for it. No heavy bag? Shadowboxing never hurt anybody.
- **A real round timer.** Voice callouts, combo prompts, rest periods, and a countdown that doesn't care how tired you are.
- **A builder for your own sets,** by hand or by describing what you want.
- **Progress worth bragging about.** XP, levels, streaks, badges and an unreasonable number of gloves to unlock.
- **Fight Club,** for sharing workouts and joining clubs, once you've signed in with an email link.

## Run it

```sh
npm install
npm run dev
```

That's the whole thing. With no backend configured you get the full solo app, saved in your browser.

Want accounts, Fight Club and AI-built workouts? You host those yourself, on your own Supabase. No shared database here: [SETUP.md](./SETUP.md) walks you through it, and has a block you can paste straight into a coding agent.

## Under the hood

React, Vite, TypeScript, Tailwind and Supabase. Tests run with `npm test`.

## License

MIT for the code. See [LICENSE](./LICENSE). The Clocked logo and the glove and badge art in `public/art/` aren't covered by MIT.
