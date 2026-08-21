# Title

The Forgetting Stage

## One-line Summary

An AI improvisational theatre game where three actors confidently rewrite facts that fall out of an exact 1,000-token shared memory, while the player chooses one truth that survives.

## Problem

Most AI storytelling products treat inconsistency as a defect and hide how context changes over time. That makes the stories feel disposable and gives the player little influence beyond writing another prompt.

The Forgetting Stage asks a different question: what if forgetting were the game mechanic? A deliberately small memory can turn model drift into visible comedy, but only if the erasure is real, the contradictions are caused by it and the player can understand what happened.

## Solution

The player selects a premise and directs a three-actor improvised performance. The cast shares a bounded script. As new lines arrive, the oldest unpinned beats are evicted. The player may pin exactly one actor line, preserving it outside the memory allowance.

When a seeded fact disappears, the server asks the next two actors the same specific question. Both must provide confident, distinct replacements without acknowledging the gap. The curtain report groups the erased fact and both incompatible answers, making the causal chain visible.

One complete performance is free each local day. A RevenueCat encore supports occasional repeat plays and the Director's Pass entitlement supports frequent players. No offer interrupts an active performance.

## Why This Matters

The game turns an abstract limitation of generative models into something playful and legible. Players do not need to understand context windows to feel the tension between the one protected truth and a story that keeps renegotiating everything else.

It also demonstrates a more inspectable AI interaction: the app distinguishes exact server memory from estimated offline memory, displays forgotten facts and refuses to claim a successful forgetting event when the required evidence did not occur.

## How We Used AI

The configured live path uses a Hugging Face text-generation model as the cast. The server owns the complete performance state and constructs each prompt from the post-eviction memory snapshot. The client sends only actions such as start, advance, pin, direct and finish. It cannot submit a transcript, choose a speaker or restore an erased fact.

The server loads the tokenizer for the same model ID used for generation. Unpinned memory is capped at exactly 1,000 model tokens with special tokens disabled. One pinned actor line is intentionally stored outside that allowance. Once a seeded fact is evicted, structured prompts force two consecutive actors to invent specific confident replacements.

The deterministic offline preview preserves the game loop when live generation is unavailable. It is visibly labeled `OFFLINE PREVIEW`, and its counter says `EST. TOKENS` rather than presenting an approximation as exact AI evidence.

## How We Used Codex

Codex acted as the implementation orchestrator. It audited the PRD against the existing code, identified that the original mobile demo trusted a client transcript and used an approximate 172-word budget, then rebuilt the loop around a server-owned performance store and action-only contract.

Codex implemented and reviewed the exact tokenizer path, eviction probes, recovery rounds, access-state race fixes, native sponsor adapters and the theatrical mobile interface. It ran 122 unit and integration tests, TypeScript checks, Expo Doctor, Android autolinking, web and Hermes exports, two native Gradle builds, secret scanning and an Android 16 emulator judge-path preflight. Official Expo development-client skills guided the native workflow. Earlier branch fixes also used Junie CLI for cast and access regressions.

Codex kept unverified claims out of the product and submission notes. It did not invoke paid model inference or an EAS cloud build during the zero-spend validation pass.

## Key Features

- Server-authoritative AI performance with an action-only mobile contract
- Exact 1,000-token unpinned memory using the serving model's tokenizer
- Exactly one protected actor line that never evicts
- Three premises, a three-actor company and ten scheduled rounds
- Player director notes plus fast theatrical cues
- Forced two-actor contradiction probes after a genuine seed eviction
- At most two recovery rounds, followed by an honest retry state if forgetting never occurs
- Curtain report connecting each forgotten fact to two incompatible replacements
- One free daily performance, paid encore handling and Director's Pass purchase and restore paths
- Opt-in OneSignal curtain reminder integration
- Layers growth events and a `free_show` versus `curiosity` reminder-copy experiment
- Responsive black, cream, gold and ember theatre direction across mobile and web

## Architecture

The Expo and React Native client renders the lobby, stage, memory meter and curtain report. It owns presentation state and a clearly labeled deterministic fallback, but not live performance truth.

`POST /api/generate` exposes a narrow action contract. A process-local server store owns the canonical session, current actor, beats, pinned line, probes and curtain eligibility. The gateway validates each action, builds a prompt from the authoritative post-eviction snapshot, invokes Hugging Face when configured, commits the result and returns the new snapshot.

The pure theatre engine performs memory accounting, eviction, pins and contradiction tracking. RevenueCat manages purchase and entitlement state. AsyncStorage maintains the daily free-ticket ledger. OneSignal and Layers are optional native adapters that fail open when their public App IDs are absent.

The current process-local performance store and limiter are appropriate for one persistent preview server. A public scaled deployment requires a durable shared store and quota.

## Testing Instructions

Prerequisites: Node.js, npm and an Android SDK plus JDK 17 for the native path.

```bash
npm ci
npm test
npm run typecheck
npx expo-doctor
npx expo install --check
npx expo-modules-autolinking verify --platform android
```

Run the web preview:

```bash
npm run web
```

