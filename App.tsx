import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import type { Beat } from './src/engine/types.ts';
import { readPublicConfig, resolveGenerationEndpoint } from './src/config/public.ts';
import { CAST, PREMISES, type PremiseOption } from './src/game/content.ts';
import {
  createPerformanceProvider,
  createPerformanceSession,
  type PerformanceMode,
  type PerformanceSession,
} from './src/game/performance.ts';
import {
  DEMO_ROUNDS,
  canFinish,
  pinBeat,
  snapshotSession,
  type GameSession,
} from './src/game/session.ts';
import { createLiveGenerator } from './src/live/client.ts';
import {
  canStartPerformance,
  consumePerformance,
  grantEncore,
  ledgerFromState,
  normalizeDailyPass,
  type DailyPassState,
} from './src/monetization/daily-pass.ts';
import {
  createRevenueCatClient,
  isEncorePackage,
  type DirectorPackage,
  type MonetizationStatus,
} from './src/monetization/revenuecat.ts';
import {
  canOfferPurchase,
  momentForScreen,
  shouldShowHouseAd,
  type Screen,
} from './src/monetization/showtime.ts';
import { createLedgerStorage } from './src/monetization/storage.ts';

const publicConfig = readPublicConfig();
const performanceProvider = createPerformanceProvider(createLiveGenerator({
  platform: Platform.OS,
  endpoint: resolveGenerationEndpoint(Platform.OS, publicConfig.generationEndpoint),
}));
const ledgerStorage = createLedgerStorage(() => import('@react-native-async-storage/async-storage'));
const revenueCat = createRevenueCatClient({
  platform: Platform.OS,
  publicKeys: publicConfig.revenueCat,
  loadPurchases: () => import('react-native-purchases'),
});
const emptyMonetization: MonetizationStatus = {
  configured: false,
  unlimited: false,
  packages: [],
};

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'gold' | 'ghost' | 'danger';
  accessibilityLabel?: string;
};

const colors = {
  ink: '#090807',
  panel: '#15120f',
  panelSoft: '#1d1813',
  paper: '#f1e7d2',
  smoke: '#a99d8c',
  line: '#3a3026',
  gold: '#e8b44f',
  goldSoft: '#6b4b18',
  ember: '#de684c',
  mint: '#8db9a2',
};

function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'gold',
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        variant === 'ghost' && styles.actionGhost,
        variant === 'danger' && styles.actionDanger,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          variant === 'ghost' && styles.actionGhostLabel,
          variant === 'danger' && styles.actionDangerLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Wordmark() {
  return (
    <View style={styles.wordmark}>
      <Text style={styles.wordmarkKicker}>A MACHINE FOR FUNNY DISASTERS</Text>
      <Text style={styles.wordmarkTitle}>THE FORGETTING STAGE</Text>
    </View>
  );
}

function Rule({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleNumber}>{number}</Text>
      <View style={styles.ruleCopy}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleBody}>{copy}</Text>
      </View>
    </View>
  );
}

