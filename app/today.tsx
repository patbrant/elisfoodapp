import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toLocalISODate } from '../src/domain/time';
import { colors } from '../src/ui/theme';
import type { TodayItem } from '../src/domain/types';
import { removeActual, setActualMl } from '../src/services/actualsService';
import { createEvent } from '../src/services/eventService';
import { getTodayItems } from '../src/services/todayService';
import { SYNC_PULLED_EVENT } from '../src/services/syncService';
import { NoteModal } from '../src/ui/NoteModal';
import { TimelineItemCard } from '../src/ui/TimelineItemCard';

const ACTUAL_DEBOUNCE_MS = 400;

export default function TodayScreen() {
  const date = useMemo(() => toLocalISODate(new Date()), []);
  const [items, setItems] = useState<TodayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneTargetSlotId, setDoneTargetSlotId] = useState<string | null>(null);
  const [draftActuals, setDraftActuals] = useState<Record<string, Record<string, string>>>({});
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const reload = useCallback(() => {
    getTodayItems(date)
      .then((result) => setItems(result))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [date]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Reload whenever a background sync completes.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SYNC_PULLED_EVENT, reload);
    return () => sub.remove();
  }, [reload]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  const applyEvent = useCallback((slotId: string, ev: TodayItem['event']) => {
    setItems((prev) =>
      prev ? prev.map((it) => (it.slot.id === slotId ? { ...it, event: ev } : it)) : prev,
    );
  }, []);

  const applyActual = useCallback((slotId: string, itemId: string, ml: number | null) => {
    setItems((prev) =>
      prev
        ? prev.map((it) => {
            if (it.slot.id !== slotId || !it.effectiveRecipe) return it;
            return {
              ...it,
              effectiveRecipe: it.effectiveRecipe.map((r) =>
                r.itemId === itemId ? { ...r, actualMl: ml } : r,
              ),
            };
          })
        : prev,
    );
  }, []);

  const handleActualChange = useCallback(
    (slotId: string, itemId: string, componentId: string, text: string) => {
      const draftKey = `${slotId}:${itemId}`;
      setDraftActuals((prev) => ({
        ...prev,
        [slotId]: { ...(prev[slotId] ?? {}), [itemId]: text },
      }));

      const existing = timersRef.current.get(draftKey);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        timersRef.current.delete(draftKey);
        const trimmed = text.trim();
        const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
        if (parsed !== null && Number.isNaN(parsed)) {
          setDraftActuals((prev) => {
            const slotDraft = { ...(prev[slotId] ?? {}) };
            delete slotDraft[itemId];
            return { ...prev, [slotId]: slotDraft };
          });
          return;
        }
        try {
          if (parsed === null) {
            await removeActual(date, slotId, itemId);
            applyActual(slotId, itemId, null);
          } else {
            await setActualMl(date, slotId, itemId, componentId, parsed);
            applyActual(slotId, itemId, Math.max(0, parsed));
          }
          setDraftActuals((prev) => {
            const slotDraft = { ...(prev[slotId] ?? {}) };
            delete slotDraft[itemId];
            return { ...prev, [slotId]: slotDraft };
          });
        } catch (err) {
          Alert.alert('Konnte Menge nicht speichern', err instanceof Error ? err.message : String(err));
        }
      }, ACTUAL_DEBOUNCE_MS);
      timersRef.current.set(draftKey, timer);
    },
    [date, applyActual],
  );

  const handleDone = useCallback((slotId: string) => {
    for (const [key, t] of timersRef.current.entries()) {
      if (key.startsWith(`${slotId}:`)) {
        clearTimeout(t);
        timersRef.current.delete(key);
      }
    }
    setDoneTargetSlotId(slotId);
  }, []);

  const handleDoneSubmit = useCallback(
    async (note: string | null) => {
      const slotId = doneTargetSlotId;
      setDoneTargetSlotId(null);
      if (!slotId) return;
      try {
        const ev = await createEvent(date, slotId, 'done', note);
        applyEvent(slotId, ev);
      } catch (err) {
        Alert.alert('Konnte nicht speichern', err instanceof Error ? err.message : String(err));
      }
    },
    [date, doneTargetSlotId, applyEvent],
  );

  const handleDoneCancel = useCallback(() => setDoneTargetSlotId(null), []);

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Fehler beim Laden</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (items === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.empty}>Kein Plan aktiv.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Heute</Text>
        {items.map((item) => (
          <TimelineItemCard
            key={item.slot.id}
            item={item}
            draftActuals={draftActuals[item.slot.id] ?? {}}
            onDone={handleDone}
            onActualChange={handleActualChange}
          />
        ))}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <NoteModal
        visible={doneTargetSlotId !== null}
        title="Erledigt — Kommentar (optional)"
        placeholder="z.B. Mengen-Abweichung, Beobachtung"
        onSubmit={handleDoneSubmit}
        onCancel={handleDoneCancel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  empty: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});
