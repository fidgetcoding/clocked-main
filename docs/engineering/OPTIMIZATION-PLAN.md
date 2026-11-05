# Clocked performance and reliability plan

Baseline: a00af26, November 4, 2026. This is an incremental engineering program, not a claim that every path is audited or optimized. Nate authorized the audit and implementation. Preserve the current product design and reward rules.

## Acceptance criteria

- No loss or duplication of guest/account workouts, history, XP, or saved sessions.
- Pause, skip, mute, navigation, and recovery cancel obsolete work.
- Measure the complete initial JavaScript dependency graph, not just the entry filename; report raw and gzip bytes. Route splitting must preserve direct links and reloads.
- Audio regressions run with fake audio or the silent browser harness; no real audio device tests.
- Changes to camera detection require recorded-data evaluation; synthetic tests do not establish real-world accuracy.
- Changes to database behavior require backend tests; local unit tests do not substitute for RLS checks.
- Every batch includes targeted regression tests, lint, typecheck, relevant browser coverage, and a production build. Record the exact remaining validation.

## Baseline and scope

386 files across src, supabase, scripts, and tests (includes non-code test data). The current production entry bundle is about 962 kB raw / 291 kB gzip, before this program. Confirm from saved baseline build when comparing.

Inspected directly: route composition, build config, workout announcement/timing effects, coach voice scheduling and tests, coach talk, camera lifecycle, pose model ownership, tracking publish loop, workout reads/writes/reordering, history reads and idempotent saves, auth transitions, JSON conversion, guest history storage, stats aggregation, CI structure. The remaining domains below are scheduled inspections, not findings asserted from filenames.

## Step 1: correctness and startup cost

### P1: recorded announcements can reorder

Evidence: src/lib/voice/coachVoice.ts starts independent async play calls; each waits for its own download/decode and updates endsAt afterward. A quick queued second clip can schedule before a slow first clip. Existing tests wait for the first clip before queueing, hiding this case.

Fix: preserve request order for recorded playback, retain generation-based cancellation, and ensure stop starts a fresh queue. Regression: deliberately resolve the second clip first and verify it cannot play ahead of the first. Also verify replacement speech does not wait for cancelled loading.

### P1: delayed combo survives its segment

Evidence: WorkoutSession.tsx schedules a 1.2-second timeout without cleanup in its announcement effect. A paused or replaced segment can still produce the old combo.

Fix: own the delayed call in an effect with cleanup and stable primitive dependencies. Check pause, skip, completion, and unmount; avoid cancelling valid calls on unrelated renders. This requires care because the existing effect also depends on potentially rebuilt objects.

### P1: reorder failures look successful

Evidence: useWorkouts.ts awaits Promise.all of Supabase responses but never checks each response.error. Supabase resolves error responses; mutation success can be reported after a rejected update.

Fix: check errors and reconcile cache on both outcomes. Partial writes remain possible until an atomic, user-scoped database operation is introduced. Follow with backend validation for RLS and concurrent reorders. Do not claim atomicity from a client-side fix.

### P2: pages load before they are visited

Evidence: App.tsx statically imports nearly every page; only Punch Check and the development lab use lazy imports.

Fix: split secondary routes at their natural page boundaries with an accessible loading fallback and the existing error boundary. Keep initial home/auth/onboarding choices deliberate. Measure entry plus static shared chunks, inspect dynamic chunks, and test navigation and direct loads against a production build.

## Step 2: persistence and authentication

- Reproduce slow initial getSession versus later sign-out/sign-in events. AuthContext.tsx currently applies the initial promise result without an event-generation guard.
- Reproduce late profile responses after account switch. syncProfileToStore currently writes after await without confirming the user is still current.
- Audit JSON trust boundaries: fromJson<T> is a type assertion, not runtime validation. Add parsers with backward-compatible defaults at actual persisted-data boundaries.
- Review localStorage quota, corruption, schema migrations, and write frequency; preserve exportable/recoverable guest data.
- Keep history's existing stable-ID duplicate handling and lazy punch-log detail fetch.
- Profile history/stat queries with large accounts. Confirm pagination design retains all-time totals before limiting rows.
- Review cache keys, stale time, abort signals, archived-workout eagerness, and account isolation. Avoid a blanket stale-time setting without a freshness contract.

