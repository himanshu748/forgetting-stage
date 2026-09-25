import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { Character } from '../engine/types.ts';
import { CAST } from '../game/content.ts';
import { CAST_LIMITS, normalizePerformanceCast } from '../live/contract.ts';

type CastEditorProps = {
  visible: boolean;
  cast: Character[];
  onSave: (cast: Character[]) => void;
  onClose: () => void;
};

type EditableField = 'name' | 'persona' | 'style';
type CastIssue = { index: number; field: EditableField; message: string };

const colors = {
  ink: '#090807',
  panel: '#15120f',
  paper: '#f1e7d2',
  smoke: '#b5a795',
  line: '#4c4033',
  gold: '#e8b44f',
  error: '#f39b84',
};

function copyCast(cast: Character[]): Character[] {
  return cast.map((character) => ({ ...character, style: character.style ?? '' }));
}

function castIssues(cast: Character[]): CastIssue[] {
  return cast.flatMap((character, index) => {
    const issues: CastIssue[] = [];
    const name = character.name.trim();
    const actor = name || `Character ${index + 1}`;

    if (!name) {
      issues.push({ index, field: 'name', message: `Give character ${index + 1} a name.` });
    } else if (cast.some((other, otherIndex) => otherIndex !== index && other.name.trim().normalize('NFKC').toLocaleLowerCase('en') === name.normalize('NFKC').toLocaleLowerCase('en'))) {
      issues.push({ index, field: 'name', message: `${actor} shares a name with another character. Choose a different name.` });
    }
    if (!character.persona.trim()) {
      issues.push({ index, field: 'persona', message: `Add a personality for ${actor}.` });
    }
    if (!character.style?.trim()) {
      issues.push({ index, field: 'style', message: `Add a speaking style for ${actor}.` });
    }
    return issues;
  });
}

function EditorButton({
  children,
  onPress,
  primary = false,
  disabled = false,
  quiet = false,
}: {
  children: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  quiet?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primaryButton,
        quiet && styles.quietButton,
        hovered && !disabled && styles.buttonHovered,
        focused && styles.focused,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, primary && styles.primaryButtonLabel]}>{children}</Text>
    </Pressable>
  );
}

