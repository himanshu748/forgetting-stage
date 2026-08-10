# Native Configuration and Causal Forgetting Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** Make Android builds reach the configured live-generation service and RevenueCat SDK, then turn a genuinely evicted seed into an explicit two-actor contradiction in both live and deterministic offline performances.

**Architecture:** A small public-runtime configuration boundary will be the only place that reads Expo public environment variables, using direct `process.env.EXPO_PUBLIC_*` expressions so Metro can inline them. The existing client-owned demo engine remains in place for this sprint, but its string probe queue becomes structured state: each evicted seed schedules two actor responses, the session records the resulting replacements, and the stage UI renders the causal chain. Actor prompts retain delivery style but no longer re-inject the evicted identity/persona.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, Node's built-in test runner, RevenueCat React Native SDK.

**Workspace:** `/Users/himanshujha/Documents/Codex/2026-08-04/th/work/forgetting-stage-sprint` on branch `codex/day10-forgetting-loop`, based on `origin/main` at `766b0cc940debebffe66d1465066403404a73a29`.

## Constraints and non-goals

- Preserve the current five-round, 172-word demo pacing. A server-authoritative, serving-model-tokenized 1,000-token performance is a separate larger milestone.
- Do not send secrets to the app. Only `EXPO_PUBLIC_*` endpoint and RevenueCat public SDK keys belong in the bundle.
- Web may default to the same-origin `/api/generate`; iOS and Android must use an explicit absolute HTTPS generation endpoint.
- An invalid native endpoint must fail before `fetch`, with a stable typed error that the existing performance provider can surface as an honest offline fallback.
- The RevenueCat client must receive resolved public keys; it must not hold or indirectly index `process.env`.
- Persona/identity may exist in the seeded shared memory and in player-facing cast copy, but it must not be repeated in an actor's system prompt after the seed can be evicted.
- Every evicted seed schedules exactly two upcoming actor answers. The two offline answers must be deterministic, confident, and distinct.
- A single user advance still commits exactly one actor line. No hidden extra model requests.
- Preserve unrelated user work and existing monetization behavior.

---

### Task 1: Make native runtime configuration explicit and testable

**Files:**

- Create: `src/config/public.ts`
- Create: `src/config/public.test.ts`
- Modify: `src/live/client.ts`
- Modify: `src/live/client.test.ts`
- Modify: `src/monetization/revenuecat.ts`
- Modify: `src/monetization/revenuecat.test.ts`
- Modify: `App.tsx`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write failing public-config and live-client tests**

Add tests proving:

- web resolves an absent endpoint to `/api/generate`;
- native accepts an absolute `https://` endpoint;
- native rejects an absent, relative, or non-HTTPS endpoint as `LiveGenerationError` with code `unconfigured` before invoking the injected fetch;
- explicit RevenueCat key objects choose test, iOS, and Android keys without reading an environment object.

Run:

```bash
npm test -- src/config/public.test.ts src/live/client.test.ts src/monetization/revenuecat.test.ts
```

Expected: FAIL because the public config boundary and new native validation do not exist.

**Step 2: Implement the public configuration boundary**

In `src/config/public.ts`, define a serializable public config type and a `readPublicConfig()` function. Every value must be read with a direct expression such as `process.env.EXPO_PUBLIC_GENERATION_ENDPOINT`; do not alias `process.env`. Include generation endpoint and RevenueCat test/iOS/Android public keys. Add pure helpers for endpoint and platform-key resolution so tests do not need to mutate global environment state.

**Step 3: Enforce the native endpoint contract**

Update `createLiveGenerator` to accept the platform and the explicitly resolved endpoint. Keep the web same-origin default. For iOS/Android, validate before allocating a timeout or calling `fetch`; throw `LiveGenerationError('Live generation is not configured for this build', 'unconfigured')` for missing or invalid configuration.

**Step 4: Pass explicit RevenueCat keys**

Replace the RevenueCat client's `env` option with an explicit public-key object. Keep test-key precedence, web unconfigured behavior, configure-once behavior, purchasing, and restoring unchanged. Build both the live generator and RevenueCat client in `App.tsx` from `readPublicConfig()` and `Platform.OS`.

**Step 5: Align the Expo dependency and documentation**

Set `@react-native-async-storage/async-storage` to Expo 57's exact compatible version `2.2.0` and refresh the lockfile with:

```bash
npm install --save-exact @react-native-async-storage/async-storage@2.2.0
```

Add `EXPO_PUBLIC_GENERATION_ENDPOINT` to `.env.example`. Document that native requires an absolute HTTPS deployed gateway and that RevenueCat values are public SDK keys, not secret API keys.

**Step 6: Verify Task 1**

Run:

```bash
npm test
npm run typecheck
npx expo install --check
EXPO_PUBLIC_GENERATION_ENDPOINT=https://example.test/api/generate EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_public_key npx expo export --platform android --output-dir /tmp/forgetting-stage-task1-android
```

Expected: all tests and typecheck pass, Expo reports dependencies up to date, and the Android JavaScript export succeeds.

**Step 7: Commit Task 1**

```bash
git add src/config/public.ts src/config/public.test.ts src/live/client.ts src/live/client.test.ts src/monetization/revenuecat.ts src/monetization/revenuecat.test.ts App.tsx .env.example README.md package.json package-lock.json
git commit -m "fix: configure native generation and billing"
```

---

### Task 2: Make eviction cause two visible, distinct replacements

**Files:**