Run the Android development client:

```bash
npx expo run:android
```

Without `EXPO_PUBLIC_GENERATION_ENDPOINT`, native play intentionally uses the offline preview. Live verification additionally requires a deployed HTTPS gateway with a server-only `HF_TOKEN`. RevenueCat purchase testing requires the Test Store flag, a public Test Store SDK key and configured products. Full evidence steps are in `docs/submission/device-validation.md`.

Observed locally on 21 August 2026:

- 122 of 122 tests passed
- TypeScript passed
- Expo Doctor passed 20 of 20 checks
- Expo dependency alignment and Android autolinking passed
- Web and Android Hermes exports passed
- Android API 36 debug development-client and release-mode builds passed
- An Android 16 emulator fresh launch opened the daily ticket, entered the offline performance and advanced Meera to Arun without a fatal error
- A RevenueCat Test Store offering loaded in the native development client, a simulated monthly Director's Pass purchase completed and the app displayed `DIRECTOR'S PASS ACTIVE`
- RevenueCat customer history recorded the sandbox subscription and both the configured `directors_pass` entitlement and the temporary setup-wizard entitlement became active
- Gitleaks found no committed secrets

## Public Demo Link

TODO: add the public target-device build or store URL if the final route requires one. The Next Gen route does not require a store listing, but it still requires the public video and source code.

## Public Repository Link

https://github.com/himanshu748/forgetting-stage

The repository is public and carries an MIT license.

## Demo Video

TODO: upload a public YouTube or Vimeo video under two minutes.

Planned outline:

1. `0:00-0:10`, introduce the one-memory theatre premise on a physical Android device.
2. `0:10-0:25`, select a premise and open the free daily curtain.
3. `0:25-1:15`, show live exact-token status, pin one truth, send one direction, trigger a seed eviction and reveal both confident replacements.
4. `1:15-1:38`, show the curtain damage report and how the protected line survived.
5. `1:38-1:52`, demonstrate the RevenueCat Test Store Director's Pass or restore state.
6. `1:52-2:00`, show the public repository and summarize the server-authoritative design.

Use only project-owned visuals and audio. Do not represent the offline preview as live inference.

## Screenshot Shot List

1. Required native 1179 by 2556 frameless screenshot: performance view with `AI LIVE · EXACT 1K`, the memory meter and a pinned truth visible.
2. Lobby: premise ticket, company and free daily curtain.
3. Forgetting event: erased seed plus both confident replacements on one screen.
4. Curtain report: the surviving pin and drift summary.
5. Director's Pass: configured Test Store offering or active entitlement, only after it is observed on the target device.

Existing assets:

- `assets/icon.png`, verified at 1024 by 1024 and ready to attach.
- `assets/forgetting-stage-web-showcase.png`, verified at 1179 by 2556 but usable only as web-build evidence. It is not the required native screenshot.

## Submission Readiness Notes

Devpost project `1373927` is published at https://devpost.com/software/the-forgetting-stage with the title, tagline, full description, Built With list, repository URL and 1024 by 1024 project thumbnail populated. It is not submitted to RevenueCat Shipaton and still has no public demo video.

The fastest zero-spend route is the Next Gen Award. The participant has supplied an academic email for the final Devpost form, and the full address is intentionally kept out of this repository. Devpost may still verify active enrollment. This route accepts the public source repository and target-device video instead of a public store listing.

Code implementation, the local native preflight and the RevenueCat Test Store purchase are credible. The packet is not ready for final submission because live target-device AI evidence, a physical-device purchase and restore, native media and student verification are still missing.

Official deadline: 1 October 2026 at 06:45 UTC, which is 30 September 2026 at 11:45 PM Pacific and 1 October 2026 at 12:15 PM IST.

## Known Limitations

- No paid live model completion was invoked during the zero-spend validation pass.
- The live HTTPS gateway is not deployed and its state store is process-local.
- RevenueCat project `4c98413b`, the current Test Store offering, the `directors_pass` entitlement, encore product and a simulated native subscription purchase are configured and observed. Restore is covered by automated tests but has not been observed after a physical-device reinstall.
- OneSignal has no verified App ID, FCM setup, deployed campaign or received notification.
- Layers has no verified App ID, dashboard event or observed experiment response.
- The emulator preflight is not a physical target-device test.
- The native screenshot and public demo video are missing.
- npm audit reports no critical vulnerabilities, with 8 moderate and 8 high transitive Expo or Metro toolchain advisories remaining.

## TODO Official Form Fields

Required fields:

- [ ] `assets/icon.png` is the Devpost project thumbnail. Confirm **Includes App Icon** only after verifying that Devpost accepts it as the required attachment.
- [ ] Capture and attach a native frameless 1179 by 2556 screenshot, then confirm **Includes screenshot**.
- [x] Select **Android** for the app type.
- [x] RevenueCat project ID ready for the final form: `4c98413b`.
- [ ] Add the public YouTube or Vimeo demo video.
- [x] Fill the Devpost title, tagline, full description and Built With list.

Next Gen fields:

- [x] Repository URL: https://github.com/himanshu748/forgetting-stage
- [x] Academic email received for the final Devpost form. Keep the full address out of public files; active-enrollment verification remains with Devpost.

Track answers to finish:

- [x] **Best Game**, use the prepared answer below.
- [x] **RevenueCat Design**, use the prepared answer below.
- [x] **HAMM**, describe the free daily show, consumable encore and observed Test Store Director's Pass flow.
- [x] **Build in Public**, use the verified post URLs and prepared answer below.
- [ ] **Keep Them Coming Back**, enter the OneSignal App ID and describe one deployed campaign only after receipt is verified.
- [ ] **Growth Loop**, report the Layers audience, hypothesis, variants, measurable signal, learning and next experiment after dashboard observation.

Fields to leave blank unless the product changes materially: Grand Prize growth, Peace Prize, Catvertising, Influencer Award, Ship Kotlin Everywhere, Most Viral App, Best App for Galaxy, Idea to Income and Funnel Vision.

## Prepared Custom Answers

These values are ready to paste into the final Shipaton form. Do not submit them until the missing screenshot and public video gates are complete.

### Core fields

- App type: `Android`
- Next Gen repository: https://github.com/himanshu748/forgetting-stage
- Next Gen academic email: use the qualifying address supplied privately by the participant. Do not copy it into this public file.
- RevenueCat project ID: `4c98413b`
- Promo code: leave blank. The Next Gen demo should show the RevenueCat Test Store flow directly.
- First Version Date Confirmation: leave unchecked for the Next Gen route because there is no public store release.
- Is Staff or Sponsor: leave unchecked.
- Growth Fund opt-in: ask the participant at final review because this is an optional external program choice.

### Build in Public Award

Building in public created an audit trail for the product's hardest claims. Early posts separated the deterministic engine from live AI, then showed the 2D theatre direction, the daily-ticket monetization model and the later Junie-assisted Android work. Writing each update forced me to distinguish implemented code from configuration or device evidence that was still pending. That public constraint directly improved the submission: the final app labels offline fallback as estimated, keeps purchases out of active scenes and records exact verification steps instead of presenting scaffolding as a finished store build.

Public progress links:

- https://x.com/jhahimanshu653/status/2083233437423686014
- https://x.com/jhahimanshu653/status/2083831589826437458
- https://x.com/jhahimanshu653/status/2084673118807961747
- https://x.com/jhahimanshu653/status/2085040442354397648
- https://x.com/jhahimanshu653/status/2086304381637648775

### HAMM Award

The Forgetting Stage uses a three-tier theatre model. Every player gets one complete performance each local day, which makes the core loop understandable before any purchase. An `encore_ticket` is a consumable extra show for occasional players. The `directors_pass` entitlement unlocks unlimited performances for frequent players. The box office can open in the lobby or after the curtain, but a showtime guard prevents purchase offers from interrupting an active play. This structure fits a short replayable improv game: scarcity creates anticipation, the encore matches a one-more-run impulse and the pass serves repeat use without withholding the first experience. RevenueCat project `4c98413b` has monthly, annual, lifetime and encore Test Store products. A simulated monthly native purchase activated the entitlement on Android. There is no real revenue or conversion result yet, so none is claimed.

### RevenueCat Design Award

The interface treats the phone as a small black-box theatre rather than a generic chat screen. Cream paper tickets sit against a near-black stage, gold marks the one protected truth and ember marks facts that fell out of memory. Lines arrive as cast beats, not message bubbles. The exact 1,000-token meter makes pressure visible, while the curtain report places an erased fact beside two incompatible confident replacements so the player can read cause and effect at a glance. Monetization uses the same world: the daily curtain is a ticket, the paywall is a box office and the premium state is a Director's Pass. Offers never enter an active scene. Motion is restrained to entrances, cues and curtain transitions so the text remains the performance.

### Best Game Award

The Forgetting Stage is a replayable AI improv game about controlled memory failure. The player chooses one of three premises and directs a three-actor company through a ten-round play. Every new line consumes the cast's exact shared 1,000-token memory. Old unpinned facts are evicted, but the player can protect exactly one actor line. When a seeded fact disappears, the next two actors answer the same question with different confident inventions. The final damage report reveals the lost fact, both replacements and the one truth that survived. The art direction is a 2D black-box theatre built from paper tickets, stage darkness, gold cues and ember damage marks. One free daily show fits the short-session genre, an optional encore supports one-more-run play and the Director's Pass supports frequent players. The box office is blocked during performances so monetization never breaks the scene.

### Additional notes for judges

This is a Next Gen entry with a public MIT-licensed repository. The live architecture is server-authoritative: the mobile client sends actions, not a transcript, and the server counts memory with the tokenizer for the same model used for generation. The deterministic fallback is clearly labeled and is not presented as live AI. RevenueCat Test Store purchase evidence was observed on an Android 16 emulator, while the final video and screenshot must come from the target Android device. Codex orchestrated the implementation and verification, and Junie contributed earlier cast, paywall-guard and Android-scaffolding changes that are documented in the public build thread.
