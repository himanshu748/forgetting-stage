# Cloud Android validation — September 25, 2026

## Observed failure

- Source: `a6d37931e4e5c0f5cc4355ea1d7e4c689283fdb4`.
- GitHub build: https://github.com/himanshu748/forgetting-stage/actions/runs/36154610557
- APK SHA-256: `a1e4f063cffe491f4150684dfe22471884b0b4c4abe7a85258686027bef0a8f4`.
- Cloud provider: BrowserStack App Live free trial.
- Device: real Google Pixel 8, Android 14.
- The APK uploaded, installed and opened the theatre lobby. RevenueCat then displayed **Wrong API Key**, explaining that a Test Store key cannot run in a release build and that the app would close.
- This is a failed native test, despite the successful compile. No purchase or completed native performance was observed in this session.

## Fix and verification gate

A separate `preview` Android build type is debug-enabled, debug-signed, and uses the application ID `com.himanshujha.forgettingstage.preview`. Its JavaScript is bundled; it uses release dependency variants to avoid the Expo development-launcher requirement for a local Metro server. Production `release` settings remain unchanged.

The workflow checks the resulting APK's debug flag, separate application ID and embedded JavaScript. RevenueCat's Android implementation checks `ApplicationInfo.FLAG_DEBUGGABLE` when deciding whether Test Store is allowed. See [the Test Store guide](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store).

## Corrected preview observed

- Source: `36e0af13427d8630c8cc45d8f084cf0c5c27348d`.
- Successful build: https://github.com/himanshu748/forgetting-stage/actions/runs/36156345363
- APK SHA-256: `4e4c018c87a58e1de7f15d3f15c54a9754bea9dd589fcd020c38a23edd850e2c`.
- Prerelease: https://github.com/himanshu748/forgetting-stage/releases/tag/cloud-preview-36156345363-1
- The corrected app opened on real cloud Pixel 8 (Android 14), Pixel 7 and Pixel 7 Pro (Android 13) without the fatal release-mode Test Store rejection.
- On Pixel 7, the cast editor opened and the offline rehearsal accepted a pinned Meera line.
- On Pixel 7 Pro, RevenueCat displayed its **Test Store Purchase** dialog for the monthly product. Selecting **Test Valid Purchase** returned to the lobby with **Director's Pass active** and **Unlimited performances are unlocked**. This is a simulated transaction, not a charge or revenue.
- A separate Pixel 7 Pro offline rehearsal reached the curtain report: **18 beats forgotten**, **152 estimated tokens at curtain**, and **1 truth survived**. Meera's saved wedding line remained present. Later dialogue called Arun the estate lawyer.
- The preview has no generation endpoint configured. These September 25 observations are **offline prepared-script rehearsal**, not fresh live AI generation.

The demonstration combines edited screen recordings and explicitly labeled still captures from these native sessions. The cloud provider's dashboard and logs are cropped out. No browser-rendered gameplay is substituted for Android footage.

BrowserStack's free native-device trial was used. The current GitHub Student offer was not verified to provide year-long native App Live access. No paid upgrade, local Android SDK/emulator installation, production purchase, or physical reinstall-and-restore test was performed.
