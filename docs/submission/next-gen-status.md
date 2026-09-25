# Next Gen submission preparation — September 25, 2026

The entry is solo and targets Next Gen only. No store-required sponsor prize is claimed.

## Verified today

- Devpost account uses the participant's qualifying academic email. Do not commit the email address.
- The participant confirmed active student enrollment and age 18 or older.
- The repository is public and has an MIT license.
- The 1024×1024 icon and 1179×2556 Android emulator screenshot were uploaded to the Devpost gallery. The gameplay image is explicitly dated August 21, 2026.
- A clean dependency install passed all 133 tests, TypeScript and the web export.
- Gitleaks found no secrets in the 38-commit history or updated source and documentation.

## Source recovery

The original checkout has iCloud-offloaded files that block reads. A separate clone of `codex/hf-space-gateway` was used for validation, preserving the original checkout. Resident source, UI components and UI validation notes were copied into that clone. The eight unavailable app/source files have the same Git index blob hashes as the public branch versions. No local secret files were copied into the clone.

## Native cloud preview

The cloud Android workflow uses a standard GitHub-hosted Linux runner on the public repository. The first x86_64 build and the subsequent ARM64/x86_64 build compiled, but real Pixel 8 testing exposed a release-mode Test Store rejection. Both original prereleases are labeled superseded. The workflow now builds a separate debug-enabled `preview` variant for RevenueCat Test Store, with bundled JavaScript and a separate application ID. It does not install an emulator on the participant's Mac, trigger EAS, or claim a production/store release. See `native-cloud-validation.md` for the failed observation and the remaining runtime gate.

The corrected preview built successfully and was observed on real cloud Pixel devices. On Pixel 7 Pro, a RevenueCat Test Store purchase activated Director's Pass, and an offline rehearsal reached its curtain report with 18 forgotten beats and one protected line. See `native-cloud-validation.md` for exact build identity and limitations. This remains a sandbox preview, not a production release.

## Published demo and saved draft

The [1:40 native demo](https://youtu.be/EXRoKwz3tJI) is public on YouTube. Publication and playback were verified; YouTube reported no copyright issues. It labels offline rehearsal, edited native recordings, still captures and simulated purchases.

The video and updated factual story are saved on Devpost. Live readback confirms the video URL and `submitted_at: null` for Shipaton. Official requirements and security checks were reviewed; the entry is ready for the participant's explicit final submission confirmation and acceptance of the Official Rules and Devpost Terms. A published project page is not proof of final submission.

Historical live AI and simulated purchase observations are recorded in `device-validation.md`. Physical-device restore, OneSignal campaign delivery and Layers dashboard evidence remain unclaimed.
