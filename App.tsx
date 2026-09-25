import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AccessibilityInfo,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar as NativeStatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  createLayersClient,
  type ReminderVariant,
} from './src/analytics/layers.ts';
import type { Beat, Character, Drift as DriftReport } from './src/engine/types.ts';
import { readPublicConfig, resolveGenerationEndpoint } from './src/config/public.ts';
import { CAST, PREMISES, type PremiseOption } from './src/game/content.ts';
import {
  createPerformanceProvider,
  createPerformanceSession,
  createRehearsalSession,
  performanceDrift,
  performanceSnapshot,
  type PerformanceMode,
  type PerformanceSession,
} from './src/game/performance.ts';
import {
  directorNoteDraftAfterAttempt,
  type GameSession,
  type SessionSnapshot,
} from './src/game/session.ts';
import { createLivePerformanceClient } from './src/live/client.ts';
import { normalizePerformanceCast } from './src/live/contract.ts';
import {
  createOneSignalClient,
  type ReminderPermission,
} from './src/engagement/onesignal.ts';
import {
  canStartPerformance,
  ledgerFromState,
  normalizeDailyPass,
  type DailyPassState,
} from './src/monetization/daily-pass.ts';
import {
  bootstrapMonetization,
  reconcilePassWithMonetization,
  unconfiguredMonetization,
} from './src/monetization/bootstrap.ts';
import { dailyPassAccess } from './src/monetization/access.ts';
import {
  consumeAndPersistPerformance,
  consumeSessionEncore,
  createPerformanceLaunchGate,
  recordPurchasedEncore,
  settlePerformanceConsumption,
} from './src/monetization/launch.ts';
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
import { TheaterSet } from './src/ui/TheaterSet.tsx';
import { CastEditor } from './src/ui/CastEditor.tsx';
import { installWebSurfaceStyles } from './src/ui/web-surface.ts';

const publicConfig = readPublicConfig();
const performanceProvider = createPerformanceProvider(createLivePerformanceClient({
  platform: Platform.OS,
  endpoint: resolveGenerationEndpoint(Platform.OS, publicConfig.generationEndpoint),
  accessKey: publicConfig.generationAccessKey,
}));
const ledgerStorage = createLedgerStorage(() => import('@react-native-async-storage/async-storage'));
const revenueCat = createRevenueCatClient({
  platform: Platform.OS,
  publicKeys: publicConfig.revenueCat,
  loadPurchases: () => import('react-native-purchases'),
});
const oneSignal = createOneSignalClient({
  platform: Platform.OS,
  appId: publicConfig.oneSignalAppId,
});
const layers = createLayersClient({
  platform: Platform.OS,
  appId: publicConfig.layersAppId,
  debug: __DEV__,
});

const DIRECTOR_CUES = [
  'A storm breaks',
  'An enemy returns',
  'Someone confesses',
  'Reveal the secret',
] as const;

