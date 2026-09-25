import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import type { Character } from '../engine/types.ts';
import { CAST } from '../game/content.ts';

type TheaterSetProps = {
  compact?: boolean;
  activeSpeaker?: string;
  caption?: string;
  small?: boolean;
  cast?: Character[];
};

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

function useStageMotion(stageRef: RefObject<View | null>) {
  const [reducedMotion, setReducedMotion] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState == null || AppState.currentState === 'active');
  const [pageVisible, setPageVisible] = useState(true);
  const [onStage, setOnStage] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (mounted) setReducedMotion(reduced);
    }).catch(() => undefined);
    const motionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    const appSubscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));

    return () => {
      mounted = false;
      motionSubscription.remove();
      appSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    const node = stageRef.current as unknown as Element;
    const observer = typeof IntersectionObserver !== 'undefined' && node instanceof Element
      ? new IntersectionObserver(([entry]) => setOnStage(entry?.isIntersecting ?? false), { threshold: 0.05 })
      : undefined;
    observer?.observe(node);

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      observer?.disconnect();
    };
  }, [stageRef]);

  return !reducedMotion && appActive && pageVisible && onStage;
}

const costumes = [
  { cloth: '#8e3947', trim: '#e8b44f', skin: '#c68b5e', hair: '#25170f' },
  { cloth: '#c9a369', trim: '#533226', skin: '#b7794f', hair: '#221711' },
  { cloth: '#657344', trim: '#cf9751', skin: '#aa704b', hair: '#514332' },
] as const;

