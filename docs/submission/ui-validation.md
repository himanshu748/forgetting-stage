# Theater UI validation, 12 September 2026

This pass refines the existing warm, dark theater and paper-ticket design for the Next Gen demo. It does not change submission status or claim store readiness.

## Implemented

- Responsive landing page with a visible company, premise selection and a shorter playbook disclosure.
- Three lightweight animated puppets. Idle motion pauses offscreen, in background tabs/apps and for reduced-motion preferences.
- Character editor for names, backstories and speaking styles. Cast edits are validated, saved on the device and applied to the next performance. Live starts pass the cast into server-owned state. Rehearsals keep prepared dialogue, with character-name substitution.
- Explicit offline rehearsals that consume no daily AI ticket and issue no generation requests.
- Latest-line focus, expandable remembered script and director tools, plus an always-visible next action on the stage.
- Resume within the current app visit. Starting a replacement show asks before discarding the unfinished performance. Reloading the app still does not restore an in-progress performance.
- Daily access refresh on app foreground and a short timer, readable mobile drift comparisons and browser keyboard-focus styling.

## Observed verification

- TypeScript check and Expo web export pass.
- 133 automated tests pass. These include two complete rehearsals without live-client calls, custom-cast request and prompt propagation, invalid-cast rejection and short-role forgetting recovery.
- Browser inspection at 1440 × 950, 390 × 844 and a 320px-wide editor.
- Edited a name and speaking style, saved them and observed both after reload. Duplicate names disable Save with a visible explanation.
- A complete custom-name rehearsal reached curtain after pinning, sending a director cue, leaving and resuming. The drift report retained the pinned truth and the edited speaker name.
- The stage company was checked after fixing its cast source to the current session's engine.

## Scope of evidence

Browser checks are web-build evidence. This pass downloaded no Android simulator or native system image, ran no live paid inference and performed no store purchase. Live custom-cast behavior is covered by deterministic gateway tests, not a new observed provider response. Existing native billing evidence remains in `device-validation.md`.
