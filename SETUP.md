# Set up your own Clocked

Clocked runs with nothing at all: `npm install`, `npm run dev`, and you've got the whole solo app, saved in your browser.

This guide is for the rest: accounts, Fight Club and AI-built workouts. You host those yourself, on your own Supabase project. There's no shared database and nothing here connects to anyone else's copy, so your fighters and their data are yours to look after.

Every step is optional past step 2. Stop whenever you've got what you want.

Rather have an agent do it? Skip to [Paste this to your agent](#paste-this-to-your-agent).

## What you'll need

- Node 20 or newer
- A free [Supabase](https://supabase.com) account
- The [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), version 2.122 or newer
- Later on, optionally: an API key from an AI provider, a [Vercel](https://vercel.com) account, and an SMTP provider

## 1. Create your database

Make a new project in the [Supabase dashboard](https://supabase.com/dashboard), then from the repo:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Your project ref is the random-looking part of your project's URL. `db push` applies every file in `supabase/migrations`: tables, security rules, the avatars bucket, and a starter club.

## 2. Connect the app

```sh
cp .env.example .env.local
```

Fill in `.env.local` with your project's values from **Project Settings > API Keys** in the dashboard:

```sh
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_PROJECT_ID=YOUR_PROJECT_REF
```

The publishable key is safe in a browser: the database's security rules do the protecting. Never put a `sb_secret_` or `service_role` key in a `VITE_` variable, because anything with that prefix ships to every visitor.

`.env.local` is ignored by git, so it stays on your machine.

## 3. Let the email link come home

Email links only work if Supabase trusts where they point. A new project's Site URL is `http://localhost:3000`, and local links to `localhost:8080` work with that as it is, so you can skip this until you have a real address.

Once you do, open **Authentication > URL Configuration** in the dashboard and set:

- **Site URL:** where your app lives, such as `https://your-app.example`
- **Redirect URLs:** add `https://your-app.example/onboarding?continue=true` and, for local work, `http://localhost:8080/onboarding?continue=true`

Miss this and links land on your Site URL instead of finishing sign-in. If that's still the default, they open `localhost:3000`, where nothing is running.

**About email delivery:** Supabase's built-in email is only for trying things out. It delivers to your project's team members, and its limit is tight: on my test project, the send right after my first one was already refused. Before inviting anyone else, [set up custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Now run `npm run dev`, open <http://localhost:8080>, and sign in from **Settings > Save your progress**. A new account's email is titled "Confirm your email address", and its link lands on the "Who are you?" step. A returning account goes straight home.

## 4. Turn on AI workouts

This is the only part that costs money, and it's fully optional. Without it, the builder makes workouts on the device from what you type.

```sh
supabase functions deploy generate-workout
supabase functions deploy admin-users
supabase secrets set AI_API_KEY=YOUR_KEY
```

That's enough if your key is from [Google AI Studio](https://aistudio.google.com/apikey), since Gemini is the default. Any OpenAI-compatible provider works if its chat endpoint accepts `max_tokens`:

```sh
supabase secrets set AI_BASE_URL=https://your-provider.example/v1 AI_MODEL=your-model-id
```

| Setting | Default |
| --- | --- |
| `AI_API_KEY` | None. Without it the function answers 503 and the app uses its on-device parser. |
| `AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `AI_MODEL` | `gemini-3.8-flash` |
| `AI_TIMEOUT_MS` | `90000` |

Each signed-in user gets 25 AI generations a day, so a stranger can't run up your bill. To change that, edit `DAILY_GENERATION_LIMIT` in `supabase/functions/generate-workout/index.ts`. Guests never call the AI.

## 5. Make yourself an admin

Sign in once so your account exists, then copy your user ID from **Authentication > Users** in the dashboard and run this in the **SQL Editor**:

```sql
insert into public.user_roles (user_id, role) values ('YOUR_USER_ID', 'admin');
```

That unlocks `/admin` for you and nobody else.

## 6. Put it on the internet

On [Vercel](https://vercel.com), import your repo and keep the Vite defaults. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PROJECT_ID` under **Settings > Environment Variables**, then deploy. Leave them out and you get a working solo app with no accounts.

`vercel.json` already sends every route to the app, so a link to `/onboarding` works on a fresh page load. Any static host works if it does the same.

Two finishing touches:

- Set your live URL as the Site URL from step 3, and add it to the Redirect URLs.
- In `index.html`, change `og:image` and `twitter:image` to the full address of `og-image.png`. Most link previews won't load a relative path.

## When something's off

| What you see | What it means |
| --- | --- |
| "NO BACKEND CONFIGURED" on the sign-in page | The `VITE_` variables weren't set when the app was built. Set them and rebuild. |
| The email link opens your homepage, not signed in | The redirect URL isn't on the allow list. Back to step 3. |
| The email link opens `localhost:3000` | Your Site URL is still the default. Back to step 3. |
| `Email address "..." is invalid` on the sign-in page | Supabase refused that address before sending anything. Placeholder domains like `example.com` get this. Use a real address. |
| No email arrives | You've hit the built-in email's limits. Back to step 3. |
| "Too many email requests" | Rate limited. On the built-in email that can take up to an hour to clear. |
| `permission denied for table` (code 42501) | Migrations are missing. Run `supabase db push` again. |
| AI workouts feel basic and nothing errors | The function is off or out of quota, and the on-device parser took over. Check your function logs. |

## Paste this to your agent

```text
Set up Clocked in this repo on my own Supabase project, following SETUP.md. Work through it in order and verify each step before moving on.

Rules:
- This is my own project. Never point it at anyone else's database.
- Stop and ask me whenever a step needs a login, a dashboard click, a payment, or a key. Tell me exactly where to click.
- Never print, commit or log a secret. Put values in .env.local, or in `supabase secrets set`. Only the publishable key may go in a VITE_ variable.
- Don't edit existing files in supabase/migrations.
- Ask before deploying anything public.

Steps:
1. Check Node is 20+ and the Supabase CLI is 2.122+. Run `npm install`.
2. Ask me to create a project and give you its ref. Have me run `supabase login` myself, then run `supabase link` and `supabase db push`.
3. Create .env.local from .env.example. Ask me to paste the publishable key.
4. Local sign-in works with the default Site URL. If I have a live address, tell me the exact Site URL and Redirect URLs to add under Authentication > URL Configuration, and wait until I confirm.
5. Run `npm run build` and `npm test`, then `npm run dev`. Ask me to sign in with an email link and confirm I land on "Who are you?".
6. Ask whether I want AI workouts. If yes, deploy the functions and have me set AI_API_KEY myself with `supabase secrets set`.
7. Ask whether I want to be an admin. If yes, tell me where to find my user ID and give me the SQL from step 5.
8. Ask whether I want it on Vercel. If yes, walk me through it, then remind me to set the live URL as the Site URL, add it to the Redirect URLs, and make og:image absolute.

Finish by telling me what's working, what you skipped, and what I still need to do.
```

## Testing it against a real backend

`npm test` runs the fast tests. This one needs Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started):

```sh
npm run test:stack
```

It starts a throwaway local Supabase with a random project ID, applies every migration, serves the edge functions against a fake AI provider, and drives the app in a real browser, including clicking the sign-in link in the local mail catcher. It removes everything it created when it's done, and it never talks to hosted Supabase or a real AI provider.

To pick a different CLI binary, set `SUPABASE_BIN`. If you only need the browser once, run `npx playwright install chromium` first.
