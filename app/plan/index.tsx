import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { useHousehold } from '../../src/context/HouseholdContext';
import { SYNC_PULLED_EVENT } from '../../src/services/syncService';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createNewPlanVersion,
  createSlot,
  getActivePlanVersionId,
  listSlots,
} from '../../src/services/planService';
import { toLocalISODate } from '../../src/domain/time';
import { SlotRow } from '../../src/ui/SlotRow';
import { colors, radius } from '../../src/ui/theme';
import type { Slot, SlotType } from '../../src/domain/types';

const DEFAULT_TIME_MINUTES = 7 * 60;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function PlanScreen() {
  const router = useRouter();
  const { isAdmin } = useHousehold();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [planVersionId, setPlanVersionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [creating, setCreating] = useState(false);

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

  const openNewVersionModal = useCallback(() => {
    setDraftName('');
    setDraftDate(toLocalISODate(new Date()));
    setModalVisible(true);
  }, []);

  const handleCreateVersion = useCallback(async () => {
    const date = draftDate.trim();
    if (!ISO_DATE_RE.test(date)) {
      Alert.alert('Ungültiges Datum', 'Bitte im Format YYYY-MM-DD eingeben.');
      return;
    }
    setCreating(true);
    try {
      await createNewPlanVersion(draftName, date);
      setModalVisible(false);
      await reload();
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }, [draftName, draftDate, reload]);

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
        <View style={styles.headerRow}>
          <Text style={styles.header}>Plan</Text>
          {isAdmin && (
            <Pressable
              style={({ pressed }) => [styles.newVersionBtn, pressed && { opacity: 0.6 }]}
              onPress={openNewVersionModal}
            >
              <Text style={styles.newVersionText}>+ Version</Text>
            </Pressable>
          )}
        </View>
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

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>Neue Planversion erstellen</Text>
            <Text style={styles.modalHint}>
              Kopiert alle Slots des aktiven Plans. Ab dem gewählten Datum gilt die neue Version.
            </Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="z.B. Juli 2026"
              placeholderTextColor={colors.textMuted}
              value={draftName}
              onChangeText={setDraftName}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Gültig ab</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              value={draftDate}
              onChangeText={setDraftDate}
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.cancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalBtn, styles.confirmBtn, pressed && { opacity: 0.7 }]}
                onPress={handleCreateVersion}
                disabled={creating}
              >
                {creating
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmText}>Erstellen</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  newVersionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  newVersionText: {
    fontSize: 13,
    color: colors.textSecondary,
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
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
