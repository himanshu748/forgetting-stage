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

## Run it

Nothing here needs an API key except the spike.

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
src/engine/theater.test.ts Proof the cap and pins are real
src/spikes/confabulation.ts  Go/no-go check
```

Ported from the original `theater.py`, keeping its best decision: no model, no network
and no UI inside the engine. Changes: beats can be pinned and pinned beats never evict,
the prompt is inverted, a play ends on a curtain line rather than running out of turns,
and drift is derived from beat attribution so it needs no extra model call.

## Status

Engine ported and tested. Spike written, not yet run. No UI yet.

## Licence

MIT, see [LICENSE](LICENSE).
