# The Forgetting Stage

**A story machine where an AI cast improvises a play inside a real 1,000 token memory,
and you choose the one thing they are allowed to keep.**

Successor to [Thousand-Token Theater](https://huggingface.co/spaces/build-small-hackathon/thousand-token-theater),
which won the Build Small Hackathon. Entry for RevenueCat Shipaton 2026.

The cast shares a genuine 1,000 token memory. As the play runs the oldest beats fall
out, and the actors carry on regardless, confidently inventing replacements for whatever
they have lost. You get one pin. The comedy is the contrast: one fact stubbornly
survives while everything around it rots.

There is no goal and no way to lose. It is a machine for producing funny disasters, and
the player composes rather than competes.

## Play it

The repository now includes a mobile-first Expo game with three complete screens: premise selection, a live stage and the final drift report. The playable demo runs entirely offline with deterministic performances, so no model token is ever shipped to the client.

```bash
npm install
npm start
```

Use `npm run ios`, `npm run android` or `npm run web` for a specific platform. During a play you can pin exactly one actor line, spend one director note, watch shared memory evict its oldest facts and compare each actor's first and final certainty at curtain.

## Engine and experiments

The deterministic test suite needs no API key. Live spikes, plays and experiments use Hugging Face Inference.

```bash
npm test
```

Proves the 1,000 token cap and the pin mechanic against a mock model. 7 tests, no
network. The engine takes `countTokens` and the model as injected dependencies, so
eviction is verifiable without inference.

```bash
HF_TOKEN=hf_xxx npm run spike
```

The go/no-go check described below. Optionally set `MODEL` to compare candidates.

```bash
HF_TOKEN=hf_xxx npm run experiment
```

Runs a matched backend experiment with two arms: the normal 1,000-token memory and a control where eviction is effectively disabled. Both arms use the same premise, cast, rounds and completion contract. The command prints a comparison report and writes structured JSON to `artifacts/latest-experiment.json`.

Configure it with `ROUNDS`, `BUDGET`, `CONTROL_BUDGET`, `PREMISE`, `MODEL` and `OUTPUT`. Experiment artifacts are local and ignored by Git.

The result records the first eviction round, forgotten beats, forgotten seeds, final memory size, per-character drift and whether the control remained intact. A causal signal of `isolated` means eviction occurred only in the forgetting arm. It does not claim semantic drift by itself. Review the paired transcripts or add a semantic scorer before making that stronger claim.

## The one thing that decides whether this works

After a fact is evicted, **two actors must invent different replacements for it**. If
they agree, there is no comedy. If either admits it forgot, the illusion breaks.

`npm run spike` tests exactly that and prints PASS or FAIL. Run it before building any
UI. Everything else in this project is downstream of that result.

The mechanism is one prompt in [`src/engine/prompts.ts`](src/engine/prompts.ts).
Thousand-Token Theater told actors *"never contradict the script"* and to be
*"intrigued by the gaps"*, which produced graceful degradation. This inverts it: actors
must invent specific, confident replacements and never acknowledge a gap.

## Layout

```
src/engine/types.ts        Beat, Character, budget constants
src/engine/prompts.ts      The inverted confabulation prompt, registers, curtain
src/engine/theater.ts      Ported engine: memory, eviction, pins, drift
App.tsx                    Expo game: lobby, live stage and drift report
src/game/content.ts        Premises, cast and deterministic demo performances
src/game/session.ts        Frontend game loop around the pure engine
src/engine/theater.test.ts Proof the cap and pins are real
src/experiments/matched.ts Reusable forgetting vs control orchestration
src/experiments/run.ts      Live experiment CLI and JSON artifact writer
src/spikes/confabulation.ts Go/no-go check
```

Ported from the original `theater.py`, keeping its best decision: no model, no network
and no UI inside the engine. Changes: beats can be pinned and pinned beats never evict,
the prompt is inverted, a play ends on a curtain line rather than running out of turns,
and drift is derived from beat attribution so it needs no extra model call.

## Status

Playable Expo game, pure memory engine, matched experiment backend and structured reporting are all available. The client currently uses deterministic offline performances. A production model service can replace that provider without moving credentials into the app.

## Licence

MIT, see [LICENSE](LICENSE).
