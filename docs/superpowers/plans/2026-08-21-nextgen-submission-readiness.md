# Next Gen Submission Readiness Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task by task.

**Goal:** Turn the current credible Expo proof of concept into an honest, testable RevenueCat Shipaton Next Gen package without adding speculative features.

**Architecture:** Preserve the five-round causal-forgetting game and its offline fallback. Harden startup so local daily access does not fail when RevenueCat is temporarily unavailable, keep billing configuration explicit and add truthful submission documentation and current product evidence. Dashboard configuration, student proof, native device evidence and Devpost publishing remain external gates.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 6, Node's built-in test runner, RevenueCat React Native SDK.

**Workspace:** `/Users/himanshujha/Documents/Codex/2026-08-04/th/work/forgetting-stage-sprint` on branch `codex/day10-forgetting-loop`.

## Global Constraints

- Do not claim a live model request, RevenueCat purchase, restore, native install, student status or Devpost submission without observed evidence.
- Preserve the current five-round causal-forgetting loop and deterministic offline fallback.
- Never place `HF_TOKEN` or secret RevenueCat API keys in the mobile bundle or repository.
- Only `EXPO_PUBLIC_*` endpoint and RevenueCat public SDK keys may enter the Expo bundle.
- Keep the repository public and MIT licensed for the Next Gen route.
- Do not add sponsor SDKs, ads or new categories solely to increase category count.
- Preserve unrelated work. Workers are not alone in the codebase and must accommodate existing edits.

---

### Task 1: Make startup resilient to independent storage and RevenueCat failures

**Files:**

- Create: `src/monetization/bootstrap.ts`
- Create: `src/monetization/bootstrap.test.ts`
- Modify: `App.tsx`

**Requirements:**

- Extract a small testable bootstrap function that loads the daily ledger and refreshes RevenueCat independently.
- A ledger failure must still allow RevenueCat state to load.
- A RevenueCat refresh failure must still preserve the daily ledger and compute the free-performance state.
- Both failures must return the same honest unconfigured monetization fallback used today.
- App startup must apply the bootstrap result without an all-or-nothing `Promise.all` catch.
- Add deterministic tests for success, each isolated failure and both failures.

**Verify:**

```bash
npm test
npm run typecheck
```

---

### Task 2: Replace stale public evidence and add a device submission runbook

**Files:**

- Modify: `README.md`
- Create: `docs/submission/device-validation.md`
- Create: `assets/forgetting-stage-web-showcase.png`

**Requirements:**

- Replace the broken README image reference with a current generated screenshot of the real lobby.
- State clearly that the screenshot is the web build and is not the official target-device submission screenshot.
- Add an exact device checklist for an EAS Android preview build, fresh install, complete five-round play, Test Store purchase, entitlement unlock, restore and offline recovery.
- Include the official required capture dimensions, 1179 by 2556 without a device frame, and the under-two-minute public video constraint.
- Keep dashboard identifiers and URLs as explicit TODOs rather than invented values.

**Verify:**

```bash
test -f assets/forgetting-stage-web-showcase.png
rg -n "1179|2556|two-minute|RevenueCat project ID" README.md docs/submission/device-validation.md
npm test
npm run typecheck
```

---

### Task 3: Keep the Android lobby below the status bar

**Files:**

- Modify: `App.tsx`

**Requirements:**

- Preserve the existing iOS and web safe-area behavior.
- On Android, offset each screen shell by the runtime native status-bar height so the wordmark and stage controls never render behind system icons.
- Keep the Expo status-bar appearance configuration explicit.
- Do not add a dependency for this bounded fix.
- Verify the standalone release APK on the Android 36 emulator and visually confirm the wordmark clears the status bar.

**Verify:**

```bash
npm test
npm run typecheck
NODE_ENV=production ./android/gradlew :app:assembleRelease
```

---

### Task 4: Final branch and submission-readiness review

**Scope:**

- Review the full branch against the Global Constraints and official Next Gen requirements.
- Re-run tests, typecheck, Expo dependency validation, web export and Android JavaScript export.
- Re-run tracked-file and Git-history secret scans.
- Verify the public GitHub repository and MIT license.
- Report external blockers without fabricating completion.
