# Android device validation and evidence checklist

Use this runbook only on a physical Android device with an EAS Android preview build. It records the actions required to create honest submission evidence. Do not mark an item complete until it has been observed on that device.

## Local Expo preflight, not submission evidence

Observed on 21 August 2026 with Expo SDK 57.0.15 and the official Expo development-client workflow:

- `npx expo install --check` and Android Expo autolinking verification passed. The native graph includes Expo Dev Client, RevenueCat, Layers and OneSignal.
- A local arm64 debug development-client APK built successfully with Android API 36. Artifact: 66 MB, SHA-256 `11a6689edd19d1c018c228dcf5f153d8f64d0f5532a3aaf33a397afb321f38b9`.
- A separate release-mode bundle built successfully. An emulator-only copy was zip-aligned and signed with the checked-in debug certificate so it could be launched without Metro. Artifact: 31 MB, SHA-256 `1024508a99a3c7b3623477edc168e69b40bc897ec70763109e9a53441189486b`. Do not distribute this artifact as a release.
- The `fs_pixel` Android 16 emulator cold-launched the app, granted a fresh daily curtain, entered a performance and advanced from Meera to Arun without a fatal native or React Native error.
- With no generation endpoint configured, the app visibly reported `OFFLINE PREVIEW`, labeled the local counter `EST. TOKENS` and explained that live AI was unavailable. This proves fallback honesty, not live AI, a Layers event or a OneSignal campaign.
- A later native emulator run used a temporary Cloudflare HTTPS preview backed by the server-only Hugging Face key. `Qwen/Qwen3-4B-Instruct-2507` returned `source: model` for the narrator and Meera, the app displayed `AI LIVE · EXACT 1K`, the counter reported 178 of 1,000 model tokens and Meera's line was pinned. The clean candidate capture is `assets/forgetting-stage-native-live.png` at exactly 1179 by 2556 pixels. This proves the native live path, not persistent deployment or physical-device video.
- Metro later launched the development client with the ignored local RevenueCat Test Store configuration. The current offering returned the encore and Director's Pass packages. A simulated valid `monthly` purchase activated `directors_pass` in the app. After an app-data reset, a simulated valid `encore_ticket` purchase was recorded as an unattached consumable and granted a local encore. Both appeared in RevenueCat sandbox customer history. No real payment occurred.
- A reinstall-style app-data reset and Restore purchases attempt did not reactivate the short Test Store subscription. The app now reports that no active pass was found instead of failing silently. This remains a failed restore observation, not restore evidence.
- The physical-device and configured-service evidence below remains required. The emulator observation is not a substitute for the required target-device video or reinstall-and-restore proof.

## Submission record, fill after observation

- RevenueCat project ID: `4c98413b`
- RevenueCat Test Store public SDK key: configured in an ignored local `.env`; it is intentionally not copied into this public record
- Deployed generation endpoint URL: `TODO: record the HTTPS endpoint used by the preview build`
- OneSignal App ID and campaign: `TODO: record only after a message is deployed and received`
- Layers App ID and experiment: `TODO: record only after native events are observed`
- Android development build evidence: `Local emulator preflight recorded above; TODO: record the physical-device artifact hash or a confirmed zero-cost EAS URL`
- Test Store product or package: current `default` offering with `encore_ticket`, `monthly`, `yearly` and `lifetime`; simulated `monthly` and `encore_ticket` purchases observed on the Android 16 emulator
- Public media URL: `TODO: add the published demo video URL`

The checked-in app does not expose dashboard keys or establish that the remaining external services are configured. A Test Store key is for development and preview builds only, never an app-store release. This project declares `react-native-purchases` 10.6.0, which meets Test Store's React Native SDK minimum of 9.5.4. EAS preview builds use EAS-managed Android credentials. Direct release builds do not select the debug certificate by default. The optional `-PallowDebugReleaseSigning=true` property exists only for local emulator validation and its APK must never be distributed as a release.

## Prepare the preview build