const androidStatusBarHeight = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;
const CAST_STORAGE_KEY = 'forgetting-stage:cast:v1';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'gold' | 'ghost' | 'ticket' | 'danger';
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
        variant === 'ticket' && styles.actionTicket,
        variant === 'danger' && styles.actionDanger,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <Text
        style={[
          styles.actionLabel,
          variant === 'ghost' && styles.actionGhostLabel,
          variant === 'ticket' && styles.actionTicketLabel,
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
      <Text style={styles.wordmarkTitle}>THE FORGETTING STAGE</Text>
      <Text style={styles.wordmarkKicker}>A machine for funny disasters</Text>
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
  ledgerAvailable,
  sessionEncoreCredits,
  launchBusy,
  accessMessage,
  onShowPaywall,
  onRehearse,
  onResume,
  cast,
  onEditCast,
}: {
  onStart: (premise: PremiseOption) => void | Promise<void>;
  pass: DailyPassState | null;
  ledgerAvailable: boolean | null;
  sessionEncoreCredits: number;
  launchBusy: boolean;
  accessMessage: string | null;
  onShowPaywall: () => void;
  onRehearse: (premise: PremiseOption) => void;
  onResume: (() => void) | null;
  cast: Character[];
  onEditCast: () => void;
}) {
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(PREMISES[0]?.id ?? 'wedding');
  const [showRules, setShowRules] = useState(false);
  const compact = width < 760;
  const choice = PREMISES.find((item) => item.id === selected) ?? PREMISES[0];
  const access = dailyPassAccess(pass, ledgerAvailable, sessionEncoreCredits);
  if (!choice) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.lobbyScroll, compact && styles.lobbyScrollCompact]}>
        <Wordmark />
        <View style={[styles.lobbyGrid, compact && styles.lobbyGridCompact]}>
          <View style={styles.heroColumn}>
            <Text accessibilityRole="header" style={[styles.heroTitle, compact && styles.heroTitleCompact]}>One memory.{`\n`}Three certainties.</Text>
            <Text style={[styles.heroBody, compact && styles.heroBodyCompact]}>
              Direct a cast that forgets its own story. Save one line. Watch everything else become negotiable.
            </Text>
            <TheaterSet cast={cast} compact={compact} caption={compact ? undefined : 'The company is ready. Their memories are not.'} />
            <Pressable accessibilityRole="button" onPress={onEditCast} style={styles.castEditButton}>
              <Text style={styles.castEditText}>Meet & edit the company</Text>
              <Text style={styles.castEditMeta}>{cast.length} characters</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRules }} onPress={() => setShowRules(!showRules)} style={styles.rulesToggle}>
              <Text style={styles.rulesToggleText}>{showRules ? 'Close the playbook' : 'How to direct your first play'}</Text>
              <Text style={styles.rulesToggleText}>{showRules ? '−' : '+'}</Text>
            </Pressable>
            {showRules && <View style={styles.rulesBox}>
              <Rule number="01" title="Direct the play" copy="Choose the premise and intervene when the story needs a dangerous nudge." />
              <Rule number="02" title="Pin one truth" copy="One beat survives every eviction. Choose it before the cast rewrites the world." />
              <Rule number="03" title="Study the wreckage" copy="At curtain, compare where each actor began with the certainty they ended on." />
            </View>}
          </View>

          <View style={[styles.ticket, compact && styles.ticketCompact]}>
            <View style={styles.ticketTop}>
              <Text accessibilityRole="header" style={styles.ticketHeading}>Choose tonight’s play</Text>
              <Text style={styles.ticketNumber}>ADMIT ONE</Text>
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
            {onResume && <View style={styles.resumePanel}>
              <Text style={styles.dailyPassCopy}>Your unfinished performance is still here.</Text>
              <ActionButton label="Return to your performance" variant="ticket" onPress={onResume} disabled={launchBusy} />
            </View>}
            <View style={styles.dailyPassPanel}>
              <Text style={styles.dailyPassKicker}>
                {access === 'checking'
                  ? 'CHECKING DAILY ACCESS'
                  : pass?.unlimited
                    ? "DIRECTOR'S PASS ACTIVE"
                    : ledgerAvailable === false && sessionEncoreCredits > 0
                      ? 'SESSION ENCORE READY'
                      : ledgerAvailable === false
                      ? 'LOCAL ACCESS UNAVAILABLE'
                      : 'DAILY CURTAIN'}
              </Text>
              <Text style={styles.dailyPassCopy}>
                {access === 'checking'
                  ? 'Checking today’s curtain before we admit the company.'
                  : pass?.unlimited
                  ? 'Unlimited performances are unlocked.'
                  : ledgerAvailable === false && sessionEncoreCredits > 0
                    ? 'Your purchased encore is ready for this run. Local saving is still unavailable.'
                  : ledgerAvailable === false
                    ? 'We could not safely verify today’s local ticket. The box office can still restore unlimited access.'
                  : pass && pass.remaining < 1
                    ? pass.encores > 0
                      ? `Today’s free performance is spent. ${pass.encores} encore${pass.encores > 1 ? 's' : ''} waiting.`
                      : 'Today’s free AI performance is spent. Your curtain refreshes at local midnight.'
                    : 'One complete AI performance is free every day.'}
              </Text>
            </View>
            <View style={styles.ticketActions}><ActionButton
              label={launchBusy
                ? 'Preparing the stage...'
                : access === 'checking'
                ? 'Checking access...'
                : access === 'start' && ledgerAvailable === false && sessionEncoreCredits > 0
                  ? 'Use session encore'
                : access === 'start' && pass && pass.remaining < 1 && !pass.unlimited
                  ? 'Use an encore'
                  : access === 'start'
                    ? 'Raise the curtain'
                    : 'See tonight’s options'}
              disabled={access === 'checking' || launchBusy}
              onPress={() => {
                if (access === 'checking') return;
                if (access === 'start') void onStart(choice);
                else onShowPaywall();
              }}
            />
            <ActionButton label="Try an offline rehearsal" variant="ticket" disabled={launchBusy} onPress={() => onRehearse(choice)} />
            </View>
            {!pass?.unlimited && Platform.OS !== 'web' && (
              <ActionButton
                label={access === 'checking' ? 'Checking box office...' : "View Director's Pass"}
                variant="ticket"
                disabled={access === 'checking' || launchBusy}
                onPress={onShowPaywall}
              />
            )}
            {accessMessage && (
              <Text accessibilityLiveRegion="polite" style={styles.lobbyAccessMessage}>
                {accessMessage}
              </Text>
            )}
            <Text style={styles.demoNote}>Rehearsals use a prepared script and keep your daily AI ticket.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemoryMeter({
  used,
  budget,
  exact,
  forgottenCount,
}: {
  used: number;
  budget: number;
  exact: boolean;
  forgottenCount: number;
}) {
  const fraction = Math.min(1, used / budget);
  const underPressure = fraction > 0.8;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Shared memory" accessibilityValue={{ min: 0, max: budget, now: used }}>
      <View style={styles.meterLabels}>
        <Text style={styles.meterTitle}>SHARED MEMORY</Text>
        <Text style={styles.meterValue}>{used} / {budget} {exact ? 'MODEL TOKENS' : 'EST. TOKENS'}</Text>
      </View>
      <View style={[styles.meterTrack, underPressure && styles.meterTrackHot]}>
        <View style={[styles.meterFill, underPressure && styles.meterFillHot, { width: `${Math.max(3, fraction * 100)}%` }]} />
        <View style={styles.meterDangerLine} />
      </View>
      <View style={styles.meterLegend}>
        <Text style={[styles.meterHint, forgottenCount > 0 && styles.meterHintHot]}>
          {forgottenCount > 0 ? `${forgottenCount} beats already lost` : 'Oldest unpinned beats fall first'}
        </Text>
        <Text style={[styles.meterHint, underPressure && styles.meterHintHot]}>
          {underPressure ? 'EVICTION PRESSURE' : `${Math.round(fraction * 100)}% occupied`}
        </Text>
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
  snapshot,
  onAdvance,
  onDirection,
  onPin,
  onFinish,
  onExit,
  mode,
  serverActive,
  busy,
  fallbackReason,
  rehearsal,
}: {
  session: GameSession;
  snapshot: SessionSnapshot;
  onAdvance: () => void;
  onDirection: (note: string) => Promise<boolean>;
  onPin: (id: number) => void;
  onFinish: () => void;
  onExit: () => void;
  mode: PerformanceMode;
  serverActive: boolean;
  busy: boolean;
  fallbackReason: string | null;
  rehearsal: boolean;
}) {
  const { width } = useWindowDimensions();
  const [note, setNote] = useState('');
  const [scriptExpanded, setScriptExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const compact = width < 880;
  const feed = snapshot.memory.filter((beat) => beat.kind !== 'seed');
  const latestBeat = feed[feed.length - 1];
  const canPin = snapshot.pinnedCount === 0 && !busy;
  const forgettingDisplay = snapshot.forgettingDisplay;
  const contradiction = forgettingDisplay?.contradiction;
  const directionDisabled = snapshot.directorNoteUsed || busy || snapshot.actorResponsePending;
  const progress = Math.min(snapshot.maxRounds, snapshot.round);
  const actionLabel = snapshot.canAdvance
    ? `${snapshot.nextSpeaker?.name ?? 'Actor'} steps forward`
    : 'Ready for curtain';

  const submitDirection = async () => {
    const value = note.trim();
    if (!value || directionDisabled) return;
    const accepted = await onDirection(value);
    setNote((draft) => directorNoteDraftAfterAttempt(draft, accepted));
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
          <View style={[styles.stageHeader, compact && styles.stageHeaderCompact]}>
            <Pressable accessibilityRole="button" onPress={onExit} disabled={busy} style={styles.backButton}>
              <Text style={styles.backLabel}>Lobby</Text>
            </Pressable>
            <View style={styles.stageTitleBlock}>
              <View style={styles.liveStatusRow}>
                <View style={[styles.modeBadge, mode === 'offline' && styles.modeBadgeOffline]}>
                  <Text style={styles.modeBadgeText}>
                    {serverActive
                      ? mode === 'live' ? 'AI LIVE · EXACT 1K' : 'SERVER SAFE LINE'
                      : rehearsal ? 'OFFLINE REHEARSAL' : 'OFFLINE PREVIEW'}
                  </Text>
                </View>
              </View>
              <Text accessibilityRole="header" style={[styles.stageTitle, compact && styles.stageTitleCompact]}>{PREMISES.find((item) => item.id === session.premiseId)?.title ?? session.premise}</Text>
            </View>
            <View style={styles.roundPill}>
              <Text style={styles.roundPillTop}>ROUND</Text>
              <Text style={styles.roundPillValue}>{progress} / {snapshot.maxRounds}</Text>
            </View>
          </View>

          <View style={[styles.stageGrid, compact && styles.stageGridCompact]}>
            <View style={styles.scriptPanel}>
              <TheaterSet cast={session.engine.cast} compact={compact} small activeSpeaker={latestBeat?.kind === 'line' ? latestBeat.speaker : undefined} />
              <View style={styles.currentLine} accessibilityLiveRegion="polite">
                {latestBeat && <BeatCard beat={latestBeat} canPin={canPin} onPin={onPin} />}
                {!latestBeat && <Text style={styles.truthEmpty}>The company is taking its places…</Text>}
              </View>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: scriptExpanded }} onPress={() => setScriptExpanded(!scriptExpanded)} style={styles.scriptHeader}>
                <Text style={styles.scriptHeading}>{contradiction ? 'Inspect the forgetting chain' : 'Remembered script'}</Text>
                <Text style={styles.scriptCount}>{feed.length} beats · {scriptExpanded ? 'Hide' : 'Open'}</Text>
              </Pressable>
              {scriptExpanded && <ScrollView
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
              </ScrollView>}
            </View>

            <View style={[styles.controlPanel, compact && styles.controlPanelCompact]}>
              <MemoryMeter
                used={snapshot.memoryTokens}
                budget={snapshot.budget}
                exact={serverActive}
                forgottenCount={snapshot.forgotten.length}
              />

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

              <View style={styles.directionPanel}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: notesExpanded }} onPress={() => setNotesExpanded(!notesExpanded)} style={styles.notesToggle}>
                  <Text style={styles.scriptHeading}>{snapshot.directorNoteUsed ? 'Director’s note sent' : 'Give the cast a direction'}</Text>
                  <Text style={styles.scriptCount}>{notesExpanded ? 'Hide' : 'Open'}</Text>
                </Pressable>
                {notesExpanded && <View style={styles.noteEditor}>
                <TextInput
                  accessibilityLabel="Director's note"
                  value={note}
                  onChangeText={setNote}
                  placeholder={snapshot.directorNoteUsed
                    ? 'Your one intervention is already in the script.'
                    : directionDisabled
                      ? 'Wait for the actor to finish this line.'
                      : 'Make them explain the second bride...'}
                  placeholderTextColor={colors.smoke}
                  multiline
                  editable={!directionDisabled}
                  maxLength={120}
                  style={[styles.directionInput, directionDisabled && styles.directionInputDisabled]}
                />
                {!snapshot.directorNoteUsed && (
                  <View style={styles.directionCues}>
                    {DIRECTOR_CUES.map((cue) => (
                      <Pressable
                        key={cue}
                        accessibilityRole="button"
                        accessibilityLabel={`Use director cue: ${cue}`}
                        disabled={directionDisabled}
                        onPress={() => setNote(cue)}
                        style={({ pressed }) => [
                          styles.directionCue,
                          directionDisabled && styles.directionCueDisabled,
                          pressed && !directionDisabled && styles.directionCuePressed,
                        ]}
                      >
                        <Text style={styles.directionCueText}>{cue}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={styles.directionFooter}>
                  <Text style={styles.noteCounter}>{snapshot.directorNoteUsed ? 'intervention spent' : directionDisabled ? 'actor response pending' : `${note.length}/120 · costs memory`}</Text>
                  <ActionButton label={snapshot.directorNoteUsed ? 'Note sent' : 'Send note'} variant="ghost" disabled={directionDisabled || !note.trim()} onPress={() => { void submitDirection(); }} />
                </View>
                </View>}
              </View>
            </View>
          </View>
        </ScrollView>
              <View style={styles.stageActions}>
                {snapshot.canAdvance ? (
                  <ActionButton label={busy ? 'The cast is thinking…' : actionLabel} disabled={busy} onPress={onAdvance} />
                ) : snapshot.canFinish ? (
                  <ActionButton label={busy ? 'Writing the curtain...' : 'Bring down the curtain'} disabled={busy} variant="danger" onPress={onFinish} />
                ) : (
                  <ActionButton label="Return to the lobby" disabled={busy} variant="ghost" onPress={onExit} />
                )}
                <Text style={[styles.stageFootnote, (fallbackReason || snapshot.failureReason) && styles.fallbackFootnote]}>
                  {snapshot.failureReason
                    ? snapshot.failureReason
                    : fallbackReason
                    ? serverActive
                      ? 'This turn broke a model rule, so the server committed a safe deterministic line.'
                      : 'Live AI was unavailable, so this turn continued in the offline preview.'
                    : snapshot.canFinish
                      ? 'The damage is done. End when ready.'
                      : rehearsal ? 'Prepared script · no AI ticket used' : 'Every line consumes the shared script.'}
                </Text>
              </View>
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
      <Text style={styles.houseAdKicker}>FROM THE BOX OFFICE</Text>
      <Text style={styles.houseAdCopy}>
        The interval belongs to the house. The performance never does. The Director's Pass
        removes this card for good.
      </Text>
    </View>
  );
}

function Drift({
  drift,
  memoryTokens,
  houseAd,
  reminderStatus,
  reminderVariant,
  reminderBusy,
  onEnableReminder,
  onReplay,
  onNewPlay,
}: {
  drift: DriftReport;
  memoryTokens: number;
  houseAd: boolean;
  reminderStatus: ReminderPermission;
  reminderVariant: ReminderVariant;
  reminderBusy: boolean;
  onEnableReminder: () => void;
  onReplay: () => void;
  onNewPlay: () => void;
}) {
  const pinned = drift.survived[0];
  const { width } = useWindowDimensions();
  const compact = width < 600;
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.driftScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.driftHeader}>
          <Text accessibilityRole="header" style={[styles.driftTitle, compact && styles.driftTitleCompact]}>They began in one play.{`\n`}They ended in three.</Text>
          <Text style={styles.driftBody}>
            {drift.forgottenCount} beats vanished from shared memory. The cast never admitted a gap. They simply replaced it.
          </Text>
        </View>

        <View style={styles.driftStats}>
          <View style={styles.stat}><Text style={styles.statValue}>{drift.forgottenCount}</Text><Text style={styles.statLabel}>BEATS FORGOTTEN</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{memoryTokens}</Text><Text style={styles.statLabel}>TOKENS AT CURTAIN</Text></View>
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
              <View style={[styles.driftCompare, compact && styles.driftCompareCompact]}>
                <View style={styles.driftSide}>
                  <Text style={styles.driftSideLabel}>FIRST CERTAINTY</Text>
                  <Text style={styles.driftQuote}>“{entry.first}”</Text>
                </View>
                <Text style={styles.driftArrow}>{compact ? '↓' : '→'}</Text>
                <View style={styles.driftSide}>
                  <Text style={[styles.driftSideLabel, styles.driftSideLabelHot]}>FINAL CERTAINTY</Text>
                  <Text style={[styles.driftQuote, styles.driftQuoteHot]}>“{entry.last}”</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {reminderStatus !== 'unavailable' && (
          <View style={styles.reminderPanel}>
            <Text style={styles.reminderKicker}>TOMORROW'S CURTAIN</Text>
            <Text style={styles.reminderCopy}>
              {reminderStatus === 'enabled'
                ? 'You will get one cue when the next free performance is ready.'
                : reminderStatus === 'denied'
                  ? 'Notifications are off. You can allow them from system settings.'
                  : reminderStatus === 'error'
                    ? 'The reminder could not be set. Your daily ticket still refreshes normally.'
                    : reminderVariant === 'curiosity'
                      ? 'Cue one notification tomorrow, when a new cast is ready to destroy a different truth.'
                      : 'Ask for one notification when tomorrow’s free performance opens.'}
            </Text>
            <ActionButton
              label={reminderBusy
                ? 'Asking the stage manager...'
                : reminderStatus === 'enabled'
                  ? 'Reminder enabled'
                  : reminderVariant === 'curiosity'
                    ? 'Cue tomorrow’s disaster'
                    : 'Remind me tomorrow'}
              variant="ghost"
              disabled={reminderBusy || reminderStatus === 'enabled'}
              onPress={onEnableReminder}
            />
          </View>
        )}

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
  const [rehearsal, setRehearsal] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cast, setCast] = useState<Character[]>(() => CAST.map((actor) => ({ ...actor })));
  const [castEditorVisible, setCastEditorVisible] = useState(false);
  const [pendingLaunch, setPendingLaunch] = useState<{ choice: PremiseOption; rehearsal: boolean } | null>(null);
  const castTouched = useRef(false);
  const [busy, setBusy] = useState(false);
  const [pass, setPass] = useState<DailyPassState | null>(null);
  const [ledgerAvailable, setLedgerAvailable] = useState<boolean | null>(null);
  const [sessionEncoreCredits, setSessionEncoreCredits] = useState(0);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [monetization, setMonetization] = useState(unconfiguredMonetization);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [paywallError, setPaywallError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [reminderStatus, setReminderStatus] = useState<ReminderPermission>('unavailable');
  const [reminderVariant, setReminderVariant] = useState<ReminderVariant>('free_show');
  const [reminderBusy, setReminderBusy] = useState(false);
  const session = performance?.session ?? null;
  const currentSnapshot = performance ? performanceSnapshot(performance) : null;
  const fade = useRef(new Animated.Value(1)).current;
  const launchGate = useRef(createPerformanceLaunchGate()).current;
  const premise = useMemo(
    () => PREMISES.find((item) => item.id === session?.premiseId) ?? PREMISES[0],
    [session?.premiseId],
  );

  useEffect(() => {
    let active = true;
    const startup = bootstrapMonetization({
      loadLedger: () => ledgerStorage.load(),
      refreshRevenueCat: () => revenueCat.status(),
    });
    void Promise.all([startup.pass, startup.ledgerAvailable]).then(([loadedPass, available]) => {
      if (!active) return;
      setLedgerAvailable(available);
      setPass(loadedPass);
    });
    void startup.monetization.then((status) => {
      if (!active) return;
      setMonetization(status);
      setPass((current) => reconcilePassWithMonetization(current, status));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void oneSignal.initialize().then((configured) => {
      if (active) setReminderStatus(configured ? 'ready' : 'unavailable');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    void layers.initialize().then(() => layers.reminderVariant()).then(setReminderVariant);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return installWebSurfaceStyles();
  }, []);

  useEffect(() => {
    let active = true;
    void import('@react-native-async-storage/async-storage').then(async ({ default: storage }) => {
      const saved = await storage.getItem(CAST_STORAGE_KEY);
      if (active && saved && !castTouched.current) setCast(normalizePerformanceCast(JSON.parse(saved)));
    }).catch(() => { /* A missing or invalid saved cast keeps the original company playable. */ });
    return () => { active = false; };
  }, []);

  const saveCast = (next: Character[]) => {
    castTouched.current = true;
    setCast(next);
    setCastEditorVisible(false);
    void import('@react-native-async-storage/async-storage').then(({ default: storage }) =>
      storage.setItem(CAST_STORAGE_KEY, JSON.stringify(next)),
    ).catch(() => setAccessMessage('Your cast is ready for this visit, but this device could not save it for next time.'));
  };

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => listener.remove();
  }, []);

  useEffect(() => {
    const refresh = () => setPass((current) => {
      if (!current) return current;
      const next = normalizeDailyPass(ledgerFromState(current), new Date(), current.unlimited);
      return next.dayKey === current.dayKey ? current : next;
    });
    const timer = setInterval(refresh, 30_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, []);

  // The one rule the whole day was about: an offer may never interrupt a
  // performance, so every route to the paywall goes through here.
  const showPaywall = () => {
    if (!canOfferPurchase(momentForScreen(screen))) return;
    setPaywallVisible(true);
    void layers.track('paywall_opened', { screen });
  };

  const transition = (next: Screen) => {
    if (reduceMotion) {
      fade.stopAnimation();
      fade.setValue(1);
      setScreen(next);
      return;
    }
    Animated.timing(fade, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (!finished) return;
      setScreen(next);
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
  };

  const rehearse = (choice: PremiseOption) => {
    if (busy || launchBusy) return;
    setPerformance(createRehearsalSession(choice.id, choice.premise, cast));
    setRehearsal(true);
    setCompleted(false);
    setAccessMessage(null);
    transition('stage');
  };

  const start = async (choice: PremiseOption) => {
    try {
      await launchGate.run(async () => {
        setLaunchBusy(true);
        setAccessMessage(null);
        // A null pass or an unavailable ledger is unknown access, never a
        // fresh daily grant. A confirmed entitlement may bypass local storage.
        if (!pass) return;
        const currentPass = normalizeDailyPass(
          ledgerFromState(pass),
          new Date(),
          monetization.unlimited,
        );
        if (!canStartPerformance(currentPass)) {
          setPass(currentPass);
          showPaywall();
          return;
        }

        let admittedPass: DailyPassState;
        if (ledgerAvailable !== true && !currentPass.unlimited) {
          if (sessionEncoreCredits < 1 || currentPass.encores < 1) {
            setPass(currentPass);
            showPaywall();
            return;
          }
          admittedPass = consumeSessionEncore(currentPass);
          setSessionEncoreCredits((value) => Math.max(0, value - 1));
        } else {
          const consumption = await consumeAndPersistPerformance({
            pass: currentPass,
            saveLedger: (nextLedger) => ledgerStorage.save(nextLedger),
          });
          const settled = settlePerformanceConsumption(
            consumption,
            ledgerAvailable === true,
          );
          if (!settled.admitted) {
            setLedgerAvailable(settled.ledgerAvailable);
            setAccessMessage('The curtain stayed up because today’s ticket could not be saved. No performance was spent.');
            return;
          }
          admittedPass = settled.pass;
        }
        setPass(admittedPass);

        const next = createPerformanceSession(choice.id, choice.premise, cast);
        setPerformance(next);
        setRehearsal(false);
        setCompleted(false);
        setBusy(true);
        transition('stage');
        await performanceProvider.open(next);
        void layers.track('performance_started', {
          premise_id: choice.id,
          mode: next.serverActive && next.mode === 'live' ? 'live_ai' : 'offline_preview',
        });
        setBusy(false);
        setRevision((value) => value + 1);
      });
    } finally {
      setLaunchBusy(launchGate.isActive());
    }
  };

  const advance = async () => {
    if (!performance || busy) return;
    const forgottenBefore = new Set(performanceSnapshot(performance).forgotten.map((beat) => beat.id));
    setBusy(true);
    await performanceProvider.advance(performance);
    const advanced = performanceSnapshot(performance);
    advanced.forgotten
      .filter((beat) => beat.kind === 'seed' && !forgottenBefore.has(beat.id))
      .forEach((beat) => {
        void layers.track('memory_seed_forgotten', {
          premise_id: performance.session.premiseId,
          seed_speaker: beat.speaker,
        });
      });
    setBusy(false);
    setRevision((value) => value + 1);
  };

  const pin = async (beatId: number) => {
    if (!performance || busy) return;
    setBusy(true);
    await performanceProvider.pin(performance, beatId);
    setBusy(false);
    setRevision((value) => value + 1);
  };

  const direction = async (note: string): Promise<boolean> => {
    if (!performance || busy) return false;
    const forgottenBefore = new Set(performanceSnapshot(performance).forgotten.map((beat) => beat.id));
    setBusy(true);
    const accepted = await performanceProvider.direction(performance, note) !== null;
    setBusy(false);
    if (accepted) {
      performanceSnapshot(performance).forgotten
        .filter((beat) => beat.kind === 'seed' && !forgottenBefore.has(beat.id))
        .forEach((beat) => {
          void layers.track('memory_seed_forgotten', {
            premise_id: performance.session.premiseId,
            seed_speaker: beat.speaker,
          });
        });
      setRevision((value) => value + 1);
    }
    return accepted;
  };

  const finish = async () => {
    if (!performance || busy) return;
    setBusy(true);
    await performanceProvider.finish(performance);
    const completed = performanceSnapshot(performance);
    void oneSignal.trackPerformanceCompleted({
      premiseId: performance.session.premiseId,
      forgottenCount: completed.forgotten.length,
    });
    void layers.track('performance_completed', {
      premise_id: performance.session.premiseId,
      mode: performance.serverActive && performance.mode === 'live' ? 'live_ai' : 'offline_preview',
      forgotten_count: completed.forgotten.length,
      contradiction_count: completed.contradictions.filter((item) => item.complete).length,
      pinned_count: completed.pinnedCount,
    });
    setBusy(false);
    setRevision((value) => value + 1);
    setCompleted(true);
    transition('drift');
  };

  const enableReminder = async () => {
    if (!performance || reminderBusy) return;
    setReminderBusy(true);
    const status = await oneSignal.enableDailyReminder(performance.session.premiseId);
    setReminderStatus(status);
    if (status === 'enabled') {
      void layers.track('daily_reminder_enabled', {
        premise_id: performance.session.premiseId,
        copy_variant: reminderVariant,
      });
    }
    setReminderBusy(false);
  };

  const updateMonetization = (status: MonetizationStatus) => {
    setMonetization(status);
    setPass((current) => reconcilePassWithMonetization(current, status));
    if (status.unlimited) setPaywallVisible(false);
  };

  const purchase = async (pkg: DirectorPackage) => {
    setPaywallBusy(true);
    setPaywallError(null);
    setAccessMessage(null);
    try {
      const status = await revenueCat.purchase(pkg);
      updateMonetization(status);
      void layers.track('purchase_completed', {
        package_id: pkg.identifier,
        unlimited: status.unlimited,
      });
      // A consumable flips no entitlement, so the extra show is recorded here.
      if (isEncorePackage(pkg) && !status.unlimited && pass) {
        const current = normalizeDailyPass(ledgerFromState(pass), new Date(), false);
        const recorded = await recordPurchasedEncore({
          pass: current,
          saveLedger: (nextLedger) => ledgerStorage.save(nextLedger),
        });
        setPass(recorded.pass);
        if (recorded.persisted) {
          setLedgerAvailable(true);
          setSessionEncoreCredits(0);
        } else {
          // The purchase itself proves this encore even when storage does not.
          setLedgerAvailable(false);
          setSessionEncoreCredits((value) => value + 1);
          setAccessMessage('Encore purchased. It is ready now, but may not survive an app restart because local saving failed.');
        }
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
      const status = await revenueCat.restore();
      updateMonetization(status);
      void layers.track('purchase_restored', { unlimited: status.unlimited });
      if (status.unlimited) {
        setPaywallVisible(false);
        setAccessMessage("Director's Pass restored. Unlimited performances are active.");
      } else {
        setPaywallError("No active Director's Pass was found to restore.");
      }
    } catch (error) {
      setPaywallError(error instanceof Error ? error.message : 'Restore failed');
    } finally {
      setPaywallBusy(false);
    }
  };

  const replay = () => {
    if (!premise) return;
    if (rehearsal) rehearse(premise);
    else void start(premise);
  };

  const requestLaunch = (choice: PremiseOption, local: boolean) => {
    if (busy || launchBusy) return;
    if (performance && !completed) setPendingLaunch({ choice, rehearsal: local });
    else if (local) rehearse(choice);
    else void start(choice);
  };

  return (
    <View style={styles.app} key={revision > -1 ? 'game' : 'unused'}>
      <StatusBar style="light" />
      <Animated.View style={[styles.flex, { opacity: fade }]}>
        {screen === 'lobby' && (
          <Lobby
            pass={pass}
            ledgerAvailable={ledgerAvailable}
            sessionEncoreCredits={sessionEncoreCredits}
            launchBusy={launchBusy}
            accessMessage={accessMessage}
            onShowPaywall={showPaywall}
            onStart={(choice) => requestLaunch(choice, false)}
            onRehearse={(choice) => requestLaunch(choice, true)}
            onResume={performance && !completed ? () => transition('stage') : null}
            cast={cast}
            onEditCast={() => { castTouched.current = true; setCastEditorVisible(true); }}
          />
        )}
        {screen === 'stage' && session && performance && currentSnapshot && (
          <Stage
            session={session}
            snapshot={currentSnapshot}
            mode={performance.mode}
            serverActive={performance.serverActive}
            busy={busy}
            fallbackReason={performance.lastFallbackReason}
            rehearsal={rehearsal}
            onAdvance={() => { void advance(); }}
            onDirection={direction}
            onPin={(id) => { void pin(id); }}
            onFinish={() => { void finish(); }}
            onExit={() => transition('lobby')}
          />
        )}
        {screen === 'drift' && performance && currentSnapshot && (
          <Drift
            drift={performanceDrift(performance)}
            memoryTokens={currentSnapshot.memoryTokens}
            houseAd={!rehearsal && shouldShowHouseAd(momentForScreen(screen), monetization.unlimited)}
            reminderStatus={reminderStatus}
            reminderVariant={reminderVariant}
            reminderBusy={reminderBusy}
            onEnableReminder={() => { void enableReminder(); }}
            onReplay={replay}
            onNewPlay={() => transition('lobby')}
          />
        )}
      </Animated.View>
      <CastEditor visible={castEditorVisible} cast={cast} onClose={() => setCastEditorVisible(false)} onSave={saveCast} />
      <Modal visible={pendingLaunch !== null} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setPendingLaunch(null)}>
        <View style={styles.modalShade}>
          <View style={styles.paywallCard}>
            <Text accessibilityRole="header" style={styles.paywallTitle}>Leave this story behind?</Text>
            <Text style={styles.paywallBody}>A new performance replaces your unfinished show, including its pinned truth and progress. Any ticket already used stays spent.</Text>
            <ActionButton label="Keep my performance" onPress={() => setPendingLaunch(null)} />
            <ActionButton label={pendingLaunch?.rehearsal ? 'Replace with a rehearsal' : 'Start a new performance'} variant="ghost" onPress={() => {
              const launch = pendingLaunch;
              setPendingLaunch(null);
              if (!launch) return;
              if (launch.rehearsal) rehearse(launch.choice);
              else void start(launch.choice);
            }} />
          </View>
        </View>
      </Modal>
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
  safeArea: { flex: 1, backgroundColor: colors.ink, paddingTop: androidStatusBarHeight },
  lobbyScroll: { flexGrow: 1, paddingHorizontal: '5%', paddingTop: 28, paddingBottom: 56, width: '100%', maxWidth: 1440, alignSelf: 'center' },
  lobbyScrollCompact: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 },
  wordmark: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 20, marginBottom: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  wordmarkKicker: { color: colors.smoke, fontSize: 12 },
  wordmarkTitle: { color: colors.paper, fontSize: 13, letterSpacing: 2.4, fontWeight: '700' },
  lobbyGrid: { flexDirection: 'row', gap: 56, alignItems: 'flex-start', maxWidth: 1240, alignSelf: 'center', width: '100%' },
  lobbyGridCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 28 },
  heroColumn: { flex: 1.2, minWidth: 0 },
  eyebrow: { color: colors.ember, fontSize: 11, letterSpacing: 2.4, fontWeight: '800', marginBottom: 16 },
  heroTitle: { color: colors.paper, fontSize: 62, lineHeight: 65, letterSpacing: -1.9, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontWeight: '400' },
  heroTitleCompact: { fontSize: 42, lineHeight: 45, letterSpacing: -1.2 },
  heroBody: { color: colors.smoke, fontSize: 17, lineHeight: 26, maxWidth: 490, marginTop: 18, marginBottom: 24 },
  heroBodyCompact: { fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 20 },
  rulesBox: { borderTopWidth: 1, borderTopColor: colors.line },
  rulesToggle: { minHeight: 46, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rulesToggleText: { color: colors.smoke, fontSize: 13 },
  castEditButton: { flexDirection: 'row', minHeight: 48, alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  castEditText: { color: colors.gold, fontSize: 14, fontWeight: '600' },
  castEditMeta: { color: colors.smoke, fontSize: 12 },
  rule: { flexDirection: 'row', gap: 18, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.line },
  ruleNumber: { color: colors.gold, fontSize: 11, letterSpacing: 1.8, fontWeight: '900', width: 26 },
  ruleCopy: { flex: 1 },
  ruleTitle: { color: colors.paper, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  ruleBody: { color: colors.smoke, fontSize: 13, lineHeight: 19 },
  ticket: { flex: 0.8, backgroundColor: colors.paper, padding: 28, borderRadius: 4, minWidth: 300, maxWidth: 480, alignSelf: 'flex-start', width: '100%' },
  ticketCompact: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0, maxWidth: '100%', padding: 20 },
  ticketHeading: { color: colors.ink, fontSize: 23, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  ticketTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#c8bca8' },
  ticketKicker: { color: '#5c5245', fontSize: 10, letterSpacing: 1.9, fontWeight: '900' },
  ticketNumber: { color: '#655743', fontSize: 9, letterSpacing: 1.2 },
  premiseList: { paddingVertical: 16, gap: 9 },
  premiseCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: '#cfc3ae', borderRadius: 4, padding: 15, backgroundColor: 'transparent', minHeight: 74 },
  premiseCardActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  premiseCardPressed: { transform: [{ scale: 0.99 }] },
  radio: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: '#8c806e' },
  radioActive: { borderColor: colors.gold, borderWidth: 4 },
  premiseCopy: { flex: 1 },
  premiseEyebrow: { color: '#6e604c', fontSize: 11 },
  premiseEyebrowActive: { color: colors.gold },
  premiseTitle: { color: '#1e1914', fontSize: 16, fontWeight: '800', marginTop: 3 },
  premiseTitleActive: { color: colors.paper },
  castPreview: { borderTopWidth: 1, borderTopColor: '#c8bca8', paddingTop: 18, marginBottom: 22 },
  castRow: { flexDirection: 'row', gap: 9, marginTop: 12, flexWrap: 'wrap' },
  castChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 9, borderWidth: 1, borderColor: '#c8bca8' },
  castMonogram: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', lineHeight: 22, backgroundColor: '#1e1914', color: colors.gold, fontSize: 10, fontWeight: '900' },
  castName: { color: '#3d352b', fontSize: 12, fontWeight: '800' },
  actionButton: { minHeight: 48, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold, borderWidth: 1, borderColor: colors.gold },
  actionGhost: { backgroundColor: 'transparent', borderColor: colors.line },
  actionTicket: { backgroundColor: 'transparent', borderColor: '#8a7d69' },
  actionDanger: { backgroundColor: colors.ember, borderColor: colors.ember },
  actionDisabled: { opacity: 0.35 },
  actionPressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
  actionLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actionGhostLabel: { color: colors.paper },
  actionTicketLabel: { color: '#2b241c' },
  actionDangerLabel: { color: '#fff8ef' },
  demoNote: { color: '#645643', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  ticketActions: { gap: 9 },
  resumePanel: { gap: 10, paddingBottom: 16 },
  lobbyAccessMessage: { color: '#8a2f20', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
  dailyPassPanel: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#c8bca8', marginBottom: 8 },
  dailyPassKicker: { color: '#7b5515', fontSize: 9, letterSpacing: 1.5, fontWeight: '900' },
  dailyPassCopy: { color: '#4f4538', fontSize: 13, lineHeight: 19, marginTop: 5 },
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
  reminderPanel: { borderWidth: 1, borderColor: colors.goldSoft, padding: 18, marginBottom: 22, backgroundColor: '#17130c', gap: 10 },
  reminderKicker: { color: colors.gold, fontSize: 9, letterSpacing: 1.8, fontWeight: '900' },
  reminderCopy: { color: colors.smoke, fontSize: 12, lineHeight: 19 },
  stageShell: { flexGrow: 1, paddingHorizontal: '4%', paddingTop: 12, paddingBottom: 24, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  stageHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 14 },
  stageHeaderCompact: { gap: 10, minHeight: 66 },
  backButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  backLabel: { color: colors.smoke, fontSize: 13, fontWeight: '600' },
  stageTitleBlock: { flex: 1, alignItems: 'center' },
  stageKicker: { color: colors.ember, fontSize: 9, letterSpacing: 2, fontWeight: '900' },
  liveStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  modeBadge: { borderWidth: 1, borderColor: colors.mint, paddingVertical: 3, paddingHorizontal: 6 },
  modeBadgeOffline: { borderColor: colors.gold },
  modeBadgeText: { color: colors.paper, fontSize: 10, letterSpacing: 0.6, fontWeight: '600' },
  stageTitle: { color: colors.paper, fontSize: 18, marginTop: 5, textAlign: 'center', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  stageTitleCompact: { fontSize: 16, lineHeight: 20 },
  roundPill: { minWidth: 72, borderWidth: 1, borderColor: colors.line, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  roundPillTop: { color: colors.smoke, fontSize: 8, letterSpacing: 1.4, fontWeight: '800' },
  roundPillValue: { color: colors.paper, fontSize: 15, fontWeight: '900', marginTop: 2 },
  stageGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, paddingTop: 20, minHeight: 0 },
  stageGridCompact: { flexDirection: 'column' },
  scriptPanel: { flex: 1.25, minWidth: 0, width: '100%' },
  currentLine: { paddingTop: 16, paddingBottom: 10 },
  scriptHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', minHeight: 48, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  scriptHeading: { color: colors.paper, fontSize: 13, fontWeight: '600' },
  scriptCount: { color: colors.smoke, fontSize: 12 },
  scriptScroll: { maxHeight: 380 },
  scriptContent: { padding: 14, gap: 10, paddingBottom: 44 },
  beatCard: { backgroundColor: colors.panel, borderRadius: 4, padding: 18 },
  beatNarration: { backgroundColor: '#151412' },
  beatDirection: { backgroundColor: '#211810', borderLeftColor: colors.ember },
  beatSeed: { backgroundColor: '#11100e', borderLeftColor: '#50483d' },
  beatPinned: { borderWidth: 1, borderColor: colors.gold, backgroundColor: '#201a10' },
  beatMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  beatIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  beatGlyph: { width: 23, height: 23, borderRadius: 12, overflow: 'hidden', textAlign: 'center', lineHeight: 23, backgroundColor: '#2b241d', color: colors.gold, fontSize: 10, fontWeight: '900' },
  beatSpeaker: { color: colors.paper, fontSize: 12, fontWeight: '900' },
  beatKind: { color: colors.smoke, fontSize: 10 },
  beatText: { color: colors.paper, fontSize: 19, lineHeight: 28, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  beatTextSeed: { color: colors.smoke, fontStyle: 'italic' },
  pinButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderRadius: 4, borderColor: colors.goldSoft },
  pinButtonText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
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
  controlPanel: { width: 340, maxWidth: '100%', padding: 20, gap: 20, backgroundColor: colors.panel, borderRadius: 4 },
  controlPanelCompact: { width: '100%', padding: 16, gap: 16 },
  meterLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  meterTitle: { color: colors.paper, fontSize: 11, fontWeight: '700' },
  meterValue: { color: colors.gold, fontSize: 10, fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) },
  meterTrack: { height: 11, backgroundColor: '#29231d', overflow: 'hidden', position: 'relative' },
  meterTrackHot: { backgroundColor: '#311b15' },
  meterFill: { height: '100%', backgroundColor: colors.gold },
  meterFillHot: { backgroundColor: colors.ember },
  meterDangerLine: { position: 'absolute', height: '100%', width: 1, backgroundColor: colors.ember, left: '82%' },
  meterLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  meterHint: { color: colors.smoke, fontSize: 10 },
  meterHintHot: { color: colors.ember },
  truthPanel: { borderTopWidth: 1, borderTopColor: colors.goldSoft, paddingTop: 16 },
  controlKicker: { color: colors.smoke, fontSize: 11, fontWeight: '600', marginBottom: 10 },
  truthMark: { color: colors.gold, fontSize: 15, marginBottom: 7 },
  truthValue: { color: colors.paper, fontSize: 14, lineHeight: 20, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  truthEmpty: { color: colors.smoke, fontSize: 13, lineHeight: 20 },
  nextPanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15 },
  nextActor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextMonogram: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', textAlign: 'center', lineHeight: 42, color: colors.gold, backgroundColor: '#29231d', fontWeight: '900' },
  nextName: { color: colors.paper, fontSize: 15, fontWeight: '900' },
  nextPersona: { color: colors.smoke, fontSize: 10, lineHeight: 15, marginTop: 2, maxWidth: 240 },
  directionPanel: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 15 },
  notesToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noteEditor: { gap: 8 },
  directionInput: { minHeight: 76, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, color: colors.paper, padding: 11, textAlignVertical: 'top', fontSize: 13, lineHeight: 18 },
  directionInputDisabled: { opacity: 0.48 },
  directionCues: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  directionCue: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#191510', minHeight: 44, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 10 },
  directionCueDisabled: { opacity: 0.35 },
  directionCuePressed: { borderColor: colors.gold, backgroundColor: '#241d12' },
  directionCueText: { color: colors.paper, fontSize: 12 },
  directionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  noteCounter: { color: colors.smoke, fontSize: 11, flex: 1 },
  stageActions: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: '5%', paddingTop: 12, paddingBottom: 16, gap: 8, width: '100%', maxWidth: 1280, alignSelf: 'center' },
  stageFootnote: { color: colors.smoke, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  fallbackFootnote: { color: colors.gold },
  driftScroll: { paddingHorizontal: '5%', paddingTop: 44, paddingBottom: 60, maxWidth: 1120, width: '100%', alignSelf: 'center' },
  driftHeader: { maxWidth: 760, alignSelf: 'center', alignItems: 'center' },
  driftKicker: { color: colors.ember, fontSize: 10, letterSpacing: 2.4, fontWeight: '900' },
  driftTitle: { color: colors.paper, fontSize: 48, lineHeight: 53, textAlign: 'center', letterSpacing: -1.7, marginTop: 18, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }), fontWeight: '700' },
  driftTitleCompact: { fontSize: 34, lineHeight: 39, letterSpacing: -1 },
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
  driftCompareCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
  driftSide: { flex: 1 },
  driftSideLabel: { color: colors.mint, fontSize: 8, letterSpacing: 1.4, fontWeight: '900', marginBottom: 8 },
  driftSideLabelHot: { color: colors.ember },
  driftQuote: { color: '#c8d8cf', fontSize: 14, lineHeight: 21, fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  driftQuoteHot: { color: '#e5b0a4' },
  driftArrow: { color: colors.gold, fontSize: 18 },
  driftActions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' },
});