export function CastEditor({ visible, cast, onSave, onClose }: CastEditorProps) {
  const { width } = useWindowDimensions();
  const compact = width < 400;
  const [draft, setDraft] = useState(() => copyCast(cast));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedField, setFocusedField] = useState<EditableField | null>(null);
  const [focusedTab, setFocusedTab] = useState<number | null>(null);
  const issues = useMemo(() => castIssues(draft), [draft]);
  const validation = useMemo(() => {
    if (issues.length > 0) return { cast: null, error: null };
    try {
      return {
        cast: normalizePerformanceCast(draft.map((character) => {
          const name = character.name.trim();
          const initial = Array.from(name.normalize('NFKC'))[0] ?? '';
          return {
            name,
            emoji: Array.from(initial.toUpperCase())[0] ?? '',
            persona: character.persona.replace(/[\r\n]+/g, ' ').trim(),
            style: (character.style ?? '').replace(/[\r\n]+/g, ' ').trim(),
          };
        })),
        error: null,
      };
    } catch (error) {
      return { cast: null, error: error instanceof Error ? error.message : 'Check your cast details and try again.' };
    }
  }, [draft, issues]);
  const selected = draft[selectedIndex];

  useEffect(() => {
    if (!visible) return;
    setDraft(copyCast(cast));
    setSelectedIndex(0);
    setFocusedField(null);
  }, [visible, cast]);

  function updateField(field: EditableField, value: string) {
    setDraft((current) => current.map((character, index) => (
      index === selectedIndex ? { ...character, [field]: value } : character
    )));
  }

  function close() {
    Keyboard.dismiss();
    onClose();
  }

  function save() {
    if (!validation.cast) return;
    Keyboard.dismiss();
    onSave(copyCast(validation.cast));
  }

  const fields: { key: EditableField; label: string; hint: string; limit: number; multiline?: boolean }[] = [
    { key: 'name', label: 'Name', hint: 'What should the other characters call them?', limit: CAST_LIMITS.name },
    { key: 'persona', label: 'Personality & backstory', hint: 'Who are they? What do they believe is true?', limit: CAST_LIMITS.persona, multiline: true },
    { key: 'style', label: 'Speaking style', hint: 'How do they sound when they speak?', limit: CAST_LIMITS.style, multiline: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.shade, compact && styles.shadeCompact]}
      >
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={[styles.header, compact && styles.headerCompact]}>
            <View style={styles.headingGroup}>
              <Text accessibilityRole="header" style={styles.title}>Your cast.</Text>
              <Text style={styles.intro}>Rewrite the people behind the performance.</Text>
            </View>
            <EditorButton onPress={close} quiet>Close</EditorButton>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Characters">
            {draft.map((character, index) => (
              <Pressable
                key={index}
                accessibilityRole="tab"
                accessibilityLabel={`Edit ${character.name.trim() || `character ${index + 1}`}`}
                accessibilityState={{ selected: selectedIndex === index }}
                onPress={() => { setSelectedIndex(index); setFocusedField(null); }}
                onFocus={() => setFocusedTab(index)}
                onBlur={() => setFocusedTab(null)}
                style={({ pressed }) => [
                  styles.tab,
                  selectedIndex === index && styles.selectedTab,
                  focusedTab === index && styles.focused,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.tabIndex, selectedIndex === index && styles.selectedTabText]}>CAST {index + 1}</Text>
                <Text numberOfLines={1} style={[styles.tabName, selectedIndex === index && styles.selectedTabText]}>
                  {character.name.trim() || 'Unnamed'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.form, compact && styles.formCompact]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {selected ? fields.map((field) => {
              const value = selected[field.key] ?? '';
              const issue = issues.find((entry) => entry.index === selectedIndex && entry.field === field.key);
              return (
                <View key={field.key} style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>{field.label}</Text>
                    <Text style={styles.counter}>{value.length}/{field.limit}</Text>
                  </View>
                  <TextInput
                    key={`${selectedIndex}-${field.key}`}
                    accessibilityLabel={field.label}
                    accessibilityHint={issue?.message ?? field.hint}
                    value={value}
                    onChangeText={(text) => updateField(field.key, text)}
                    onFocus={() => setFocusedField(field.key)}
                    onBlur={() => setFocusedField(null)}
                    multiline={field.multiline}
                    maxLength={field.limit}
                    placeholder={field.hint}
                    placeholderTextColor={colors.smoke}
                    selectionColor={colors.gold}
                    autoCapitalize={field.key === 'name' ? 'words' : 'sentences'}
                    autoCorrect={field.key !== 'name'}
                    style={[
                      styles.input,
                      field.multiline && styles.multilineInput,
                      field.key === 'persona' && styles.personaInput,
                      issue && styles.invalidInput,
                      focusedField === field.key && styles.focused,
                    ]}
                  />
                </View>
              );
            }) : <Text style={styles.note}>Restore the original cast to begin editing.</Text>}

            {(issues.length > 0 || validation.error) && (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errors}>
                <Text style={styles.errorTitle}>A few details need your attention.</Text>
                {issues.map((issue) => <Text key={`${issue.index}-${issue.field}`} style={styles.error}>{issue.message}</Text>)}
                {validation.error ? <Text style={styles.error}>{validation.error}</Text> : null}
              </View>
            )}

            <Text style={styles.note}>Applies to your next performance. A rehearsal uses a prepared script.</Text>
            <View style={styles.restore}>
              <EditorButton onPress={() => { setDraft(copyCast(CAST)); setSelectedIndex(0); }} quiet>
                Restore original cast
              </EditorButton>
            </View>
          </ScrollView>

          <View style={[styles.footer, compact && styles.footerCompact]}>
            <EditorButton onPress={close}>Cancel</EditorButton>
            <EditorButton primary disabled={!validation.cast} onPress={save}>Save cast</EditorButton>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  shadeCompact: { padding: 12 },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 26, paddingBottom: 24 },
  headerCompact: { padding: 18, gap: 8 },
  headingGroup: { flex: 1, minWidth: 0 },
  title: { color: colors.paper, fontSize: 32, lineHeight: 38, fontWeight: '700', fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  intro: { color: colors.smoke, fontSize: 14, lineHeight: 21, marginTop: 6 },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { flex: 1, minWidth: 0, minHeight: 66, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: 'transparent', borderBottomWidth: 2 },
  selectedTab: { borderBottomColor: colors.gold },
  tabIndex: { color: colors.smoke, fontSize: 10, fontWeight: '600', letterSpacing: 1.1 },
  tabName: { color: colors.paper, fontSize: 14, fontWeight: '600', marginTop: 5 },
  selectedTabText: { color: colors.gold },
  scroll: { flexShrink: 1, minHeight: 0 },
  form: { padding: 26, gap: 22 },
  formCompact: { padding: 18, gap: 20 },
  field: { gap: 9 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  label: { color: colors.paper, flexShrink: 1, fontSize: 14, fontWeight: '600' },
  counter: { color: colors.smoke, fontSize: 11, fontVariant: ['tabular-nums'] },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 6, backgroundColor: colors.ink, color: colors.paper, fontSize: 16, lineHeight: 23, paddingHorizontal: 13, paddingVertical: 11 },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  personaInput: { minHeight: 120 },
  invalidInput: { borderColor: colors.error },
  focused: { borderColor: colors.gold },
  note: { color: colors.smoke, fontSize: 13, lineHeight: 20 },
  errors: { gap: 7 },
  errorTitle: { color: colors.error, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  error: { color: colors.error, fontSize: 13, lineHeight: 20 },
  restore: { alignSelf: 'flex-start', marginLeft: -12, marginTop: -12 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 26, paddingVertical: 18, borderTopWidth: 1, borderTopColor: colors.line },
  footerCompact: { paddingHorizontal: 18, paddingVertical: 14 },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: colors.line, borderRadius: 6 },
  primaryButton: { backgroundColor: colors.gold, borderColor: colors.gold },
  quietButton: { borderColor: 'transparent', paddingHorizontal: 12 },
  buttonHovered: { borderColor: colors.gold },
  buttonLabel: { color: colors.paper, fontSize: 14, fontWeight: '600' },
  primaryButtonLabel: { color: colors.ink },
  pressed: { opacity: 0.74 },
  disabled: { opacity: 0.42 },
});