- Modify: `src/engine/types.ts`
- Modify: `src/engine/theater.ts`
- Modify: `src/engine/theater.test.ts`
- Modify: `src/engine/prompts.ts`
- Create: `src/engine/prompts.test.ts`
- Modify: `src/game/content.ts`
- Modify: `src/game/session.ts`
- Modify: `src/game/session.test.ts`
- Modify: `src/game/performance.ts`
- Modify: `src/game/performance.test.ts`
- Modify: `App.tsx`
- Modify: `README.md`

**Step 1: Write failing engine and prompt tests**

Add tests proving:

- an evicted seed queues two structured probes with the same lost seed identifier and response ordinals 1 then 2;
- consuming one probe leaves the second queued and consuming both exhausts that seed's probe;
- actor system messages include the character's stable delivery style but do not contain the seeded persona text;
- the probe instruction still demands a specific, completely certain answer.

Run:

```bash
npm test -- src/engine/theater.test.ts src/engine/prompts.test.ts
```

Expected: FAIL because probes are strings, characters lack a separate style field, and actor prompts re-seed persona.

**Step 2: Introduce structured probes and non-leaking actor style**

Add a `MemoryProbe` type carrying a copy of the lost seed, its instruction, and `responseIndex`/`responseCount`. Queue two probe entries whenever an unpinned seed is evicted. Return a copied structured value from `nextProbe()`.

Add a stable `style` field to each playable character. Split `CAST` so `persona` retains the identity fact placed in shared memory while `style` contains delivery-only cues. Update `actorMessages` to use the name and style but never the persona. Keep narrator behavior unchanged.

**Step 3: Write failing session and performance tests**

Add tests proving:

- `prepareGameBeat` returns the structured probe and remembers any evictions caused while adding its direction;
- committing a probed actor line records a snapshot event containing the lost seed and that actor's replacement;
- the next actor answers the same lost seed, producing a two-entry completed contradiction event;
- automatic direction evictions and generated-line evictions are aggregated rather than overwritten;
- offline fallback produces two deterministic replacements that differ in text and speaker, instead of using ordinary canned round lines;
- the live request transcript contains the probe direction while the actor system prompt does not independently restore the lost persona.

Run:

```bash
npm test -- src/game/session.test.ts src/game/performance.test.ts
```

Expected: FAIL because session snapshots have no contradiction event and offline fallback ignores probes.

**Step 4: Record the causal event through the session**

Define a snapshot-safe contradiction event containing the lost seed, prompt/instruction, up to two `{speaker, emoji, text}` responses, and a completion flag. `prepareGameBeat` stores the pending probe plus a copy of evictions triggered by its automatic direction. `commitGeneratedBeat` merges those evictions with line-triggered evictions, appends the actor's replacement to the correct event, and clears the pending state. Preserve turn order and the one-line-per-advance contract.

Do not let a user-authored director note masquerade as a probe. Reset or retain event state deliberately across opening, beat, direction, and curtain operations, and return defensive copies in `snapshotSession`.

**Step 5: Make offline probe responses deterministic and distinct**

When a pending probe exists, route offline fallback through a pure replacement generator keyed by premise, lost seed, speaker, and response index. The output must be one confident sentence, must not quote the forgotten seed text as truth, and must differ for the two scheduled responders. Ordinary unprobed turns continue using existing demo lines.

**Step 6: Render the forgetting chain on stage**

Add an accessible high-contrast stage card near the eviction notice that reads as a sequence:

1. what memory erased (speaker/category plus the lost seed text);
2. which actor supplied replacement one;
3. which actor supplied replacement two, or a clear `waiting for the next actor` state.

Use existing theatre colors and typography, keep the compact layout usable, and do not claim two contradictions until both responses exist. Change the generic seed label from `Identity lost` to distinguish a forgotten premise from a forgotten character fact.

**Step 7: Update product copy and verify Task 2**

Document the two-actor probe behavior without claiming a production-exact 1,000 model-token cap. Run:

```bash
npm test
npm run typecheck
npm run export:web
EXPO_PUBLIC_GENERATION_ENDPOINT=https://example.test/api/generate EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_public_key npx expo export --platform android --output-dir /tmp/forgetting-stage-task2-android
```

Expected: all tests and typecheck pass; web and Android JavaScript exports succeed; the normal five-round offline play reaches at least one completed two-response contradiction event.

**Step 8: Commit Task 2**

```bash
git add src/engine/types.ts src/engine/theater.ts src/engine/theater.test.ts src/engine/prompts.ts src/engine/prompts.test.ts src/game/content.ts src/game/session.ts src/game/session.test.ts src/game/performance.ts src/game/performance.test.ts App.tsx README.md
git commit -m "feat: stage two-actor memory contradictions"
```

---

## Final review and verification

After both task commits:

1. Review the complete diff from `766b0cc940debebffe66d1465066403404a73a29` for correctness, scope, error handling, prompt leakage, mobile configuration, and regression risk.
2. Fix every critical or important review finding and rerun affected checks.
3. Run the final commands:

```bash
npm test
npm run typecheck
npx expo install --check
npm run export:web
EXPO_PUBLIC_GENERATION_ENDPOINT=https://example.test/api/generate EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_public_key npx expo export --platform android --output-dir /tmp/forgetting-stage-final-android
git status --short
```

4. Native Gradle compilation is not part of this machine's executable verification until a JDK is installed. Record the exact environment limitation; do not describe it as a passing native build.
5. Present the branch integration options to the user. Do not push or merge without their choice.