## Step 3: workout engine and render cost

- Map Build.tsx (1,866 lines) and WorkoutSession.tsx (1,453 lines) into pure transforms, persistence adapters, timing effects, and presentation.
- Extract behind behavior tests in small commits. Avoid a wholesale rewrite.
- Profile React commits during active timer, camera, pause, segment transition, and reward display; record p50/p95 and workload/device.
- Audit broad store subscriptions and unstable query defaults before adding memoization.
- Review every timeout, interval, animation callback, and subscription owner.
- Retain wholeSecondsSince wall-clock correction. Test delayed/background ticks across multiple segment boundaries, clock changes, screen lock, and reload recovery.
- Bound useCoachTalk's pace sample retention after measuring its growth and preserving average/recent pace semantics.
- Make announcements deterministic across pause/resume and preference changes; ensure a slow preload cannot trigger obsolete speech.

## Step 4: camera and inference

- Measure inference time, processed FPS, render FPS, memory, and UI responsiveness with camera off/on, calibration, and long workouts.
- Review pending start/stop/start ownership. usePunchCamera can have async video/model operations in flight; test every exit and shared-model reference count.
- Review GPU-to-CPU fallback after stop/unmount, model retry, track-ended events, and browser visibility behavior.
- Existing positives: no microphone request, model loads after camera permission, light sampling once per second, shared model retention, HUD refresh separated from per-frame inference.
- Consider adaptive frame budgeting or a worker only after establishing an actual bottleneck and detector sensitivity to sampling rate.
- Evaluate any detector change on held-out recordings. Real-bag and multiple-person validation remain separate from code performance.

## Step 5: backend, security, and network

- Inspect every edge-function input, auth/role check, CORS rule, AI response validator, timeout/retry, and error response.
- Audit migrations and RLS with account A/account B/anonymous/admin cases, including storage policies.
- Check query plans and indexes with realistic data sizes. Do not add speculative indexes.
- Audit duplicate-submit/idempotency behavior for session saves, rewards, profile updates, and concurrent tabs.
- Check production dependencies and lockfile advisories; assess upgrades individually against browser/device requirements.
- Inspect AI request cancellation and retry semantics so a timeout cannot create duplicate chargeable work.

## Step 6: delivery and test quality

- CI currently starts a full backend stack on every push; inspect where its ~33-minute historical duration is spent before changing coverage.
- Consider cancelling superseded runs per branch, caching safe dependencies, and splitting independent checks. Keep backend/Firefox coverage required.
- Strengthen tests that can pass without observing the intended behavior. The earlier voice warm-up false-positive is the model failure to avoid.
- Add production navigation/load smoke coverage and a measured bundle budget once the new baseline is stable.
- Inspect stale-deployment/chunk failures and recovery UX; no automatic reload loops.
- Keep a batch ledger with commits, commands, results, measurements, and remaining work.

## Execution and rollback

Implement Step 1 in small tested batches, then proceed in priority order. A risky change stays isolated until its behavior is reproduced and verified. Code/data backups are under /Users/nathandavidovich/WORK/CLOCKED-OPTIMIZATION-20261104; git commits provide independent rollback points. No database migrations in the first batch.

## Status

- Audit: initial cross-system pass complete; detailed backend, security, and device profiling remain open.
- Implementation: Step 1 in progress.
- No measured claim yet about runtime FPS, battery, or network latency.

## Batch 1 implementation results

Implemented:
- Eleven secondary routes now load on demand, with a visible accessible loading state.
- Recorded playback preserves call order when clips resolve out of order; stop resets the pending playback chain.
- A temporarily unavailable audio context no longer permanently poisons the decoded-clip cache.
- Reordering checks Supabase errors and invalidates cached workouts after success or failure; existing UI now receives its error callback correctly. This does not make multiple row writes transactional.

Regression evidence: all three new tests failed against the prior behavior, then passed after their respective fixes. Existing test assertions were preserved. Local total: 4,039 tests in 48 files passed; lint and typecheck passed.

Production build measurement: initial JS 962,407 → 535,760 bytes (44.3% reduction). Gzip using the same measurement method: 289,508 → 171,356 bytes (40.8% reduction). These numbers cover the static dependency graph of the entry, not deferred routes. Reproduce with `npm run build -- --manifest` and `node scripts/bundle-report.mjs`. This is a transfer-size result, not a measured LCP/FPS improvement.

