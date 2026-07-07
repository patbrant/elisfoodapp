import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHousehold } from '../../../src/context/HouseholdContext';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hhmmToMinutes, minutesToHHMM } from '../../../src/domain/time';
import type { Component, DeliveryForm, Slot } from '../../../src/domain/types';
import { colors, radius, shadow } from '../../../src/ui/theme';
import {
  addRecipeItem,
  deleteSlot,
  getSlot,
  listRecipeItems,
  removeRecipeItem,
  type RecipeItemWithMeta,
  updateRecipeItemDeliveryForm,
  updateRecipeItemMl,
  updateSlot,
} from '../../../src/services/planService';
import { ComponentPicker } from '../../../src/ui/ComponentPicker';
import { DeliveryBadge } from '../../../src/ui/DeliveryBadge';
import { Stepper } from '../../../src/ui/Stepper';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const TITLE_DEBOUNCE_MS = 300;

export default function SlotEditorScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const router = useRouter();
  const { isAdmin } = useHousehold();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [recipeItems, setRecipeItems] = useState<RecipeItemWithMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [timeText, setTimeText] = useState('');
  const [titleText, setTitleText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [timeInvalid, setTimeInvalid] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const infoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushTitleRef = useRef<() => void>(() => {});
  const flushInfoRef = useRef<() => void>(() => {});

  const reload = useCallback(async () => {
    if (!slotId) return;
    try {
      const [s, items] = await Promise.all([getSlot(slotId), listRecipeItems(slotId)]);
      if (!s) {
        router.back();
        return;
      }
      setSlot(s);
      setTimeText(minutesToHHMM(s.timeMinutes));
      setTitleText(s.title);
      setInfoText(s.info ?? '');
      setRecipeItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [slotId, router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!cancelled) await reload();
      })();
      return () => {
        cancelled = true;
      };
    }, [reload]),
  );

  useEffect(() => {
    return () => {
      if (titleTimerRef.current) {
        clearTimeout(titleTimerRef.current);
        flushTitleRef.current();
      }
      if (infoTimerRef.current) {
        clearTimeout(infoTimerRef.current);
        flushInfoRef.current();
      }
    };
  }, []);

  const flushTitle = useCallback(() => {
    if (!slot) return;
    const trimmed = titleText.trim();
    if (trimmed.length === 0 || trimmed === slot.title) {
      if (trimmed.length === 0) setTitleText(slot.title);
      return;
    }
    updateSlot(slot.id, { title: trimmed }).catch((err) =>
      Alert.alert('Konnte nicht speichern', String(err)),
    );
  }, [slot, titleText]);

  const flushInfo = useCallback(() => {
    if (!slot) return;
    const next = infoText.trim().length === 0 ? null : infoText.trim();
    if (next === (slot.info ?? null)) return;
    updateSlot(slot.id, { info: next }).catch((err) =>
      Alert.alert('Konnte nicht speichern', String(err)),
    );
  }, [slot, infoText]);

  useEffect(() => {
    flushTitleRef.current = flushTitle;
    flushInfoRef.current = flushInfo;
  }, [flushTitle, flushInfo]);

  const handleTitleChange = (next: string) => {
    setTitleText(next);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(flushTitle, TITLE_DEBOUNCE_MS);
  };

  const handleInfoChange = (next: string) => {
    setInfoText(next);
    if (infoTimerRef.current) clearTimeout(infoTimerRef.current);
    infoTimerRef.current = setTimeout(flushInfo, TITLE_DEBOUNCE_MS);
  };

  const handleTimeBlur = () => {
    if (!slot) return;
    if (!HHMM_REGEX.test(timeText)) {
      setTimeInvalid(true);
      setTimeText(minutesToHHMM(slot.timeMinutes));
      setTimeout(() => setTimeInvalid(false), 1500);
      return;
    }
    const minutes = hhmmToMinutes(timeText);
    if (minutes === slot.timeMinutes) return;
    updateSlot(slot.id, { timeMinutes: minutes }).then(() => reload()).catch((err) =>
      Alert.alert('Konnte nicht speichern', String(err)),
    );
  };

  const handlePickerSelect = useCallback(
    async (component: Component, form: DeliveryForm | null) => {
      if (!slot) return;
      setPickerVisible(false);
      try {
        await addRecipeItem(slot.id, component.id, undefined, form);
        await reload();
      } catch (err) {
        Alert.alert('Konnte nicht hinzufügen', err instanceof Error ? err.message : String(err));
      }
    },
    [slot, reload],
  );

  const handleFormChange = useCallback(
    (itemId: string) => {
      const doUpdate = async (form: DeliveryForm | null) => {
        try {
          await updateRecipeItemDeliveryForm(itemId, form);
          setRecipeItems((prev) =>
            prev ? prev.map((it) => (it.id === itemId ? { ...it, deliveryForm: form } : it)) : prev,
          );
        } catch (err) {
          Alert.alert('Konnte nicht speichern', err instanceof Error ? err.message : String(err));
          await reload();
        }
      };
      Alert.alert('Verabreichungsform', undefined, [
        { text: 'Flasche', onPress: () => doUpdate('flasche') },
        { text: 'Sondomat', onPress: () => doUpdate('sondomat') },
        { text: 'Spritze', onPress: () => doUpdate('spritze') },
        { text: 'Ohne Angabe', onPress: () => doUpdate(null) },
        { text: 'Abbrechen', style: 'cancel' },
      ]);
    },
    [reload],
  );

  const handleStepperChange = useCallback(
    async (itemId: string, ml: number) => {
      setRecipeItems((prev) =>
        prev ? prev.map((it) => (it.id === itemId ? { ...it, ml } : it)) : prev,
      );
      try {
        await updateRecipeItemMl(itemId, ml);
      } catch (err) {
        Alert.alert('Konnte nicht speichern', err instanceof Error ? err.message : String(err));
        await reload();
      }
    },
    [reload],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      try {
        await removeRecipeItem(itemId);
        setRecipeItems((prev) => (prev ? prev.filter((it) => it.id !== itemId) : prev));
      } catch (err) {
        Alert.alert('Konnte nicht entfernen', err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const handleDelete = useCallback(() => {
    if (!slot) return;
    Alert.alert(
      'Slot löschen?',
      'Der Slot wird inkl. aller Rezept-Komponenten und bereits gespeicherter Events permanent entfernt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSlot(slot.id);
              router.back();
            } catch (err) {
              Alert.alert('Konnte nicht löschen', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  }, [slot, router]);

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!slot || recipeItems === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const isMeal = slot.type === 'meal';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Section label="Zeit (HH:MM)">
          <TextInput
            style={[styles.input, timeInvalid && styles.inputInvalid, !isAdmin && styles.inputReadOnly]}
            value={timeText}
            onChangeText={isAdmin ? setTimeText : undefined}
            onBlur={isAdmin ? handleTimeBlur : undefined}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            editable={isAdmin}
          />
          {timeInvalid ? <Text style={styles.errorHint}>Bitte HH:MM (00:00–23:59).</Text> : null}
        </Section>

        <Section label="Titel">
          <TextInput
            style={[styles.input, !isAdmin && styles.inputReadOnly]}
            value={titleText}
            onChangeText={isAdmin ? handleTitleChange : undefined}
            onBlur={isAdmin ? flushTitle : undefined}
            editable={isAdmin}
          />
        </Section>

        <Section label="Info (optional)">
          <TextInput
            style={[styles.input, styles.inputMultiline, !isAdmin && styles.inputReadOnly]}
            value={infoText}
            onChangeText={isAdmin ? handleInfoChange : undefined}
            onBlur={isAdmin ? flushInfo : undefined}
            multiline
            numberOfLines={2}
            placeholder="Notiz für den Tag"
            placeholderTextColor="#999"
            editable={isAdmin}
          />
        </Section>

        {isMeal ? (
          <Section label="Rezept">
            <Text style={styles.recipeHint}>
              Pro Komponente: Menge, die 100 % der Mahlzeit entspricht.
            </Text>
            {recipeItems.length === 0 ? (
              <Text style={styles.recipeEmpty}>Noch keine Komponenten.</Text>
            ) : (
              recipeItems.map((item) => (
                <View key={item.id} style={styles.recipeRow}>
                  <View style={styles.recipeNameWrap}>
                    <Text style={styles.recipeName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isAdmin ? (
                      <Pressable onPress={() => handleFormChange(item.id)} hitSlop={8}>
                        {item.deliveryForm ? (
                          <DeliveryBadge form={item.deliveryForm} />
                        ) : (
                          <Text style={styles.addFormText}>Form</Text>
                        )}
                      </Pressable>
                    ) : item.deliveryForm ? (
                      <DeliveryBadge form={item.deliveryForm} />
                    ) : null}
                  </View>
                  <View pointerEvents={isAdmin ? 'auto' : 'none'}>
                    <Stepper
                      value={item.ml}
                      onChange={(v) => handleStepperChange(item.id, v)}
                    />
                  </View>
                  {isAdmin && (
                    <Pressable
                      onPress={() => handleRemoveItem(item.id)}
                      style={styles.removeButton}
                      hitSlop={6}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
            {isAdmin && (
              <Pressable
                style={({ pressed }) => [styles.addComponent, pressed && styles.addComponentPressed]}
                onPress={() => setPickerVisible(true)}
              >
                <Text style={styles.addComponentText}>+ Komponente</Text>
              </Pressable>
            )}
          </Section>
        ) : null}

        {isAdmin && (
          <Pressable style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteText}>Slot löschen</Text>
          </Pressable>
        )}
      </ScrollView>

      <ComponentPicker
        visible={pickerVisible}
        onSelect={handlePickerSelect}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputReadOnly: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
  },
  inputInvalid: {
    borderColor: colors.error,
  },
  errorHint: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  recipeEmpty: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  recipeHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  recipeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 8,
    gap: 8,
    ...shadow.card,
  },
  recipeNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeName: {
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  removeButton: {
    padding: 6,
  },
  removeText: {
    fontSize: 18,
    color: colors.textMuted,
  },
  addFormText: {
    fontSize: 12,
    color: colors.textSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  addComponent: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  addComponentPressed: {
    opacity: 0.85,
  },
  addComponentText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.error,
  },
  deleteText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
});
