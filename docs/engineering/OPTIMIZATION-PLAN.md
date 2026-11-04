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