function Lobby({
  onStart,
  pass,
  onShowPaywall,
}: {
  onStart: (premise: PremiseOption) => void | Promise<void>;
  pass: DailyPassState | null;
  onShowPaywall: () => void;
}) {
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(PREMISES[0]?.id ?? 'wedding');
  const compact = width < 760;
  const choice = PREMISES.find((item) => item.id === selected) ?? PREMISES[0];
  if (!choice) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.lobbyScroll} showsVerticalScrollIndicator={false}>
        <Wordmark />
        <View style={[styles.lobbyGrid, compact && styles.lobbyGridCompact]}>
          <View style={styles.heroColumn}>
            <Text style={styles.eyebrow}>TONIGHT'S PERFORMANCE</Text>
            <Text style={styles.heroTitle}>One memory.{`\n`}Three certainties.{`\n`}No second chances.</Text>
            <Text style={styles.heroBody}>
              An AI cast improvises inside a deliberately small shared memory. Save one line. Watch everything else become negotiable.
            </Text>
            <View style={styles.rulesBox}>
              <Rule number="01" title="Direct the play" copy="Choose the premise and intervene when the story needs a dangerous nudge." />
              <Rule number="02" title="Pin one truth" copy="One beat survives every eviction. Choose it before the cast rewrites the world." />
              <Rule number="03" title="Study the wreckage" copy="At curtain, compare where each actor began with the certainty they ended on." />
            </View>
          </View>

          <View style={styles.ticket}>
            <View style={styles.ticketTop}>
              <Text style={styles.ticketKicker}>SELECT A PREMISE</Text>
              <Text style={styles.ticketNumber}>NO. 001</Text>
            </View>
            <View style={styles.premiseList}>
              {PREMISES.map((item) => {
                const active = selected === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => setSelected(item.id)}
                    style={({ pressed }) => [
                      styles.premiseCard,
                      active && styles.premiseCardActive,
                      pressed && styles.premiseCardPressed,
                    ]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]} />
                    <View style={styles.premiseCopy}>
                      <Text style={[styles.premiseEyebrow, active && styles.premiseEyebrowActive]}>{item.eyebrow}</Text>
                      <Text style={[styles.premiseTitle, active && styles.premiseTitleActive]}>{item.title}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.castPreview}>
              <Text style={styles.ticketKicker}>THE COMPANY</Text>
              <View style={styles.castRow}>
                {CAST.map((actor) => (
                  <View key={actor.name} style={styles.castChip}>
                    <Text style={styles.castMonogram}>{actor.emoji}</Text>
                    <Text style={styles.castName}>{actor.name}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.dailyPassPanel}>
              <Text style={styles.dailyPassKicker}>{pass?.unlimited ? "DIRECTOR'S PASS ACTIVE" : 'DAILY CURTAIN'}</Text>
              <Text style={styles.dailyPassCopy}>
                {pass?.unlimited
                  ? 'Unlimited performances are unlocked.'
                  : pass && pass.remaining < 1
                    ? pass.encores > 0
                      ? `Today’s free performance is spent. ${pass.encores} encore${pass.encores > 1 ? 's' : ''} waiting.`
                      : 'Today’s free AI performance is spent. Your curtain refreshes at local midnight.'
                    : 'One complete AI performance is free every day.'}
              </Text>
            </View>
            <ActionButton
              label={!pass || canStartPerformance(pass)
                ? pass && pass.remaining < 1 && !pass.unlimited ? 'Use an encore' : 'Raise the curtain'
                : 'See tonight’s options'}
              onPress={() => {
                if (!pass || canStartPerformance(pass)) void onStart(choice);
                else onShowPaywall();
              }}
            />
            {!pass?.unlimited && <ActionButton label="View Director's Pass" variant="ghost" onPress={onShowPaywall} />}
            <Text style={styles.demoNote}>A RevenueCat entitlement unlocks unlimited performances. Offline preview remains available.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemoryMeter({ used, budget }: { used: number; budget: number }) {
  const fraction = Math.min(1, used / budget);
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: budget, now: used }}>
      <View style={styles.meterLabels}>
        <Text style={styles.meterTitle}>SHARED MEMORY</Text>
        <Text style={styles.meterValue}>{used} / {budget} TOKENS</Text>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${Math.max(3, fraction * 100)}%` }]} />
        <View style={styles.meterDangerLine} />
      </View>
      <View style={styles.meterLegend}>
        <Text style={styles.meterHint}>Oldest unpinned beats fall first</Text>
        <Text style={[styles.meterHint, fraction > 0.8 && styles.meterHintHot]}>{Math.round(fraction * 100)}% occupied</Text>
      </View>
    </View>
  );
}

function BeatCard({
  beat,
  canPin,
  onPin,
}: {
  beat: Beat;
  canPin: boolean;
  onPin: (id: number) => void;
}) {
  const narration = beat.kind === 'narration';
  const direction = beat.kind === 'direction';
  const seed = beat.kind === 'seed';
  return (
    <View
      style={[
        styles.beatCard,
        narration && styles.beatNarration,
        direction && styles.beatDirection,
        seed && styles.beatSeed,
        beat.pinned && styles.beatPinned,
      ]}
    >
      <View style={styles.beatMeta}>
        <View style={styles.beatIdentity}>
          <Text style={styles.beatGlyph}>{beat.emoji}</Text>
          <Text style={styles.beatSpeaker}>{beat.speaker}</Text>
          <Text style={styles.beatKind}>{beat.kind}</Text>
        </View>
        {beat.pinned ? (
          <View style={styles.pinnedBadge}><Text style={styles.pinnedBadgeText}>PINNED TRUTH</Text></View>
        ) : beat.kind === 'line' && canPin ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Pin ${beat.speaker}'s line`} onPress={() => onPin(beat.id)} style={styles.pinButton}>
            <Text style={styles.pinButtonText}>PIN THIS</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.beatText, seed && styles.beatTextSeed]}>{beat.text}</Text>
    </View>
  );
}

