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

The corrected APK still requires a successful native startup and purchase observation. Do not count this fix or another successful build as proof that either flow passed.