Production dependency audit: npm audit --omit=dev reported zero known vulnerabilities on November 4, 2026. This is not a security certification or a development-dependency audit.

Additional backend inspection confirmed request validation, a database RPC for generation quota, AI request timeout, output validation, and admin-role checks already exist. The detailed RLS/concurrency/security review remains open. Admin listing requests a maximum of 1,000 auth users; pagination and partial query error handling need inspection before calling that flow scalable.

Next batch: cancelled delayed combo announcements; stale auth/profile async results; atomic reorder design. Then profile runtime before structural screen decomposition and camera optimizations. No detector, XP formula, database policy, or schema changes in Batch 1.

Browser validation for Batch 1: 41 Chromium checks passed against the production preview, covering guest presets, builder behavior, history/stat views exercised by guest regressions, session reload/resume, discard/save, unchanged XP across reload, no-backend behavior, phone/laptop mute, and decoding all 180 recordings. Camera-specific cases were excluded because this was a production build without injected test poses; no camera code changed. Hosted backend and Firefox verification remain CI work.

## Batch 2: auth races, voice lifecycle, and stronger browser checks

- Initial session reads cannot overwrite a later auth event. Profile results cannot populate a signed-out account, a different account, or an unmounted provider. INITIAL_SESSION still synchronizes the profile.
- Sign-out reports Supabase errors to the existing Settings error UI. An old sign-out response cannot erase a newer sign-in.
- Segment announcements have a dedicated lifecycle hook. Preparation no longer consumes the first announcement. Delayed combos cancel on pause, skip, mute, preference change, completion, and unmount; ordinary renders keep the valid timer. Recovery/resume do not repeat the announcement.
- Pause/back/skip/restart explicitly stop queued speech; restarting resets announcement history.
- The silent browser harness traces a fetched recording through decoding into source playback, so downloads alone cannot satisfy a voice assertion. Calibration checks every punch recording on phone and laptop, plus the synthetic-voice fallback separately.
- Browser Play locators wait for the workout transport after lazy navigation. A URL change alone can leave the home card visible long enough to click it twice.

Validation: 4,054 tests in 50 files, lint with zero warnings, typecheck, and production build passed. The production preview passed 82 Chromium/Firefox checks for guest flows, recovery, persistence, XP and voice, plus two explicit first-announcement/pause checks. Synthetic-camera calibration passed six Chromium cases, and seven voice cases passed in the development pose-feed build. These tests stay silent and never use a real camera or microphone.

CI follow-up: earlier full-stack run 41786926161 passed 182 browser cases and failed two outdated calibration assertions that expected synthetic speech instead of recordings. Batch 2 corrects those assertions with stricter playback evidence and retains a separate fallback case. The full backend run for this batch must finish before treating backend verification as complete.

Remaining audit findings: getSession rejection UX still needs review; camera start/stop/start can overlap pending model acquisition and CPU replacement; reorder still needs a transactional design; JSON persistence boundaries still rely on casts. No claim of completed whole-codebase optimization or physical-device accuracy.

### Additional verification and measurements

- WebKit: 61 cases passed initially. The remaining camera-cleanup assertion used an instance-level stop spy that WebKit discarded across native wrappers. Inspection confirmed the track was actually ended. The corrected test asserts a live track before leaving and an ended track afterward; it passed on Chromium, Firefox, and WebKit. This changes test observation, not camera implementation.
- Live site: phone/laptop mute and all 180 recording decodes passed. The pause-cancellation test also passed after explicitly waiting for the recording preload, so it tests recorded playback rather than racing the manifest's synthetic fallback.
- Local runtime sample: production preview, headless Chromium, 390×844, camera off, silent audio, no CPU/network throttling. Three 10-second samples (running, paused, resumed after skip) yielded approximately 60 animation callbacks/second, p95 callback gaps of 16.7–16.8 ms, and zero observed tasks over 50 ms. This measures animation callback cadence on this Mac, not physical-device rendering, inference performance, battery life, or a before/after speedup. Raw results: WORK/CLOCKED-OPTIMIZATION-20261104/runtime-sample.json.
- Entry module inspection identifies drag-and-drop, routing, styling utilities, toast UI, and onboarding among the large retained dependencies. Keep keyboard/touch behavior intact before considering changes. The current entry is 536,023 raw bytes; the correctness fixes retained the earlier approximately 44% reduction.
- Additional persistence review: history lists omit heavy punch detail and load it on demand; guest detail is capped to the newest 20 sessions, and individual punch logs cap detailed entries at 5,000. Preserve these limits. Profile/XP writes and preset seeding still need cross-tab concurrency tests; client-side guards alone are not database transactions.

