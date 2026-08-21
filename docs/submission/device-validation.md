# Android device validation and evidence checklist

Use this runbook only on a physical Android device with an EAS Android preview build. It records the actions required to create honest submission evidence. Do not mark an item complete until it has been observed on that device.

## Submission record, fill after observation

- RevenueCat project ID: `TODO: record the configured project ID`
- RevenueCat Test Store public SDK key: `TODO: record the preview key, never a secret API key`
- Deployed generation endpoint URL: `TODO: record the HTTPS endpoint used by the preview build`
- EAS Android preview build URL: `TODO: add the completed build URL`
- Test Store product or package URL: `TODO: add the observed store or product URL`
- Public media URL: `TODO: add the published demo video URL`

The checked-in app does not establish that any of these external services are configured. A Test Store key is for development and preview builds only, never an app-store release. This project declares `react-native-purchases` 10.6.0, which meets Test Store's React Native SDK minimum of 9.5.4. EAS preview builds use EAS-managed Android credentials, so the repository's checked-in debug signing configuration is not a preview-build blocker.

## Prepare the preview build

1. In the RevenueCat dashboard, create the Director's Pass Test Store product and package. Attach that product to the `directors_pass` entitlement, then add the package to the current offering. Record the RevenueCat project ID and Test Store public SDK key in the submission record only after verifying them.
2. Configure the Test Store public SDK key for the EAS preview environment as `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`.
3. Deploy the generation gateway to an HTTPS URL, then configure that URL for the EAS preview environment as `EXPO_PUBLIC_GENERATION_ENDPOINT`. Keep the endpoint URL as a TODO until it has been observed in the completed preview configuration.
4. Do not add secret RevenueCat API keys or `HF_TOKEN` to the app, build logs or repository.
5. Build the Android preview artifact with `eas build --platform android --profile preview`. Wait for it to finish, then replace the build URL TODO with the observed EAS URL.
6. Download the completed artifact from that EAS URL and install it on the physical Android device. Confirm that the installed app opens to The Forgetting Stage lobby.

## Fresh-install and five-round play

1. Uninstall any existing copy of The Forgetting Stage, then install the preview artifact. This is the fresh-install observation.
2. With the device online, open the app, select a premise and start a performance.
3. Observe and record at least one live-generated turn from the deployed HTTPS endpoint. Do not treat a deterministic fallback turn as live-generation evidence.
4. Complete all five rounds. At least once, pin exactly one actor line when the stage presents the choice.
5. Reach the curtain and inspect the drift report. Confirm that the run completed rather than stopping before the fifth round.
6. Record the device model, Android version, build URL, endpoint URL and the time of the observed run in the submission notes.

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
4. Complete five rounds using the deterministic offline fallback and confirm that the performance continues to curtain.
5. Return the device online and confirm the lobby remains usable. Record any failure rather than substituting a claim of recovery.

## Required final capture and public video

1. Capture the approved target-device lobby or gameplay evidence at exactly **1179 by 2556** pixels. Do not add a device frame.
2. Do not use `assets/forgetting-stage-web-showcase.png` as that approved target-device capture. It is an actual web-build lobby capture at the same pixel dimensions, not native device evidence.
3. Publish a publicly accessible demonstration video that is under two minutes, then replace the public media URL TODO with the observed URL.
4. Before submission, verify that the target-device screenshot, the public video and the dashboard identifiers above all correspond to the same observed preview configuration.