function PaperPuppet({ index, active, subdued, dense, small, motion }: {
  index: number;
  active: boolean;
  subdued: boolean;
  dense: boolean;
  small: boolean;
  motion: boolean;
}) {
  const sway = useRef(new Animated.Value(0)).current;
  const cue = useRef(new Animated.Value(0)).current;
  const variant = index % costumes.length;
  const costume = costumes[variant] ?? costumes[0];
  const scale = small ? 0.5 : dense ? 0.67 : 1;

  useEffect(() => {
    sway.setValue(0);
    if (!motion) return;
    const duration = 1800 + (index % 3) * 230;
    const breathing = Animated.loop(Animated.sequence([
      Animated.delay((index % 3) * 170),
      Animated.timing(sway, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(sway, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]));
    breathing.start();
    return () => {
      breathing.stop();
      sway.stopAnimation();
    };
  }, [index, motion, sway]);

  useEffect(() => {
    if (!motion) {
      cue.setValue(0);
      return;
    }
    const lift = Animated.timing(cue, {
      toValue: active ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    lift.start();
    return () => lift.stop();
  }, [active, cue, motion]);

  return (
    <View
      style={[styles.portrait, dense && styles.portraitDense, small && styles.portraitSmall]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.portraitBackdrop, active && styles.portraitBackdropActive]} />
      <Animated.View style={[
        styles.puppetCanvas,
        {
          bottom: -(112 - 112 * scale) / 2,
          opacity: subdued ? 0.7 : 1,
          transform: [
            { translateY: Animated.add(sway.interpolate({ inputRange: [0, 1], outputRange: [0, -1.2] }), cue.interpolate({ inputRange: [0, 1], outputRange: [0, -3] })) },
            { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-0.65deg', '0.65deg'] }) },
            { scale },
          ],
        },
      ]}>
        <View style={[styles.hairBack, { backgroundColor: costume.hair }, variant === 1 && styles.hairBackShort]} />
        {variant === 2 && <View style={[styles.hairBun, { backgroundColor: costume.hair }]} />}
        <View style={styles.leftShoe} />
        <View style={styles.rightShoe} />
        <View style={[styles.leftSleeve, { backgroundColor: costume.cloth }]} />
        <View style={[styles.rightSleeve, { backgroundColor: costume.cloth }]} />
        <View style={[styles.leftHand, { backgroundColor: costume.skin }]} />
        <View style={[styles.rightHand, { backgroundColor: costume.skin }]} />
        <View style={[styles.body, { backgroundColor: costume.cloth }]} />
        {variant !== 1 && <View style={[styles.dressHem, { borderBottomColor: costume.cloth }]} />}
        <View style={[styles.neck, { backgroundColor: costume.skin }]} />
        <View style={[styles.collar, { backgroundColor: costume.trim }]} />
        <View style={[styles.sash, { backgroundColor: costume.trim }, variant === 1 && styles.jacketPlacket]} />
        {variant === 1 && <View style={styles.jacketButton} />}
        <View style={[styles.face, { backgroundColor: costume.skin }]} />
        <View style={[styles.hairTop, { backgroundColor: costume.hair }, variant === 1 && styles.hairTopShort]} />
        <View style={styles.leftEye} />
        <View style={styles.rightEye} />
        <View style={styles.nose} />
        <View style={styles.mouth} />
        {variant === 0 && <View style={styles.hairPin} />}
        {variant === 1 && <View style={styles.moustache} />}
        {variant === 2 && <>
          <View style={styles.leftLens} />
          <View style={styles.rightLens} />
          <View style={styles.glassesBridge} />
        </>}
      </Animated.View>
      {active && <View style={styles.speakerMark} />}
    </View>
  );
}

/** A paper-puppet company with gentle stage motion and a quiet reduced-motion version. */
export function TheaterSet({
  compact = false,
  activeSpeaker,
  caption,
  small = false,
  cast = CAST,
}: TheaterSetProps) {
  const stageRef = useRef<View>(null);
  const motion = useStageMotion(stageRef);
  const dense = compact || small;
  const speaker = activeSpeaker?.trim().toLowerCase();
  const hasSpeaker = cast.some((actor) => actor.name.toLowerCase() === speaker);

  return (
    <View style={styles.wrapper}>
      <View ref={stageRef} style={[styles.stage, compact && styles.stageCompact, small && styles.stageSmall]}>
        <View
          style={styles.setGeometry}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={styles.pelmet} />
          <View style={[styles.wing, styles.leftWing, dense && styles.wingDense]} />
          <View style={[styles.wing, styles.rightWing, dense && styles.wingDense]} />
          <View style={[styles.floor, dense && styles.floorDense]}>
            <View style={styles.floorSeam} />
            <View style={styles.footlights}>
              {Array.from({ length: 9 }, (_, index) => <View key={index} style={styles.footlight} />)}
            </View>
          </View>
        </View>

        <View style={[styles.company, dense && styles.companyDense, small && styles.companySmall]}>
          {cast.map((actor, index) => {
            const active = hasSpeaker && actor.name.toLowerCase() === speaker;
            const subdued = hasSpeaker && !active;

            return (
              <View
                key={`${index}-${actor.name}`}
                style={styles.actor}
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${actor.name}${active ? ', speaking' : ''}.${actor.style ? ` ${actor.style}.` : ''}`}
              >
                <PaperPuppet index={index} active={active} subdued={subdued} dense={dense} small={small} motion={motion} />
                <Text
                  numberOfLines={1}
                  style={[styles.name, dense && styles.nameDense, subdued && styles.nameSubdued]}
                >
                  {actor.name}
                </Text>
                <Text
                  numberOfLines={2}
                  ellipsizeMode="tail"
                  style={[styles.persona, dense && styles.personaDense]}
                >
                  {actor.style}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', minWidth: 0 },
  stage: {
    height: 260,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#090807',
    borderTopWidth: 1,
    borderTopColor: '#744534',
  },
  stageCompact: { height: 180 },
  stageSmall: { height: 155 },
  setGeometry: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  pelmet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#581e28',
    borderBottomWidth: 1,
    borderBottomColor: '#744534',
  },
  wing: {
    position: 'absolute',
    top: 10,
    bottom: 28,
    width: 28,
    backgroundColor: '#581e28',
  },
  leftWing: { left: 0, borderBottomRightRadius: 20 },
  rightWing: { right: 0, borderBottomLeftRadius: 20 },
  wingDense: { width: 14, bottom: 22 },
  floor: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 29,
    backgroundColor: '#39281b',
    borderTopWidth: 1,
    borderTopColor: '#795233',
  },
  floorDense: { height: 23 },
  floorSeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 7,
    height: 1,
    backgroundColor: '#5b3d28',
  },
  footlights: {
    position: 'absolute',
    top: 5,
    left: '9%',
    right: '9%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footlight: { width: 6, height: 3, backgroundColor: '#e8b44f', borderRadius: 1 },
  company: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 18,
    paddingHorizontal: 42,
    paddingTop: 24,
    paddingBottom: 46,
  },
  companyDense: { gap: 10, paddingHorizontal: 26, paddingTop: 18, paddingBottom: 33 },
  companySmall: { paddingTop: 15, paddingBottom: 30 },
  actor: { flex: 1, minWidth: 0, maxWidth: 142, alignItems: 'center' },
  portrait: {
    width: '100%',
    maxWidth: 104,
    height: 116,
    alignItems: 'center',
  },
  portraitDense: { maxWidth: 72, height: 75 },
  portraitSmall: { maxWidth: 60, height: 56 },
  portraitBackdrop: {
    position: 'absolute',
    top: 6,
    bottom: 0,
    width: '90%',
    backgroundColor: '#1e180f',
    borderTopLeftRadius: 56,
    borderTopRightRadius: 56,
    borderWidth: 1,
    borderColor: '#423422',
  },
  portraitBackdropActive: { backgroundColor: '#44301a', borderColor: '#b78b42' },
  puppetCanvas: { position: 'absolute', width: 100, height: 112, left: '50%', marginLeft: -50 },
  hairBack: { position: 'absolute', top: 12, left: 29, width: 44, height: 55, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomLeftRadius: 13, borderBottomRightRadius: 13 },
  hairBackShort: { top: 14, left: 31, width: 40, height: 39, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  hairBun: { position: 'absolute', top: 10, left: 61, width: 17, height: 19, borderRadius: 9 },
  face: { position: 'absolute', top: 23, left: 35, width: 32, height: 36, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  hairTop: { position: 'absolute', top: 15, left: 31, width: 40, height: 20, borderTopLeftRadius: 21, borderTopRightRadius: 19, borderBottomRightRadius: 16, transform: [{ rotate: '-9deg' }] },
  hairTopShort: { top: 17, left: 33, width: 37, height: 15, borderBottomRightRadius: 5, transform: [{ rotate: '-4deg' }] },
  hairPin: { position: 'absolute', top: 25, left: 33, width: 3, height: 10, borderRadius: 1, backgroundColor: '#e8b44f', transform: [{ rotate: '18deg' }] },
  leftEye: { position: 'absolute', top: 39, left: 42, width: 3, height: 3, borderRadius: 2, backgroundColor: '#2b1b12' },
  rightEye: { position: 'absolute', top: 39, left: 56, width: 3, height: 3, borderRadius: 2, backgroundColor: '#2b1b12' },
  nose: { position: 'absolute', top: 43, left: 50, width: 2, height: 4, borderRadius: 1, backgroundColor: '#8a5034' },
  mouth: { position: 'absolute', top: 51, left: 47, width: 8, height: 1, backgroundColor: '#683b29' },
  moustache: { position: 'absolute', top: 48, left: 44, width: 14, height: 3, borderRadius: 2, backgroundColor: '#2b1b12' },
  leftLens: { position: 'absolute', top: 36, left: 37, width: 13, height: 10, borderWidth: 1, borderColor: '#302217', borderRadius: 4 },
  rightLens: { position: 'absolute', top: 36, left: 52, width: 13, height: 10, borderWidth: 1, borderColor: '#302217', borderRadius: 4 },
  glassesBridge: { position: 'absolute', top: 40, left: 50, width: 2, height: 1, backgroundColor: '#302217' },
  neck: { position: 'absolute', top: 54, left: 45, width: 12, height: 12 },
  body: { position: 'absolute', top: 59, left: 27, width: 48, height: 47, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  dressHem: { position: 'absolute', top: 80, left: 22, width: 58, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 27, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  collar: { position: 'absolute', top: 61, left: 41, width: 20, height: 6, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  sash: { position: 'absolute', top: 66, left: 44, width: 10, height: 39, transform: [{ rotate: '-22deg' }] },
  jacketPlacket: { top: 66, left: 48, width: 6, height: 38, transform: [{ rotate: '0deg' }] },
  jacketButton: { position: 'absolute', top: 76, left: 50, width: 2, height: 2, borderRadius: 1, backgroundColor: '#e8b44f' },
  leftSleeve: { position: 'absolute', top: 61, left: 17, width: 15, height: 35, borderRadius: 6, transform: [{ rotate: '13deg' }] },
  rightSleeve: { position: 'absolute', top: 61, left: 70, width: 15, height: 35, borderRadius: 6, transform: [{ rotate: '-13deg' }] },
  leftHand: { position: 'absolute', top: 89, left: 14, width: 10, height: 13, borderRadius: 5 },
  rightHand: { position: 'absolute', top: 89, left: 78, width: 10, height: 13, borderRadius: 5 },
  leftShoe: { position: 'absolute', bottom: 0, left: 29, width: 19, height: 10, borderTopLeftRadius: 7, backgroundColor: '#2c1b12' },
  rightShoe: { position: 'absolute', bottom: 0, left: 55, width: 19, height: 10, borderTopRightRadius: 7, backgroundColor: '#2c1b12' },
  speakerMark: { position: 'absolute', bottom: -3, width: 23, height: 2, backgroundColor: '#e8b44f' },
  name: { color: '#f1e7d2', fontFamily: serif, fontSize: 21, lineHeight: 27, marginTop: 9 },
  nameDense: { fontSize: 17, lineHeight: 22, marginTop: 5 },
  nameSubdued: { color: '#bcae98' },
  persona: { color: '#bcae98', fontSize: 11, lineHeight: 15, height: 30, textAlign: 'center', marginTop: 3 },
  personaDense: { fontSize: 11, lineHeight: 13, height: 26, marginTop: 2 },
  caption: { color: '#bcae98', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 12, paddingHorizontal: 8 },
});
