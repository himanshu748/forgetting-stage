# The Forgetting Stage

**A story machine where an AI cast improvises a play inside a real 1,000 token memory,
and you choose the one thing they are allowed to keep.**

Status: PRD v3, 2026-08-01.
Successor to **Thousand-Token Theater**, which won the Build Small Hackathon
([Space](https://huggingface.co/spaces/build-small-hackathon/thousand-token-theater),
[code](https://github.com/himanshu748/build-small-hackathon-thousand-token-theater)).
That shipped only as an HF Space, never to an app store, so this qualifies as a new app
under the 2026 Shipaton rules.

---

## 1. What it is, and what it is not

It is **not a game you can lose**. No goal, no score, no fail state. It is a machine for
producing funny disasters. The player composes rather than competes.

The cast shares a genuine 1,000 token memory. As the play runs the memory fills, the
oldest beats fall out, and the actors carry on regardless. **The comedy is the
contrast**: you pin one thing so it survives, and everything around it rots.

You pin *"Arun is the groom."* The cast then loses the bride, the venue and the reason
anyone came, but keeps insisting with total confidence that Arun is the groom.

### The comedy engine: confabulation, not amnesia

Memory is shared, so the cast loses facts together. Divergence comes from what happens
**after** a loss: each actor performs without the fact and each invents a different
replacement. Meera decides she is a waiter. Arun decides the wedding was cancelled. They
argue with total confidence from the same blank.

Three actors independently filling one hole with different nonsense is the engine.

---

## 2. The single most important change from the original

The original's system prompt reads:

> You can ONLY remember what appears in SCRIPT SO FAR. If a detail isn't there, it has
> been forgotten, **never contradict the script**; you may be **intrigued by the gaps**.

That was tuned for graceful degradation, and it is the opposite of what this product
wants. **Invert it.** Actors must fill gaps with confident, specific, wrong answers and
must never acknowledge uncertainty. An actor who says "I seem to have forgotten" has
broken the product. An actor who confidently announces the wrong bride has made it.

This is the highest-leverage line of prompt engineering in the build and it should be
tested before any UI exists.

---

## 3. Core loop

One session, 4 to 6 minutes:

1. **Daily premise**, identical worldwide, resets 00:00 UTC
2. **Cast of 3 generated fresh**, each with a trait and a secret, never reused
3. **Turns.** Each turn:
   - The next actor performs a beat, streamed token by token
   - The beat enters shared memory and the **meter** fills toward 1,000 tokens
   - You direct: play a **card**, or **type a stage direction**
   - Over budget, the oldest unpinned beats evict and visibly leave the board
4. **Pin one beat**, any time, irreversible, spent blind
5. **Curtain**, then the **Plot Drift report** and a shareable playbill card

---

## 4. Design detail

### 4.1 Pins are setups, not defences
A pin does not protect the story, it aims the joke. The choice is creative, not
strategic: pin the secret and everyone knows the secret and nothing else. Pin a
relationship and you get spouses who cannot name each other. One free per play,
irreversible, spent **blind**, because a preview turns composition into bookkeeping.

### 4.2 Direction costs memory
Cards are cheap and fixed cost. **Typed stage directions are charged to the same 1,000
tokens.** Say more and they forget faster. Already implemented in the original, where
`add_direction` pushes the note into memory and triggers eviction.

This bounds token cost by a game rule rather than a paywall, so free text needs no
subscription gate.

### 4.3 The forgetting must be legible
If players cannot tell forgetting from bad writing, the premise collapses.
Non negotiable: beats live as discrete cards on a board, eviction is visible, and a
contradiction of an evicted beat is marked inline.

### 4.4 Plot Drift report
Per character, first belief against last belief:

> **Meera** began as the bride. She ended as a waiter who had never met the groom.
> **Arun** believed the wedding was tomorrow, then that it had already happened twice.
> **Still standing:** Arun is the groom. *(pinned)*

`Beat` already carries `speaker`, so this needs no extra tracking. Compare a character's
earliest surviving beat to their latest.

### 4.5 Cast and voice packs
Cast is generated per play and never persists. Novelty carries replay, not progression.

**Voice packs** are the register the troupe performs in. Ship two or three:
- **Indian idiom (flagship, default)**: weddings, joint families, housing societies,
  cricket. Specific, funny, universally legible, and distinctive in a field of generic
  English apps
- One contrasting register (absurdist, or noir)

Packs double as a sellable. Note "voice pack" here means **writing register**, not
audio. Spoken audio is section 8.

---

## 5. Memory architecture

The 1,000 tokens is real, measured with the model's own tokenizer, not simulated.

**The unit of memory is a beat, not an extracted fact.** An earlier draft proposed a
per-turn fact-extraction call. The original proves that is unnecessary: it evicts the
oldest whole beat when the transcript crosses budget. That removes a model call per
turn, removes a subsystem, and beats are already discrete enough to pin and to animate.

```
Beat { id, speaker, emoji, text, kind }   kind = narration | line | direction
```

Prompt assembly per turn: pinned beats first, then most recent beats, until the budget
is exhausted. Typed directions count against the same budget.

**Expect fast eviction.** 1,000 tokens is roughly 750 words, so a play exceeds it within
two or three turns. Constant eviction is exactly what the product wants.

---

## 6. What we reuse from the original

| Asset | Reuse |
|---|---|
| `theater.py` engine | **Port to TypeScript nearly line for line.** No torch, gradio or transformers in it, model injected as `generate_fn` and `count_tokens_fn`, eviction unit-tested independently |
| `clean_output()` | Keep wholesale. Hard-won defensive parsing for small models: strips `<think>` tags, leading name labels, markdown bold, trims incomplete sentences, caps to two sentences |
| prepare/commit split | Keep. `prepare_beat()` returns messages, the app streams, `commit_beat()` folds the result into memory. The engine never invents model output |
| Director notes as beats | Keep. Already makes directions cost budget |
| Round-robin turn order | Keep for v1. Simple and predictable |
| System prompt | **Invert** (section 2), and reskin from woodland animals to the chosen register |

---

## 7. Technical architecture

**Client**: React Native + Expo (SDK 57), TypeScript. Skia for the stage board and the
playbill card export. The Skia render and full resolution offscreen export pipeline from
the abandoned Shipcard project is directly reusable, including the typeface loader and
watermark gating.

**Backend**: thin inference proxy. Keys can never ship in an APK. Owns the daily premise,
spend caps, caching and moderation. Supabase edge functions by default.

**Inference**: **Hugging Face Inference Providers**, funded by the existing $50.

Chosen over reusing the original's ZeroGPU Space because reliability decides how a judge
perceives the app on a single opening. ZeroGPU cold starts and queues are an unacceptable
risk for a judged demo, and the API also lets us benchmark several models to find the
funniest confabulator.

### 7.1 Budget
$50 at roughly half a cent per play is on the order of 10,000 plays, so budget is not the
binding constraint. Still required from week 1, because an unbounded LLM endpoint on the
open internet is an incident waiting to happen:

- Server side **hard spend cap** with a kill switch
- **Per user daily rate limit**, which the free tier already implies
- **Graceful degradation**: the theatre is "dark tonight" with a cached play, never an
  error screen
- **Cache the daily premise opening**, identical for every player

### 7.2 Latency
Theatre has built-in waiting: curtains, beats, an actor pausing. Stream tokens as
dialogue being spoken so latency reads as performance rather than lag. The original
already streams via `TextIteratorStreamer`, so the pattern is proven.

### 7.3 Safety
Improvising actors will eventually produce something unwanted in a Play review or a
judge's screenshot. Constrained premises, explicit bounds in the system prompt, a
moderation pass on output, and a report affordance.

### 7.4 Demo determinism
Keep a **seeded replay** of a known good play for the demo video, labelled honestly as a
representative session.

---

## 8. Spoken voice: day one, via a two-tier ladder

The cast performs **aloud from day one**. An AI troupe that actually speaks is
dramatically more impressive in a 2 minute demo and far more shareable, so it serves the
Design, Best Game and Most Viral lanes at once.

**Architecture warning.** Choosing HF Inference Providers over ZeroGPU broke the
original's voice design. VoxCPM2 worked there because it sat on the *same A10G* as
MiniCPM, colocated and free. With an API backend, neural TTS is a separate service with
separate latency and cost. That path is not a straight port, which is part of why it was
cut for stability the first time.

**The ladder:**

| Tier | Engine | Why |
|---|---|---|
| **v1, day one** | On-device TTS (`expo-speech` / native Android) | Free, offline, no backend, near-zero latency. Three distinguishable actors via per-character pitch and rate. Cannot destabilise the loop because there is no network call |
| **Paid upgrade** | Neural TTS | Genuinely better performance as a subscriber feature, and a desirable addition rather than a removed limit, which is the stronger HAMM argument |

Synthetic voices are a **style** here, not a defect. A lantern-lit troupe of slightly
robotic actors is coherent with the premise. Verify `expo-speech` support in SDK 57
before committing.

Finishing what the original had to cut is also a strong build-in-public story.

---

## 9. Art direction: printed playbill, motion doing the work

The Design Award names *"beautiful app design and animations"* explicitly, and animation
is where a solo builder beats a funded team. Illustration is the trap that kills solo
entries because it needs an artist and degrades visibly when rushed.

So: beats are **paper cards on a theatre programme**, and the craft goes into what
happens to them.

- A card yellows as it ages toward eviction
- It curls and drops off the board when memory evicts it
- A pin physically pierces the paper and holds it while everything else falls
- Ink fades as the budget tightens

No asset pipeline, direct reuse of the proven Skia typography work, and **motion that
explains the mechanic rather than decorating it**. The same aesthetic makes the ending
card look like a real playbill, which serves Most Viral too.

---

## 10. Build in public: a build a day

#BuildInPublic is **$30k first place**, the second largest prize, judged on *"the most
interesting development journey on social media"* with *"compelling lessons learned"* and
*"community-incorporated ideas"*.

**Cadence: a build, a public commit and a post every day.**

Honest constraint: daily *store* releases are impossible, because Play review plus the 14
day closed test forbid it. The judged artifact is the social journey, not the release
count. So daily means a working build and a post, with store releases when the gates allow.

**The flywheel**: a game about AI forgetting things generates its own content when it
breaks. Every absurd failure during development is a post. This is the rare project where
the bugs are the marketing.

Content sources, in rough priority:
1. Actual failures and funny outputs from that day's build
2. The prompt-inversion lessons (making a model confidently wrong on purpose)
3. Crowdsourced premises from followers, which directly satisfies the
   *"community-incorporated ideas"* criterion
4. The 1,000 token constraint explained as a design idea rather than a limitation

---

## 11. Monetization (hybrid)

| Tier | What you get |
|---|---|
| Free | 1 play per day, the daily premise, 1 pin, watermarked playbill card |
| Rewarded ad | +1 pin for this play, or a second play today |
| Consumable | Pin packs, premise packs, voice/register packs |
| Subscription | Unlimited plays, full premise library, all registers, clean cards, spoken voice when it ships |

RevenueCat surface to exercise deliberately, since HAMM rewards depth: Offerings,
consumables alongside subscriptions, Paywall Experiments, Targeting, Customer Center, and
a winback offer.

The core requirement is satisfied by *"the RevenueCat SDK to power at least one in-app or
web purchase, **or that serves ads through RevenueCat Ads**."* The ads path likely needs
no store account, which keeps the store decision open. **Verify.**

---

## 12. Lane map

The 2026 rules removed the one prize per project cap, so these are **additive**.

| Lane | 1st | Fit |
|---|---|---|
| #BuildInPublic | **$30k** | Daily cadence, and the bugs are the content |
| OneSignal | **$25k** | Daily premise push is the loop. Judged on Journeys and campaign craft |
| Design | $15k | Motion that explains the mechanic. *"innovative ideas OR beautiful design"* |
| Most Viral (Noise) | $15k | Drift report as a repeatable format. $1,000 matching credits toward 1.5M UGC creators |
| HAMM | $15k | Four monetization surfaces, real SDK depth |
| Catvertising | $15k | Rewarded pin |
| Growth Loop (Layers) | $15k | SDK plus a documented hypothesis and learnings |
| Next Gen | $15k | The $0 floor |
| Best Game | $15k | **Contested but winnable.** See 12.1 |

Not targeted: Grand Prize (traction judged), Peace Prize (weak, do not force), Influencer
awards (no brief matches), Stripe (blocked in India), JetBrains Kotlin (needs KMP and both
platforms), Replit (dropped).

### 12.1 Best Game: the no-fail-state question

An earlier draft deprioritised this on the grounds that a toy argues weakly against
*"gameplay"*. That was too pessimistic. Gameplay does not mean fail state: Townscaper has
no goals whatsoever and was critically adored, and neither Animal Crossing nor The Sims
can be lost. The pin is a meaningful, irreversible choice with a visible consequence,
which is real gameplay. The category also weights art direction and monetization fit,
where this scores well.

**The real risk is presentation, not design.** "No fail state" reads as *unfinished*
unless the framing makes it read as *deliberate*. Townscaper feels confident. A game that
merely lacks a win condition feels incomplete.

Requirements that make it read as deliberate:

1. **A play must end with a curtain, not a timeout.** The Narrator delivers a closing
   line and the drift report lands as a verdict. A session needs a beginning, middle and
   end or it feels broken. This is the single highest-impact change.
2. The pin must feel weighty: irreversible, and its payoff visible at the curtain.
3. Call it a story machine in the submission copy. Do not pitch it as a strategy game and
   invite the comparison it will lose.

---

## 13. Store strategy: decide after the MVP

Nothing in the architecture may depend on a store account.

- **Floor: Next Gen.** Demo video, public repo, and **an open source LICENSE file**
  (mandatory, easily forgotten, trivially fatal). No store release and no completed
  transaction, but it requires *"thoughtful use"* of RevenueCat.
- **Upside: Google Play, $25.** Gate is 12 testers opted in for 14 consecutive days, so
  the closed test starts by **~Sep 4** and the account is paid and identity verified in
  **August**. Google rejects prepaid and most virtual cards.
- **Commit or decline by Aug 25.**

---

## 14. Milestones

| Week | Dates | Outcome |
|---|---|---|
| 1 | Aug 1 to 7 | **Two go/no-go spikes before any UI**: (a) prompt inversion produces divergent confabulation, (b) on-device TTS speaks a beat at acceptable latency. Then engine ported to TS, streamed beat from HF Inference, eviction working. Repo public with LICENSE. Daily posts begin |
| 2 | Aug 8 to 14 | The loop on device: turns, meter, visible eviction, contradiction marking, cards, actors speaking aloud |
| 3 | Aug 15 to 21 | Pins, typed directions charged to budget, **the curtain** (closing narration, not a timeout), Plot Drift report |
| 4 | Aug 22 to 28 | RevenueCat: offerings, subscription, consumables, paywall. **Commit or decline the $25 by Aug 25** |
| 5 | Aug 29 to Sep 4 | RevenueCat Ads rewarded pin. Playbill card export |
| 6 | Sep 5 to 11 | **Play closed test starts (hard date).** OneSignal daily premise and Journeys |
| 7 | Sep 12 to 18 | Layers SDK and a documented growth experiment. Motion and art pass |
| 8 | Sep 19 to 25 | Neural voice upgrade if the loop is stable. Demo video, 1024x1024 icon, 1179x2556 screenshot, promo codes |
| 9 | Sep 26 to 30 | Production access, submit, Devpost forms per category |

---

## 15. Definition of done

Nothing is submission ready until each is **observed on the real Android phone**:

1. A full play completes with streamed dialogue from HF Inference
2. A beat is evicted and an actor contradicts it, with the UI marking the contradiction
3. **Two actors confabulate different replacements for the same lost fact**
4. A pinned beat survives to the curtain while unpinned beats around it do not
5. The cast **speaks aloud** with three distinguishable voices
6. The play **ends on a curtain line**, not by running out of turns
7. A RevenueCat purchase completes and the entitlement flips
8. A rewarded ad grants a third pin
9. A real OneSignal push arrives and opens the daily premise
10. The playbill card exports and shares
11. The 2 minute demo video is recorded from the actual app

**Item 3 is the product.** If both actors invent the same replacement, or if the model
silently retains what it was never given, you have an app about forgetting that does not
forget. It is also the failure most likely to happen quietly, because everything will look
fine. Test it in week 1 with a throwaway script before building any UI.

---

## 16. Open questions

- Fixed turn count, or run until a drift threshold?
- Cast of 3 always? More actors burn budget faster, which is thematically good and costs
  more per turn.
- Does the playbill card show the full drift report, or the single best contradiction?
  One perfect line travels further than a list.

## 17. Blocked on you

- **Hugging Face token** with the $50 credit attached
- **RevenueCat** account plus an Android app entry
- **OneSignal** account (free Growth Plan for 3 months via Shipaton)
- **Layers** account (free 2 months via Shipaton)
- **Student email** confirmed on Devpost for Next Gen
- **The $25 Play decision by Aug 25**, with a real credit or debit card
- Social account for #BuildInPublic, posting from day 1
- **Confirm the hackathon track name.** The field report says *"Adventure in Thousand
  Token Wood"* under the Build Small Hackathon. Your saved note says "Tiny Titan track"
  and that phrasing is live in your GitHub profile README. One is wrong.

Env vars, read at startup with a failure message naming the missing one:
`HF_TOKEN`, `REVENUECAT_ANDROID_API_KEY`, `ONESIGNAL_APP_ID`, `LAYERS_API_KEY`.