function Stage({
  session,
  onAdvance,
  onDirection,
  onPin,
  onFinish,
  onExit,
  mode,
  busy,
  fallbackReason,
}: {
  session: GameSession;
  onAdvance: () => void;
  onDirection: (note: string) => void;
  onPin: (id: number) => void;
  onFinish: () => void;
  onExit: () => void;
  mode: PerformanceMode;
  busy: boolean;
  fallbackReason: string | null;
}) {
  const { width } = useWindowDimensions();
  const [note, setNote] = useState('');
  const snapshot = snapshotSession(session);
  const compact = width < 880;
  const feed = snapshot.memory.filter((beat) => beat.kind !== 'seed');
  const canPin = snapshot.pinnedCount === 0;
  const forgettingDisplay = snapshot.forgettingDisplay;
  const contradiction = forgettingDisplay?.contradiction;
  const directionDisabled = snapshot.directorNoteUsed || busy || snapshot.actorResponsePending;
  const progress = Math.min(DEMO_ROUNDS, snapshot.round);
  const actionLabel = snapshot.canAdvance
    ? `${snapshot.nextSpeaker?.name ?? 'Actor'} steps forward`
    : 'Ready for curtain';

  const submitDirection = () => {
    const value = note.trim();
    if (!value || directionDisabled) return;
    onDirection(value);
    setNote('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.stageShell}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.stageHeader}>
            <Pressable accessibilityRole="button" onPress={onExit} hitSlop={12}>
              <Text style={styles.backLabel}>← LEAVE STAGE</Text>
            </Pressable>
            <View style={styles.stageTitleBlock}>
              <View style={styles.liveStatusRow}>
                <Text style={styles.stageKicker}>LIVE PERFORMANCE</Text>
                <View style={[styles.modeBadge, mode === 'offline' && styles.modeBadgeOffline]}>
                  <Text style={styles.modeBadgeText}>{mode === 'live' ? 'AI LIVE' : 'OFFLINE FALLBACK'}</Text>
                </View>
              </View>
              <Text style={styles.stageTitle}>{session.premise}</Text>
            </View>
            <View style={styles.roundPill}>
              <Text style={styles.roundPillTop}>ROUND</Text>
              <Text style={styles.roundPillValue}>{progress} / {DEMO_ROUNDS}</Text>
            </View>
          </View>

          <View style={[styles.stageGrid, compact && styles.stageGridCompact]}>
            <View style={styles.scriptPanel}>
              <View style={styles.scriptHeader}>
                <Text style={styles.scriptHeading}>SCRIPT STILL REMEMBERED</Text>
                <Text style={styles.scriptCount}>{feed.length} beats on stage</Text>
              </View>
              <ScrollView
                style={styles.scriptScroll}
                contentContainerStyle={styles.scriptContent}
                showsVerticalScrollIndicator={false}
              >
                {feed.map((beat) => (
                  <BeatCard key={beat.id} beat={beat} canPin={canPin} onPin={onPin} />
                ))}
                {forgettingDisplay && (
                  <View style={styles.evictionNotice} accessible accessibilityLiveRegion="polite">
                    <Text style={styles.evictionKicker}>MEMORY THAT CAUSED THIS CHAIN</Text>
                    <Text style={styles.evictionText} numberOfLines={2}>
                      {forgettingDisplay.forgotten.speaker === 'The play'
                        ? 'Premise forgotten'
                        : 'Character fact forgotten'}: {forgettingDisplay.forgotten.text}
                    </Text>
                  </View>
                )}
                {contradiction && (
                  <View
                    style={styles.contradictionCard}
                    accessible
                    accessibilityRole="summary"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={[
                      `Memory erased: ${contradiction.lostSeed.speaker}, ${contradiction.lostSeed.text}.`,
                      contradiction.responses[0]
                        ? `Replacement one from ${contradiction.responses[0].speaker}: ${contradiction.responses[0].text}.`
                        : 'Waiting for the first actor.',
                      contradiction.responses[1]
                        ? `Replacement two from ${contradiction.responses[1].speaker}: ${contradiction.responses[1].text}.`
                        : 'Waiting for the next actor.',
                    ].join(' ')}
                  >
                    <View style={styles.contradictionHeader}>
                      <Text style={styles.contradictionKicker}>FORGETTING CHAIN</Text>
                      <Text style={styles.contradictionStatus}>
                        {contradiction.complete ? 'TWO REPLACEMENTS RECORDED' : 'WAITING FOR THE NEXT ACTOR'}
                      </Text>
                    </View>
                    <View style={styles.contradictionStep}>
                      <Text style={styles.contradictionNumber}>1</Text>
                      <View style={styles.contradictionCopy}>
                        <Text style={styles.contradictionLabel}>
                          {contradiction.lostSeed.speaker === 'The play'
                            ? 'PREMISE ERASED'
                            : `${contradiction.lostSeed.speaker.toUpperCase()} FACT ERASED`}
                        </Text>
                        <Text style={styles.contradictionText}>{contradiction.lostSeed.text}</Text>
                      </View>
                    </View>
                    {[0, 1].map((index) => {
                      const response = contradiction.responses[index];
                      return (
                        <View key={index} style={styles.contradictionStep}>
                          <Text style={styles.contradictionNumber}>{index + 2}</Text>
                          <View style={styles.contradictionCopy}>
                            <Text style={styles.contradictionLabel}>
                              {response ? `${response.emoji} ${response.speaker} REPLACED IT` : 'REPLACEMENT PENDING'}
                            </Text>
                            <Text style={[styles.contradictionText, !response && styles.contradictionWaiting]}>
                              {response?.text ?? 'waiting for the next actor'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {forgettingDisplay && forgettingDisplay.cascading.length > 0 && (
                  <View style={styles.queuedEvictions} accessible accessibilityLiveRegion="polite">
                    <Text style={styles.queuedEvictionsKicker}>NEW MEMORY LOSSES THIS TURN</Text>
                    {forgettingDisplay.cascading.map((beat) => (
                      <Text key={beat.id} style={styles.queuedEvictionsText} numberOfLines={2}>
                        {beat.kind === 'seed'
                          ? beat.speaker === 'The play' ? 'Premise forgotten' : 'Character fact forgotten'
                          : beat.speaker}: {beat.text}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={styles.controlPanel}>
              <MemoryMeter used={snapshot.memoryTokens} budget={snapshot.budget} />

              <View style={styles.truthPanel}>
                <Text style={styles.controlKicker}>THE ONE THING THEY KEEP</Text>
                {snapshot.pinnedCount ? (
                  <>
                    <Text style={styles.truthMark}>◆</Text>
                    <Text style={styles.truthValue}>{snapshot.memory.find((beat) => beat.pinned)?.text}</Text>
                  </>
                ) : (
                  <Text style={styles.truthEmpty}>No truth pinned. Tap any actor line before memory takes it.</Text>
                )}
              </View>

              <View style={styles.nextPanel}>
                <Text style={styles.controlKicker}>{snapshot.canAdvance ? 'NEXT UNDER THE LIGHT' : 'THE CAST IS WAITING'}</Text>
                <View style={styles.nextActor}>
                  <Text style={styles.nextMonogram}>{snapshot.nextSpeaker?.emoji ?? 'C'}</Text>
                  <View>
                    <Text style={styles.nextName}>{snapshot.nextSpeaker?.name ?? 'Curtain call'}</Text>
                    <Text style={styles.nextPersona} numberOfLines={2}>{snapshot.nextSpeaker?.persona ?? 'the last remembered version of the play is ready'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.directionPanel}>
                <Text style={styles.controlKicker}>DIRECTOR'S NOTE</Text>
                <TextInput
                  accessibilityLabel="Director's note"
                  value={note}
                  onChangeText={setNote}
                  placeholder={snapshot.directorNoteUsed
                    ? 'Your one intervention is already in the script.'
                    : directionDisabled
                      ? 'Wait for the actor to finish this line.'
                      : 'Make them explain the second bride...'}
                  placeholderTextColor="#706658"
                  multiline
                  editable={!directionDisabled}
                  maxLength={120}
                  style={[styles.directionInput, directionDisabled && styles.directionInputDisabled]}
                />
                <View style={styles.directionFooter}>
                  <Text style={styles.noteCounter}>{snapshot.directorNoteUsed ? 'intervention spent' : directionDisabled ? 'actor response pending' : `${note.length}/120 · costs memory`}</Text>
                  <ActionButton label={snapshot.directorNoteUsed ? 'Note sent' : 'Send note'} variant="ghost" disabled={directionDisabled || !note.trim()} onPress={submitDirection} />
                </View>
              </View>

              <View style={styles.stageActions}>
                {snapshot.canAdvance ? (
                  <ActionButton label={busy ? 'Generating performance...' : actionLabel} disabled={busy} onPress={onAdvance} />
                ) : (
                  <ActionButton label={busy ? 'Writing the curtain...' : 'Bring down the curtain'} disabled={busy} variant="danger" onPress={onFinish} />
                )}
                <Text style={[styles.stageFootnote, fallbackReason && styles.fallbackFootnote]}>
                  {fallbackReason
                    ? 'Live AI was unavailable, so this turn used the offline performance.'
                    : canFinish(session)
                      ? 'The damage is done. End when ready.'
                      : 'Every line consumes the shared script.'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Paywall({
  visible,
  status,
  busy,
  error,
  onClose,
  onPurchase,
  onRestore,
}: {
  visible: boolean;
  status: MonetizationStatus;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onPurchase: (pkg: DirectorPackage) => void;
  onRestore: () => void;
}) {
  // Two things are for sale and they are not alternatives: the encore is one
  // more show tonight, the pass is every show forever.
  const encore = status.packages.find(isEncorePackage);
  const pass = status.packages.find((item) => !isEncorePackage(item));
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalShade}>
        <View style={styles.paywallCard}>
          <Text style={styles.paywallKicker}>THE BOX OFFICE</Text>
          <Text style={styles.paywallTitle}>The curtain never has to close.</Text>
          <Text style={styles.paywallBody}>One performance is free every day. Buy a single encore for tonight, or the pass for every night.</Text>
          <View style={styles.paywallBenefits}>
            <Text style={styles.paywallBenefit}>◆ Unlimited performances</Text>
            <Text style={styles.paywallBenefit}>◆ No house ad at the curtain</Text>
            <Text style={styles.paywallBenefit}>◆ Restore access across supported devices</Text>
          </View>
          {encore && (
            <ActionButton
              label={busy ? 'Contacting the box office...' : `One encore for ${encore.price || 'the listed price'}`}
              variant="ghost"
              disabled={busy}
              onPress={() => onPurchase(encore)}
            />
          )}
          {pass ? (
            <ActionButton
              label={busy ? 'Contacting the box office...' : `Director's Pass for ${pass.price || 'the listed price'}`}
              disabled={busy}
              onPress={() => onPurchase(pass)}
            />
          ) : encore ? null : (
            <Text style={styles.paywallUnavailable}>
              {status.configured
                ? 'The current RevenueCat offering has no package yet.'
                : 'Billing is not configured in this build. Add a public RevenueCat Test Store or platform API key.'}
            </Text>
          )}
          <ActionButton label={busy ? 'Please wait...' : 'Restore purchases'} variant="ghost" disabled={busy || !status.configured} onPress={onRestore} />
          <ActionButton label="Not tonight" variant="ghost" disabled={busy} onPress={onClose} />
          {error && <Text style={styles.paywallError}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
}

function HouseAd() {
  return (
    <View style={styles.houseAd}>
      <Text style={styles.houseAdKicker}>THE INTERVAL IS SPONSORED</Text>
      <Text style={styles.houseAdCopy}>
        The interval belongs to the house. The performance never does. The Director's Pass
        removes this card for good.
      </Text>
    </View>
  );
}

function Drift({
  session,
  houseAd,
  onReplay,
  onNewPlay,
}: {
  session: GameSession;
  houseAd: boolean;
  onReplay: () => void;
  onNewPlay: () => void;
}) {
  const drift = session.engine.drift();
  const pinned = drift.survived[0];
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.driftScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.driftHeader}>
          <Text style={styles.driftKicker}>CURTAIN · THE DAMAGE REPORT</Text>
          <Text style={styles.driftTitle}>They began in one play.{`\n`}They ended in three.</Text>
          <Text style={styles.driftBody}>
            {drift.forgottenCount} beats vanished from shared memory. The cast never admitted a gap. They simply replaced it.
          </Text>
        </View>

        <View style={styles.driftStats}>
          <View style={styles.stat}><Text style={styles.statValue}>{drift.forgottenCount}</Text><Text style={styles.statLabel}>BEATS FORGOTTEN</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{session.engine.memoryTokens()}</Text><Text style={styles.statLabel}>TOKENS AT CURTAIN</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{pinned ? '1' : '0'}</Text><Text style={styles.statLabel}>TRUTH SURVIVED</Text></View>
        </View>

        {pinned && (
          <View style={styles.survivorBanner}>
            <Text style={styles.survivorMark}>◆</Text>
            <View style={styles.survivorCopy}>
              <Text style={styles.survivorKicker}>THE ONE THING STILL STANDING</Text>
              <Text style={styles.survivorText}>{pinned.text}</Text>
            </View>
          </View>
        )}

        <View style={styles.driftCards}>
          {drift.entries.map((entry, index) => (
            <View key={entry.speaker} style={styles.driftCard}>
              <View style={styles.driftCardHeader}>
                <Text style={styles.driftIndex}>0{index + 1}</Text>
                <Text style={styles.driftActor}>{entry.emoji}  {entry.speaker}</Text>
              </View>
              <View style={styles.driftCompare}>
                <View style={styles.driftSide}>
                  <Text style={styles.driftSideLabel}>FIRST CERTAINTY</Text>
                  <Text style={styles.driftQuote}>“{entry.first}”</Text>
                </View>
                <Text style={styles.driftArrow}>→</Text>
                <View style={styles.driftSide}>
                  <Text style={[styles.driftSideLabel, styles.driftSideLabelHot]}>FINAL CERTAINTY</Text>
                  <Text style={[styles.driftQuote, styles.driftQuoteHot]}>“{entry.last}”</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {houseAd && <HouseAd />}

        <View style={styles.driftActions}>
          <ActionButton label="Perform again" onPress={onReplay} />
          <ActionButton label="Choose another disaster" variant="ghost" onPress={onNewPlay} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [performance, setPerformance] = useState<PerformanceSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState<DailyPassState | null>(null);
  const [monetization, setMonetization] = useState(emptyMonetization);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const session = performance?.session ?? null;
  const fade = useRef(new Animated.Value(1)).current;
  const premise = useMemo(
    () => PREMISES.find((item) => item.id === session?.premiseId) ?? PREMISES[0],
    [session?.premiseId],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([ledgerStorage.load(), revenueCat.status()])
      .then(([ledger, status]) => {
        if (!active) return;
        setMonetization(status);
        setPass(normalizeDailyPass(ledger, new Date(), status.unlimited));
      })
      .catch(() => {
        if (active) setPass(normalizeDailyPass(null, new Date(), false));
      });
    return () => { active = false; };
  }, []);

  // The one rule the whole day was about: an offer may never interrupt a
  // performance, so every route to the paywall goes through here.
  const showPaywall = () => {
    if (!canOfferPurchase(momentForScreen(screen))) return;
    setPaywallVisible(true);
  };

  const transition = (next: Screen) => {
    Animated.timing(fade, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setScreen(next);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const start = async (choice: PremiseOption) => {
    const currentPass = normalizeDailyPass(
      pass ? ledgerFromState(pass) : null,
      new Date(),
      monetization.unlimited,
    );
    if (!canStartPerformance(currentPass)) {
      setPass(currentPass);
      showPaywall();
      return;
    }
    const consumed = consumePerformance(currentPass);
    setPass(consumed);
    await ledgerStorage.save(ledgerFromState(consumed));

    const next = createPerformanceSession(choice.id, choice.premise);
    setPerformance(next);
    setBusy(true);
    transition('stage');
    await performanceProvider.open(next);
    setBusy(false);
    setRevision((value) => value + 1);
  };

  const advance = async () => {
    if (!performance || busy) return;
    setBusy(true);
    await performanceProvider.advance(performance);
    setBusy(false);
    setRevision((value) => value + 1);
  };

  const finish = async () => {
    if (!performance || busy) return;
    setBusy(true);
    await performanceProvider.finish(performance);
    setBusy(false);
    setRevision((value) => value + 1);
    transition('drift');
  };

  const updateMonetization = (status: MonetizationStatus) => {
    setMonetization(status);
    setPass((current) => normalizeDailyPass(
      current ? ledgerFromState(current) : null,
      new Date(),
      status.unlimited,
    ));
    if (status.unlimited) setPaywallVisible(false);
  };

  const purchase = async (pkg: DirectorPackage) => {
    setPaywallBusy(true);
    setPaywallError(null);
    try {
      const status = await revenueCat.purchase(pkg);
      updateMonetization(status);
      // A consumable flips no entitlement, so the extra show is recorded here.
      if (isEncorePackage(pkg) && !status.unlimited) {
        const current = normalizeDailyPass(pass ? ledgerFromState(pass) : null, new Date(), status.unlimited);
        const bought = grantEncore(current);
        setPass(bought);
        await ledgerStorage.save(ledgerFromState(bought));
      }
      setPaywallVisible(false);
    } catch (error) {
      setPaywallError(error instanceof Error ? error.message : 'Purchase failed');
    } finally {
      setPaywallBusy(false);
    }
  };

  const restore = async () => {
    setPaywallBusy(true);
    setPaywallError(null);
    try {
      updateMonetization(await revenueCat.restore());
    } catch (error) {
      setPaywallError(error instanceof Error ? error.message : 'Restore failed');
    } finally {
      setPaywallBusy(false);
    }
  };

  const mutate = (operation: (value: PerformanceSession) => void) => {
    if (!performance) return;
    operation(performance);
    setRevision((value) => value + 1);
  };

  const replay = () => {
    if (!premise) return;
    start(premise);
  };

  return (
    <View style={styles.app} key={revision > -1 ? 'game' : 'unused'}>
      <StatusBar style="light" />
      <Animated.View style={[styles.flex, { opacity: fade }]}>
        {screen === 'lobby' && (
          <Lobby
            pass={pass}
            onShowPaywall={showPaywall}
            onStart={(choice) => { void start(choice); }}
          />
        )}
        {screen === 'stage' && session && performance && (
          <Stage
            session={session}
            mode={performance.mode}
            busy={busy}
            fallbackReason={performance.lastFallbackReason}
            onAdvance={() => { void advance(); }}
            onDirection={(note) => mutate((value) => { performanceProvider.direction(value, note); })}
            onPin={(id) => mutate((value) => { pinBeat(value.session, id); })}
            onFinish={() => { void finish(); }}
            onExit={() => transition('lobby')}
          />
        )}
        {screen === 'drift' && session && (
          <Drift
            session={session}
            houseAd={shouldShowHouseAd(momentForScreen(screen), monetization.unlimited)}
            onReplay={replay}
            onNewPlay={() => transition('lobby')}
          />
        )}
      </Animated.View>
      <Paywall
        visible={paywallVisible}
        status={monetization}
        busy={paywallBusy}
        error={paywallError}
        onClose={() => setPaywallVisible(false)}
        onPurchase={(pkg) => { void purchase(pkg); }}
        onRestore={() => { void restore(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.ink },
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.ink },
  lobbyScroll: { flexGrow: 1, paddingHorizontal: '5%', paddingTop: 22, paddingBottom: 44 },
  wordmark: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 18, marginBottom: 42 },
  wordmarkKicker: { color: colors.gold, fontSize: 10, letterSpacing: 2.5, fontWeight: '800' },
  wordmarkTitle: { color: colors.paper, fontSize: 17, marginTop: 8, letterSpacing: 4.4, fontWeight: '900' },
  lobbyGrid: { flex: 1, flexDirection: 'row', gap: 54, alignItems: 'center', maxWidth: 1240, alignSelf: 'center', width: '100%' },
  lobbyGridCompact: { flexDirection: 'column', alignItems: 'stretch' },
  heroColumn: { flex: 1.2, minWidth: 0 },
  eyebrow: { color: colors.ember, fontSize: 11, letterSpacing: 2.4, fontWeight: '800', marginBottom: 16 },
  heroTitle: { color: colors.paper, fontSize: 54, lineHeight: 58, letterSpacing: -2.2, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontWeight: '700' },
  heroBody: { color: colors.smoke, fontSize: 17, lineHeight: 27, maxWidth: 620, marginTop: 22 },
  rulesBox: { marginTop: 38, borderTopWidth: 1, borderTopColor: colors.line },
  rule: { flexDirection: 'row', gap: 18, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.line },
  ruleNumber: { color: colors.gold, fontSize: 11, letterSpacing: 1.8, fontWeight: '900', width: 26 },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: colors.paper, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  ruleBody: { color: colors.smoke, fontSize: 13, lineHeight: 19 },
  ticket: { flex: 0.8, backgroundColor: colors.paper, padding: 26, borderRadius: 3, minWidth: 320, maxWidth: 480, alignSelf: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.38, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#c8bca8' },
  ticketKicker: { color: '#5c5245', fontSize: 10, letterSpacing: 1.9, fontWeight: '900' },
  ticketNumber: { color: '#817564', fontSize: 10, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  premiseList: { paddingVertical: 16, gap: 9 },
  premiseCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: '#cfc3ae', padding: 15, backgroundColor: '#f6efdf' },
  premiseCardActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  premiseCardPressed: { transform: [{ scale: 0.99 }] },
  radio: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: '#8c806e' },
  radioActive: { borderColor: colors.gold, borderWidth: 4 },
  premiseCopy: { flex: 1 },
  premiseEyebrow: { color: '#8a7d69', fontSize: 9, letterSpacing: 1.3, fontWeight: '800', textTransform: 'uppercase' },
  premiseEyebrowActive: { color: colors.gold },
  premiseTitle: { color: '#1e1914', fontSize: 16, fontWeight: '800', marginTop: 3 },
  premiseTitleActive: { color: colors.paper },
  castPreview: { borderTopWidth: 1, borderTopColor: '#c8bca8', paddingTop: 18, marginBottom: 22 },
  castRow: { flexDirection: 'row', gap: 9, marginTop: 12, flexWrap: 'wrap' },
  castChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 9, borderWidth: 1, borderColor: '#c8bca8' },
  castMonogram: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', lineHeight: 22, backgroundColor: '#1e1914', color: colors.gold, fontSize: 10, fontWeight: '900' },
  castName: { color: '#3d352b', fontSize: 12, fontWeight: '800' },
  actionButton: { minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.gold },
  actionGhost: { backgroundColor: 'transparent', borderColor: colors.line },
  actionDanger: { backgroundColor: colors.ember, borderColor: colors.ember },
  actionDisabled: { opacity: 0.35 },
  actionPressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
  actionLabel: { color: colors.ink, fontSize: 12, letterSpacing: 1.3, fontWeight: '900', textTransform: 'uppercase' },
  actionGhostLabel: { color: colors.paper },
  actionDangerLabel: { color: '#fff8ef' },
  demoNote: { color: '#786c5a', fontSize: 10, textAlign: 'center', marginTop: 12 },
  dailyPassPanel: { borderWidth: 1, borderColor: '#c8bca8', padding: 12, marginBottom: 12, backgroundColor: '#eee2ce' },
  dailyPassKicker: { color: '#7b5515', fontSize: 9, letterSpacing: 1.5, fontWeight: '900' },
  dailyPassCopy: { color: '#4f4538', fontSize: 11, lineHeight: 17, marginTop: 5 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  paywallCard: { width: '100%', maxWidth: 480, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.gold, padding: 24, gap: 12 },
  paywallKicker: { color: colors.gold, fontSize: 10, letterSpacing: 2.2, fontWeight: '900' },
  paywallTitle: { color: colors.paper, fontSize: 32, lineHeight: 36, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontWeight: '700' },
  paywallBody: { color: colors.smoke, fontSize: 14, lineHeight: 22 },
  paywallBenefits: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 8 },
  paywallBenefit: { color: colors.paper, fontSize: 13 },
  paywallUnavailable: { color: colors.gold, fontSize: 12, lineHeight: 18, borderWidth: 1, borderColor: colors.goldSoft, padding: 12 },
  paywallError: { color: colors.ember, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  houseAd: { borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 22, backgroundColor: colors.panelSoft },
  houseAdKicker: { color: colors.smoke, fontSize: 9, letterSpacing: 1.8, fontWeight: '900' },
  houseAdCopy: { color: colors.smoke, fontSize: 12, lineHeight: 19, marginTop: 6 },
  stageShell: { flexGrow: 1, paddingHorizontal: '3.5%', paddingTop: 16, paddingBottom: 18, minHeight: '100%' },
  stageHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 14 },
  backLabel: { color: colors.smoke, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' },
  stageTitleBlock: { flex: 1, alignItems: 'center' },
  stageKicker: { color: colors.ember, fontSize: 9, letterSpacing: 2, fontWeight: '900' },
  liveStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  modeBadge: { borderWidth: 1, borderColor: colors.mint, paddingVertical: 3, paddingHorizontal: 6 },
  modeBadgeOffline: { borderColor: colors.gold },
  modeBadgeText: { color: colors.paper, fontSize: 7, letterSpacing: 1.1, fontWeight: '900' },
  stageTitle: { color: colors.paper, fontSize: 18, marginTop: 5, textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  roundPill: { minWidth: 72, borderWidth: 1, borderColor: colors.line, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  roundPillTop: { color: colors.smoke, fontSize: 8, letterSpacing: 1.4, fontWeight: '800' },
  roundPillValue: { color: colors.paper, fontSize: 15, fontWeight: '900', marginTop: 2 },
  stageGrid: { flex: 1, flexDirection: 'row', gap: 18, paddingTop: 18, minHeight: 0 },
  stageGridCompact: { flexDirection: 'column' },
  scriptPanel: { flex: 1.25, backgroundColor: '#0d0b09', borderWidth: 1, borderColor: colors.line, minHeight: 320 },
  scriptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line },
  scriptHeading: { color: colors.paper, fontSize: 10, letterSpacing: 1.8, fontWeight: '900' },
  scriptCount: { color: colors.smoke, fontSize: 10 },
  scriptScroll: { flex: 1 },
  scriptContent: { padding: 14, gap: 10, paddingBottom: 44 },
  beatCard: { backgroundColor: colors.panel, borderLeftWidth: 2, borderLeftColor: '#655443', padding: 14 },
  beatNarration: { backgroundColor: '#121922', borderLeftColor: '#6e8eaa' },
  beatDirection: { backgroundColor: '#211810', borderLeftColor: colors.ember },
  beatSeed: { backgroundColor: '#11100e', borderLeftColor: '#50483d' },
  beatPinned: { borderWidth: 1, borderColor: colors.gold, borderLeftWidth: 3, borderLeftColor: colors.gold, backgroundColor: '#201a10' },
  beatMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 },
  beatIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  beatGlyph: { width: 23, height: 23, borderRadius: 12, overflow: 'hidden', textAlign: 'center', lineHeight: 23, backgroundColor: '#2b241d', color: colors.gold, fontSize: 10, fontWeight: '900' },
  beatSpeaker: { color: colors.paper, fontSize: 12, fontWeight: '900' },
  beatKind: { color: colors.smoke, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase' },
  beatText: { color: '#d6cbb9', fontSize: 15, lineHeight: 22, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  beatTextSeed: { color: colors.smoke, fontStyle: 'italic' },
  pinButton: { paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: colors.goldSoft },
  pinButtonText: { color: colors.gold, fontSize: 8, letterSpacing: 1.2, fontWeight: '900' },
  pinnedBadge: { paddingVertical: 6, paddingHorizontal: 8, backgroundColor: colors.gold },
  pinnedBadgeText: { color: colors.ink, fontSize: 8, letterSpacing: 1.1, fontWeight: '900' },
  evictionNotice: { borderWidth: 1, borderColor: '#683226', backgroundColor: '#21110e', padding: 14, marginTop: 4 },
  evictionKicker: { color: colors.ember, fontSize: 9, letterSpacing: 1.7, fontWeight: '900', marginBottom: 7 },
  evictionText: { color: '#c99b8e', fontSize: 12, lineHeight: 18, textDecorationLine: 'line-through' },
  contradictionCard: { borderWidth: 2, borderColor: colors.gold, backgroundColor: '#17130c', padding: 14, marginTop: 4 },
  contradictionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.goldSoft, paddingBottom: 10, marginBottom: 4 },
  contradictionKicker: { color: colors.gold, fontSize: 10, letterSpacing: 1.8, fontWeight: '900' },
  contradictionStatus: { color: colors.paper, fontSize: 8, lineHeight: 12, letterSpacing: 1, fontWeight: '900', textAlign: 'right', flex: 1 },
  contradictionStep: { flexDirection: 'row', gap: 11, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 },
  contradictionNumber: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', lineHeight: 22, backgroundColor: colors.ember, color: '#fff8ef', fontSize: 10, fontWeight: '900' },
  contradictionCopy: { flex: 1 },
  contradictionLabel: { color: colors.gold, fontSize: 8, letterSpacing: 1.2, fontWeight: '900', marginBottom: 4 },
  contradictionText: { color: colors.paper, fontSize: 13, lineHeight: 19, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  contradictionWaiting: { color: colors.smoke, fontStyle: 'italic' },
  queuedEvictions: { borderWidth: 1, borderColor: '#683226', backgroundColor: '#160e0c', padding: 12, marginTop: 4 },
  queuedEvictionsKicker: { color: colors.ember, fontSize: 8, letterSpacing: 1.3, fontWeight: '900', marginBottom: 6 },
  queuedEvictionsText: { color: '#c99b8e', fontSize: 11, lineHeight: 17, textDecorationLine: 'line-through' },
  controlPanel: { width: 360, maxWidth: '100%', alignSelf: 'stretch', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 17, gap: 16 },
  meterLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  meterTitle: { color: colors.paper, fontSize: 9, letterSpacing: 1.7, fontWeight: '900' },
  meterValue: { color: colors.gold, fontSize: 10, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  meterTrack: { height: 11, backgroundColor: '#29231d', overflow: 'hidden', position: 'relative' },
  meterFill: { height: '100%', backgroundColor: colors.gold },
  meterDangerLine: { position: 'absolute', height: '100%', width: 1, backgroundColor: colors.ember, left: '82%' },
  meterLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  meterHint: { color: '#746a5d', fontSize: 9 },
  meterHintHot: { color: colors.ember },
  truthPanel: { borderWidth: 1, borderColor: colors.goldSoft, backgroundColor: '#1e180e', padding: 14, minHeight: 108 },
  controlKicker: { color: colors.smoke, fontSize: 9, letterSpacing: 1.5, fontWeight: '900', marginBottom: 10 },
  truthMark: { color: colors.gold, fontSize: 15, marginBottom: 7 },
  truthValue: { color: colors.paper, fontSize: 14, lineHeight: 20, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  truthEmpty: { color: '#8e806e', fontSize: 12, lineHeight: 18 },
  nextPanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15 },
  nextActor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextMonogram: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', textAlign: 'center', lineHeight: 42, color: colors.gold, backgroundColor: '#29231d', fontWeight: '900' },
  nextName: { color: colors.paper, fontSize: 15, fontWeight: '900' },
  nextPersona: { color: colors.smoke, fontSize: 10, lineHeight: 15, marginTop: 2, maxWidth: 240 },
  directionPanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15 },
  directionInput: { minHeight: 76, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.paper, padding: 11, textAlignVertical: 'top', fontSize: 13, lineHeight: 18 },
  directionInputDisabled: { opacity: 0.48 },
  directionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  noteCounter: { color: '#766b5e', fontSize: 9 },
  stageActions: { marginTop: 'auto', gap: 9 },
  stageFootnote: { color: '#766b5e', fontSize: 9, textAlign: 'center' },
  fallbackFootnote: { color: colors.gold },
  driftScroll: { paddingHorizontal: '5%', paddingTop: 44, paddingBottom: 60, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  driftHeader: { maxWidth: 760, alignSelf: 'center', alignItems: 'center' },
  driftKicker: { color: colors.ember, fontSize: 10, letterSpacing: 2.4, fontWeight: '900' },
  driftTitle: { color: colors.paper, fontSize: 48, lineHeight: 53, textAlign: 'center', letterSpacing: -1.7, marginTop: 18, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontWeight: '700' },
  driftBody: { color: colors.smoke, fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 620, marginTop: 18 },
  driftStats: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, marginTop: 38, marginBottom: 18 },
  stat: { flex: 1, padding: 18, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line },
  statValue: { color: colors.gold, fontSize: 28, fontWeight: '900' },
  statLabel: { color: colors.smoke, fontSize: 8, letterSpacing: 1.4, fontWeight: '900', marginTop: 5, textAlign: 'center' },
  survivorBanner: { flexDirection: 'row', alignItems: 'center', gap: 17, borderWidth: 1, borderColor: colors.gold, backgroundColor: '#1e180e', padding: 18, marginBottom: 18 },
  survivorMark: { color: colors.gold, fontSize: 24 },
  survivorCopy: { flex: 1 },
  survivorKicker: { color: colors.gold, fontSize: 9, letterSpacing: 1.5, fontWeight: '900', marginBottom: 5 },
  survivorText: { color: colors.paper, fontSize: 15, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  driftCards: { gap: 12 },
  driftCard: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18 },
  driftCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 12, marginBottom: 15 },
  driftIndex: { color: colors.gold, fontSize: 10, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  driftActor: { color: colors.paper, fontSize: 15, fontWeight: '900' },
  driftCompare: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  driftSide: { flex: 1 },
  driftSideLabel: { color: colors.mint, fontSize: 8, letterSpacing: 1.4, fontWeight: '900', marginBottom: 8 },
  driftSideLabelHot: { color: colors.ember },
  driftQuote: { color: '#c8d8cf', fontSize: 14, lineHeight: 21, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  driftQuoteHot: { color: '#e5b0a4' },
  driftArrow: { color: colors.gold, fontSize: 18 },
  driftActions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
});
