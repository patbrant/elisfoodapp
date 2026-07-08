import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useHousehold } from '../../src/context/HouseholdContext';
import { SYNC_PULLED_EVENT } from '../../src/services/syncService';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createSlot, getActivePlanVersionId, listSlots } from '../../src/services/planService';
import { SlotRow } from '../../src/ui/SlotRow';
import { colors, radius } from '../../src/ui/theme';
import type { Slot, SlotType } from '../../src/domain/types';

const DEFAULT_TIME_MINUTES = 7 * 60;

export default function PlanScreen() {
  const router = useRouter();
  const { isAdmin } = useHousehold();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [planVersionId, setPlanVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const pvId = await getActivePlanVersionId();
      if (!pvId) { setPlanVersionId(null); setSlots([]); return; }
      const list = await listSlots(pvId);
      setPlanVersionId(pvId);
      setSlots(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SYNC_PULLED_EVENT, reload);
    return () => sub.remove();
  }, [reload]);

  const handleAdd = useCallback(
    async (type: SlotType) => {
      if (!planVersionId) {
        Alert.alert('Kein aktiver Plan', 'Plan-Version fehlt — App neu starten.');
        return;
      }
      try {
        const title = type === 'meal' ? 'Neue Mahlzeit' : 'Neues Medikament';
        const newSlot = await createSlot(planVersionId, {
          type,
          title,
          timeMinutes: DEFAULT_TIME_MINUTES,
        });
        router.push(`/plan/slot/${newSlot.id}`);
      } catch (err) {
        Alert.alert('Konnte nicht anlegen', err instanceof Error ? err.message : String(err));
      }
    },
    [planVersionId, router],
  );

  const handleRowPress = useCallback(
    (slotId: string) => router.push(`/plan/slot/${slotId}`),
    [router],
  );

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Fehler beim Laden</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (slots === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Plan</Text>
        {slots.length === 0 ? (
          <Text style={styles.empty}>Noch keine Slots — leg unten einen an.</Text>
        ) : (
          slots.map((slot) => <SlotRow key={slot.id} slot={slot} onPress={handleRowPress} />)
        )}
        {isAdmin && (
          <View style={styles.addRow}>
            <Pressable
              style={({ pressed }) => [styles.addButton, styles.addMeal, pressed && styles.addPressed]}
              onPress={() => handleAdd('meal')}
            >
              <Text style={styles.addText}>+ Mahlzeit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.addButton, styles.addMed, pressed && styles.addPressed]}
              onPress={() => handleAdd('med')}
            >
              <Text style={styles.addText}>+ Medikament</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  addButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  addPressed: {
    opacity: 0.8,
  },
  addMeal: {
    backgroundColor: colors.primary,
  },
  addMed: {
    backgroundColor: colors.secondary,
  },
  addText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
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
});
