# Judge guide — Next Gen Android preview

This is a solo Next Gen entry. There is no app-store listing or production purchase claim.

Watch the [1:40 native Android demo](https://youtu.be/EXRoKwz3tJI). Published September 25, 2026, it combines edited native recordings with labeled still captures. Gameplay is offline rehearsal; purchases are simulated through RevenueCat Test Store.

## Install the tested native preview

Download the APK and `SHA256SUMS.txt` from the [September 25 cloud preview](https://github.com/himanshu748/forgetting-stage/releases/tag/cloud-preview-36156345363-1).

- Source commit: `36e0af13427d8630c8cc45d8f084cf0c5c27348d`.
- Package: `com.himanshujha.forgettingstage.preview`.
- ABI support: ARM64 and x86_64.
- Standalone, debug-enabled test app; no Metro server is needed.
- RevenueCat uses Test Store. Transactions in this preview are simulated and do not charge money.
- No generation gateway is configured in this APK. Use the visibly labeled offline rehearsal. It uses a prepared script and estimated token counts, not live model generation.

The APK opened on real cloud Pixel devices with Android 13 and 14. Detailed observations and limitations are in [native-cloud-validation.md](native-cloud-validation.md).

## Try the game

1. Open **Meet & edit the company** to inspect the editable names, backstories and speaking styles. Edits apply to later performances; rehearsal uses a prepared script.
2. Choose **Nobody knows the bride**, then **Try an offline rehearsal**.
3. Advance to Meera, then press **Pin this** on her line.
4. Keep advancing the cast. The shared-memory meter fills; older unpinned beats disappear.
5. Open **Inspect the forgetting chain** to inspect lost facts and the actors' replacements.
6. Finish the fifth round and bring down the curtain. The report compares the actors' first and final certainties and displays the protected line.

## Try the RevenueCat integration

From the lobby, open **View Director's Pass**, choose the pass, and inspect the native **Test Store Purchase** dialog. Select **Test Valid Purchase** to simulate success. The lobby should show **Director's Pass active** and unlock unlimited performances. This exact flow passed on a real cloud Pixel 7 Pro on September 25.

## Inspect or build the source

Use the [`codex/nextgen-submission-20260925` branch](https://github.com/himanshu748/forgetting-stage/tree/codex/nextgen-submission-20260925). The default branch may not contain the latest submission changes.

```sh
npm ci
npm test
npm run typecheck
```

The checked build passed 133 tests. The [cloud Android workflow](../../.github/workflows/cloud-android-preview.yml) documents how to build the standalone preview. Provide your own RevenueCat Test Store public SDK key through the documented workflow secret when reproducing that integration. Do not embed server-side provider credentials in the mobile app.

The live Hugging Face path requires a configured generation gateway and server-side model credentials. It uses the serving model's tokenizer and a 1,000-token memory allowance. That path was observed in earlier Android testing, but is not running in the September 25 demo.
