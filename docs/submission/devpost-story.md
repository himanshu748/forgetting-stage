## What it does

The Forgetting Stage is an AI improv game where three actors share a memory capped at 1,000 model tokens. You choose the premise, direct the performance and save one actor line. As new dialogue arrives, older unpinned facts disappear.

When a seeded fact is erased, the next two actors answer the same question. Each has to invent a confident replacement. At curtain, the report puts the lost fact beside both answers and the one line you protected.

## Why I built it

I wanted forgetting to be something the player could see and influence. The project grew from my Thousand-Token Theater experiment into a small theatre with a cast, a daily ticket and a visible record of what went wrong.

The hardest part was making the forgetting real. An early version relied on approximate word counts and client-supplied context. I moved the live performance state to the server, used the serving model's tokenizer and added tests for eviction, pinned lines and contradictory answers.

## How it works

The Expo and React Native app sends actions such as start, advance, pin, direct and finish. The server owns the live transcript and builds each prompt after evicting old memory. One pinned actor line sits outside the 1,000-token allowance.

The live generation path uses Hugging Face. If generation is unavailable, the app labels its deterministic fallback as offline and labels its memory count as estimated. An offline rehearsal also lets players learn the mechanics without spending their daily AI ticket.

The current source includes editable character names, backstories and speaking styles, animated paper-puppet actors, director cues and a curtain report. Cast edits are saved locally and apply to later performances.

## RevenueCat

RevenueCat powers the native box office: a consumable encore ticket and a Director's Pass entitlement for unlimited performances. One AI performance is free each local day, and purchase offers stay outside an active scene.

On September 25, a real cloud Pixel 7 Pro running Android 13 displayed RevenueCat's Test Store purchase dialog. A simulated monthly purchase activated Director's Pass and unlocked unlimited performances. Earlier Android testing also observed a simulated encore purchase. These are sandbox transactions, not revenue. Restore handling exists and has automated tests, but a successful physical-device reinstall-and-restore flow is not claimed.

## What is verified

On September 25, the submission source passed 133 automated tests, TypeScript checking and an Expo web export after a clean dependency install. A secret scan found no leaks in the Git history or updated source.

That day's native cloud tests opened the cast editor, pinned Meera's line and completed an offline rehearsal on Pixel devices. The curtain report showed 18 forgotten beats and one protected line. The demo combines edited native recordings with labeled still captures. Its gameplay uses a prepared offline script; live Hugging Face generation is not running in that recording.

Earlier Android emulator testing observed live Hugging Face narrator and actor responses, a pinned line and the authoritative model-token meter. The attached August 21 native screenshot records that earlier build; it is not a new physical-phone capture.

OneSignal and Layers adapters are present in the code. A delivered OneSignal campaign and an observed Layers dashboard experiment are not verified, so I am not claiming those sponsor categories.

## How I built it

I am the sole participant. Codex helped with implementation, debugging and verification. Junie CLI contributed to earlier cast, access-guard and Android-scaffolding work.

## Source and testing

This is a Next Gen entry with public MIT-licensed source instead of an app-store listing.

Submission branch: https://github.com/himanshu748/forgetting-stage/tree/codex/nextgen-submission-20260925

Run `npm ci`, `npm test` and `npm run typecheck` from that branch. `npm run web` provides a browser preview. The Android app needs a custom native build for RevenueCat; live AI also needs a configured generation gateway and server-side model credentials. Without them, use the explicitly labeled offline rehearsal.

The server currently keeps performance sessions in process memory. A scaled deployment needs durable shared state and quotas. No production store release, paid-user traction or successful physical-device restore is claimed.