1. In the RevenueCat dashboard, create the Director's Pass Test Store product and package. Attach that product to the `directors_pass` entitlement, then add the package to the current offering. Record the RevenueCat project ID and Test Store public SDK key in the submission record only after verifying them.
2. Configure `EXPO_PUBLIC_REVENUECAT_USE_TEST_STORE=true` and the Test Store public SDK key as `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` for the EAS preview environment. Production must set the flag to false or omit it.
3. Before public gateway deployment, configure a hard Hugging Face spending limit and either a durable shared request quota or server-verifiable performance authorization. The checked-in in-memory limiter is only per serverless instance.
4. Deploy the generation gateway to an HTTPS URL, then configure that URL for the EAS preview environment as `EXPO_PUBLIC_GENERATION_ENDPOINT`. Keep the endpoint URL as a TODO until it has been observed in the completed preview configuration.
5. Configure `EXPO_PUBLIC_LAYERS_APP_ID`, create the `curtain_reminder_copy` flag with `free_show` and `curiosity` variants and keep ATT prompting disabled for this test.
6. Configure `EXPO_PUBLIC_ONESIGNAL_APP_ID` only after the native OneSignal app and FCM or APNs credentials exist. Do not count SDK installation as campaign evidence.
7. Do not add secret RevenueCat API keys, OneSignal API keys or `HF_TOKEN` to the app, build logs or repository.
8. Use the free local development-client path first: connect an Android device and run `npx expo run:android`, or build the debug APK with the checked-in Gradle project. Record the artifact hash and device details.
9. Use `eas build --platform android --profile development` only after confirming the account has enough included build minutes and the run will cost zero. Never trigger a paid build for this submission. Record an EAS URL only when one was actually observed.
10. Install the completed artifact on the physical Android device. Confirm that the installed app opens to The Forgetting Stage lobby.

## Fresh-install and ten-round play

1. Uninstall any existing copy of The Forgetting Stage, then install the preview artifact. This is the fresh-install observation.
2. With the device online, open the app, select a premise and start a performance.
3. Observe the `AI LIVE · EXACT 1K` status and record at least one live-generated turn from the deployed HTTPS endpoint. Do not treat a server safety line or deterministic offline turn as live-generation evidence.
4. Complete all ten scheduled rounds and any recovery rounds the exact-token loop requests. At least once, pin exactly one actor line when the stage presents the choice and use one quick director cue.
5. Observe at least one seed eviction followed by two distinct confident replacements. Reach the curtain and confirm that the memory meter never exceeds 1,000 model tokens.
6. Record the device model, Android version, artifact hash or build URL, endpoint URL and the time of the observed run in the submission notes.

## Test Store purchase, entitlement and restore

1. With the device online, open Director's Pass from the lobby and start the Test Store purchase flow.
2. Complete the Test Store transaction. Confirm that the app visibly reports Director's Pass as active and allows unlimited performances.
3. Capture the active-entitlement state as device evidence, including no credential values.
4. Uninstall the app, reinstall the same preview artifact and open it while online.
5. Select **Restore purchases**. Confirm that the active Director's Pass state returns after the restore.

## Offline recovery

1. Keep the installed preview build after the restore test. Confirm it is the same configuration that produced the recorded live-generated turn.
2. Enable airplane mode or disable both Wi-Fi and mobile data, then reopen the app and begin another performance.
3. Capture the app's honest fallback indicator that live AI was unavailable. Do not represent this fallback indicator as a live request.
4. Complete ten rounds using the deterministic offline preview and confirm that it still reaches a visible forgetting chain and curtain.
5. Return the device online and confirm the lobby remains usable. Record any failure rather than substituting a claim of recovery.

## Sponsor loop evidence

1. Confirm Layers receives `performance_started`, `memory_seed_forgotten`, `performance_completed` and `daily_reminder_enabled` from this native build.
2. Assign or observe both `curtain_reminder_copy` variants. Record the opt-in signal by variant and one honest learning, even if the result is inconclusive.
3. At curtain, tap the reminder and grant notification permission. Confirm the OneSignal subscription receives the expected tags.
4. Deploy one daily-curtain campaign from OneSignal and receive it on the device. Record the App ID, campaign identifier and receipt time without exposing a private API key.
5. If no live app or deployed campaign exists, leave the OneSignal track unclaimed. If no Layers dashboard signal exists, leave the Layers track unclaimed.

## Required final capture and public video

1. Capture the approved target-device lobby or gameplay evidence at exactly **1179 by 2556** pixels. Do not add a device frame.
2. Do not use `assets/forgetting-stage-web-showcase.png` as that approved target-device capture. It is an actual web-build lobby capture at the same pixel dimensions, not native device evidence.
3. Record the demonstration on the physical Android device the preview build targets. Show the installed app and the observed judge path, not a browser substitute.
4. Keep the demonstration under two minutes and use only project-owned or properly licensed visual, music and audio material.
5. Publish the video through YouTube or Vimeo with public access, then replace the public media URL TODO with the observed URL.
6. Before submission, verify that the target-device screenshot, the public video and the dashboard identifiers above all correspond to the same observed preview configuration.