## Batch 3: camera ownership and recovery boundaries

- Starting a camera again stops the previous stream first. A stopped video startup cannot acquire a model afterward. Pending frame callbacks are cancelled on stop and unmount.
- One hook holds one model lease, including while loading or replacing the GPU. Restart shares that pending work; unmount releases it exactly once. Late results cannot revive an obsolete run.
- Shared model holders follow the CPU replacement through a stable handle. Concurrent recovery requests share one replacement; a replacement arriving after disposal is closed immediately.
- Saved sessions validate nonnegative finite clock/XP values, integer segment bounds, reward-log flags, and optional history identity before offering recovery. Older saves without historyId and Quick Sessions without segments remain supported.
- Initial auth lookup rejection now exits loading into guest mode with an explanation. A newer auth event takes priority over late failures.
- Coach pace retention is bounded to 17 samples at one sample per second. The first sample and the 15-second boundary preserve the round-wide average and recent pace; a one-hour simulation matches the untrimmed history. Pace checks no longer copy/reverse the history.

Validation: 4,069 unit tests in 51 files, lint with zero warnings, typecheck, and production build passed. Production recovery/voice checks: 57 passed across Chromium, Firefox, and WebKit. Synthetic camera/calibration checks: 59 passed initially; Firefox Punch Check missed a synthetic uppercut, then passed unchanged on a focused rerun. Further repetition is recorded below before release. No physical-camera accuracy claim.

The earlier full backend run 41792639895 (commit 1402009) stopped after 72 backend tests and 169 browser cases with a runner shutdown signal (exit 143). Its rerun finished November 4 with 185 browser tests passed and one failed: the offline guest walkthrough. That failure is resolved below. Docker is not running locally. No database schema or policy changed in this batch; atomic reorder and profile concurrency remain open.

Current entry: 536,686 raw bytes / 172,340 gzip bytes (bundle-report.mjs). Logs and backups: WORK/CLOCKED-OPTIMIZATION-20261104/batch3. The browser tests use silent audio and synthetic streams.

### Batch 3 closeout: session clock and offline training

- **Clock carry lost at segment changes (app bug).** The timer effect depended on the current segment and the preparation flag, so every natural transition restarted the interval and reset the last-tick time, discarding the partial second already counted. In WebKit, React commits later than the fake clock fires, so a 25-second run recorded 24 and stayed a quarter-second behind afterwards. Reproduced with a stepped probe before the fix. The interval now restarts only on play/pause and reads segments, streak multiplier and XP rates through a ref. Manual skip and back still start the new segment on a fresh second.
- **Clock test read a transitional snapshot (test bug).** A single long tick crosses segments one render at a time, and the spec compared the first snapshot that reached the trained total. WebKit showed fast-forward at segment 0 with -15 s remaining; one second later it matched the regular clock. The spec now waits until the position settles (time remaining above zero, or complete) before comparing segment, time, log and XP.
- **Offline guest could not start a session (app regression from Batch 1).** Lazy loading kept the Workout and Quick Session screens out of the entry bundle, so a guest who opened the app and then lost the connection could not open them. The router kept the home screen while the chunk failed, which is why CI timed out clicking a home card. Reproduced locally on the pre-fix build at the same line. Both screens are now fetched once the first screen is idle, so they stay out of the entry bundle and still work offline afterwards.
- **Calibration fixture and reward expectations.** The synthetic uppercut timing aliased at 24/25 fps; a sampling-safe helper with 24/25/30/60 fps coverage replaces it, and the production detector is unchanged. The prep-reward spec now advances only the 30-second preparation and expects the First Combo badge it actually earns.

Validation for the closeout is recorded in EVOLUTION.md. Not covered: physical-device camera, battery and sustained performance; a local Docker backend run (Docker unavailable). The hosted backend CI on the release commit is the backend gate.

