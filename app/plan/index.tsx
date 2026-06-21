import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import type { Slot, SlotType } from '../../src/domain/types';

const DEFAULT_TIME_MINUTES = 7 * 60;

export default function PlanScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [planVersionId, setPlanVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const pvId = await getActivePlanVersionId();
          if (!pvId) {
            if (!cancelled) {
              setPlanVersionId(null);
              setSlots([]);
            }
            return;
          }
          const list = await listSlots(pvId);
          if (!cancelled) {
            setPlanVersionId(pvId);
            setSlots(list);
          }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 16,
  },
  empty: {
    fontSize: 14,
    color: '#666',
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
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addPressed: {
    opacity: 0.8,
  },
  addMeal: {
    backgroundColor: '#1f6feb',
  },
  addMed: {
    backgroundColor: '#6a4cd9',
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
    backgroundColor: '#f5f5f7',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b00020',
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    color: '#b00020',
    textAlign: 'center',
  },
});
