import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
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
import { CAST, PREMISES, type PremiseOption } from './src/game/content.ts';
import {
  DEMO_ROUNDS,
  addDirectorNote,
  advanceGameSession,
  canFinish,
  createGameSession,
  finishGameSession,
  pinBeat,
  snapshotSession,
  type GameSession,
} from './src/game/session.ts';

type Screen = 'lobby' | 'stage' | 'drift';

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

function Lobby({ onStart }: { onStart: (premise: PremiseOption) => void }) {
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
              An AI cast improvises inside a memory that holds only 1,000 tokens. Save one line. Watch everything else become negotiable.
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
            <ActionButton label="Raise the curtain" onPress={() => onStart(choice)} />
            <Text style={styles.demoNote}>Playable offline demo. No account or API key required.</Text>
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
}: {
  session: GameSession;
  onAdvance: () => void;
  onDirection: (note: string) => void;
  onPin: (id: number) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const { width } = useWindowDimensions();
  const [note, setNote] = useState('');
  const snapshot = snapshotSession(session);
  const compact = width < 880;
  const feed = snapshot.memory.filter((beat) => beat.kind !== 'seed');
  const canPin = snapshot.pinnedCount === 0;
  const progress = Math.min(DEMO_ROUNDS, snapshot.round);
  const actionLabel = snapshot.canAdvance
    ? `${snapshot.nextSpeaker?.name ?? 'Actor'} steps forward`
    : 'Ready for curtain';

  const submitDirection = () => {
    const value = note.trim();
    if (!value || snapshot.directorNoteUsed) return;
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
              <Text style={styles.stageKicker}>LIVE PERFORMANCE</Text>
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
                {snapshot.lastForgotten.length > 0 && (
                  <View style={styles.evictionNotice} accessible accessibilityLiveRegion="polite">
                    <Text style={styles.evictionKicker}>MEMORY EVICTED</Text>
                    {snapshot.lastForgotten.map((beat) => (
                      <Text key={beat.id} style={styles.evictionText} numberOfLines={2}>
                        {beat.kind === 'seed' ? 'Identity lost' : beat.speaker}: {beat.text}
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
                  placeholder={snapshot.directorNoteUsed ? 'Your one intervention is already in the script.' : 'Make them explain the second bride...'}
                  placeholderTextColor="#706658"
                  multiline
                  editable={!snapshot.directorNoteUsed}
                  maxLength={120}
                  style={[styles.directionInput, snapshot.directorNoteUsed && styles.directionInputDisabled]}
                />
                <View style={styles.directionFooter}>
                  <Text style={styles.noteCounter}>{snapshot.directorNoteUsed ? 'intervention spent' : `${note.length}/120 · costs memory`}</Text>
                  <ActionButton label={snapshot.directorNoteUsed ? 'Note sent' : 'Send note'} variant="ghost" disabled={snapshot.directorNoteUsed || !note.trim()} onPress={submitDirection} />
                </View>
              </View>

              <View style={styles.stageActions}>
                {snapshot.canAdvance ? (
                  <ActionButton label={actionLabel} onPress={onAdvance} />
                ) : (
                  <ActionButton label="Bring down the curtain" variant="danger" onPress={onFinish} />
                )}
                <Text style={styles.stageFootnote}>
                  {canFinish(session) ? 'The damage is done. End when ready.' : 'Every line consumes the shared script.'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Drift({ session, onReplay, onNewPlay }: { session: GameSession; onReplay: () => void; onNewPlay: () => void }) {
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

        <View style={styles.driftActions}>
          <ActionButton label="Replay this premise" onPress={onReplay} />
          <ActionButton label="Choose another disaster" variant="ghost" onPress={onNewPlay} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [session, setSession] = useState<GameSession | null>(null);
  const [revision, setRevision] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const premise = useMemo(
    () => PREMISES.find((item) => item.id === session?.premiseId) ?? PREMISES[0],
    [session?.premiseId],
  );

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

  const start = (choice: PremiseOption) => {
    setSession(createGameSession(choice.id, choice.premise));
    setRevision((value) => value + 1);
    transition('stage');
  };

  const mutate = (operation: (value: GameSession) => void) => {
    if (!session) return;
    operation(session);
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
        {screen === 'lobby' && <Lobby onStart={start} />}
        {screen === 'stage' && session && (
          <Stage
            session={session}
            onAdvance={() => mutate(advanceGameSession)}
            onDirection={(note) => mutate((value) => addDirectorNote(value, note))}
            onPin={(id) => mutate((value) => { pinBeat(value, id); })}
            onFinish={() => {
              mutate(finishGameSession);
              transition('drift');
            }}
            onExit={() => transition('lobby')}
          />
        )}
        {screen === 'drift' && session && (
          <Drift session={session} onReplay={replay} onNewPlay={() => transition('lobby')} />
        )}
      </Animated.View>
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
  stageShell: { flexGrow: 1, paddingHorizontal: '3.5%', paddingTop: 16, paddingBottom: 18, minHeight: '100%' },
  stageHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 14 },
  backLabel: { color: colors.smoke, fontSize: 10, letterSpacing: 1.7, fontWeight: '800' },
  stageTitleBlock: { flex: 1, alignItems: 'center' },
  stageKicker: { color: colors.ember, fontSize: 9, letterSpacing: 2, fontWeight: '900' },
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
