# Shipaton zero-spend track strategy

Last checked against the [official Shipaton overview](https://revenuecat-shipaton-2026.devpost.com/) and [official rules](https://revenuecat-shipaton-2026.devpost.com/rules) on 21 August 2026.

This file separates code, external configuration and observed evidence. A package in `package.json` is not proof that a sponsor track is eligible.

## Core submission gates

- The app must run on Android or another accepted platform and use RevenueCat for at least one purchase or RevenueCat Ads placement.
- The demonstration must show the app functioning on its target device, run for less than two minutes and be public on YouTube or Vimeo.
- Submit a 1024 by 1024 icon and at least one frameless 1179 by 2556 screenshot.
- Next Gen requires active student enrollment, a qualifying academic email, a public repository and a visible open-source license. It removes the paid store-account requirement.
- The current repository and MIT license support Next Gen. RevenueCat project `4c98413b` and one native Test Store purchase are verified on the Android 16 emulator. Student status, a physical-device restore and device footage remain unverified.

## Tracks to pursue

| Track | Why the product fits | Implemented proof | Evidence still required |
| --- | --- | --- | --- |
| Next Gen | A compact original AI game with an inspectable memory mechanism and open code | Public MIT repository, deterministic tests, exact-token server path | Qualifying academic email, student proof, native video and completed Devpost fields |
| Best Game | The player directs a three-actor improvised tragedy, pins one truth and watches two confident realities diverge | Ten-round replayable loop, three premises, pin, director note, contradiction report, genre-safe monetization timing and an observed native Test Store purchase | Physical-device play footage plus observed fun and polish |
| RevenueCat Design | The theatre metaphor is expressed through tickets, stage lighting, script cards, memory pressure and a curtain damage report | Responsive mobile-first interface, status language that distinguishes live AI from fallback and restrained transitions | Final physical-device visual pass, target-device screenshot and design notes for judges |
| HAMM | One free show per day creates habit without blocking discovery. A consumable encore serves occasional players and Director's Pass serves frequent players. No offer interrupts a performance | RevenueCat project `4c98413b`, daily ledger, configured `encore_ticket`, monthly, annual and lifetime products, `directors_pass`, lobby paywall plus observed native Test Store subscription and encore purchases | Physical-device reinstall and restore, production pricing plus truthful conversion results if any |
| #BuildInPublic | The exact-token rewrite, server-authority change and original Thousand-Token Theater lessons are a concrete public story | Public repository plus existing development posts | Add every post URL to Devpost, keep using `#Shipaton`, explain feedback and lessons without overstating progress |
| Growth Loop (Layers) | Audience: people who enjoy short AI storytelling games and return for a fresh daily disaster. Hypothesis: curiosity-focused curtain copy increases reminder opt-ins and next-day return | Layers Expo SDK, product events and `curtain_reminder_copy` feature flag with `free_show` and `curiosity` variants | Configure the App ID and flag, verify events on a native build, observe an experiment signal, record the result and next iteration |
| Keep Them Coming Back (OneSignal) | A single user-requested cue when tomorrow's free show opens is useful and does not spam the player | Native SDK, explicit post-curtain permission request, daily-curtain tag, last-premise tag and completion event | Publish a live app, configure FCM or APNs, deploy at least one campaign, verify receipt, provide OneSignal App ID and describe the campaign |

## Tracks not to claim yet

| Track | Reason |
| --- | --- |
| Catvertising | The current curtain card is a house message, not a RevenueCat Ads impression. Claim only after a real supported ad network, RevenueCat Ads and device evidence exist. |
| Grand Prize | Official shortlisting starts from real RevenueCat revenue and post-launch growth. The project has no verified launch or revenue yet. |
| Funnel Vision (Stripe) | Requires a live RevenueCat Funnel, Stripe checkout, a Stripe Project ID and qualifying payment volume. It also conflicts with the zero-spend, India-first submission path right now. |
| Most Viral (Noise) | Requires a live app and actual Noise promotion. Matching credits still require spending. |
| Idea to Income (Replit) | Requires building and publishing with Replit Agent plus RevenueCat, three public posts, a Replit preview URL and monetization momentum. This codebase is not a Replit build. |
| Ship Kotlin Everywhere (JetBrains) | Requires Kotlin Multiplatform or Compose Multiplatform and live iOS plus Android store URLs. Junie usage does not satisfy this category. |
| Best App for Galaxy | Requires a Galaxy Store release and Samsung-specific optimization. |
| Influencer categories | The product does not match the prescribed productivity, nutrition, fitness, career coaching or gaming backlog briefs. |
| Peace Prize | This is an entertainment game. Reframing it as social good would overstate the product. |

## Evidence order

1. Repeat the configured RevenueCat purchase on a physical target device, then reinstall and restore it.
2. Configure Layers, run the curtain copy flag and confirm native events reach its dashboard.
3. If a live app release is feasible, configure OneSignal and deploy one opt-in daily-curtain campaign.
4. Record the same native build completing a live AI play, a purchase and the curtain report.
5. Publish the video and record the exact dashboard IDs and public post URLs.

No step in this plan requires paid promotion, real payment volume or a paid developer account for the Next Gen path.
