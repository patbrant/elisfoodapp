import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { minutesToHHMM, toLocalISODate } from '../src/domain/time';
import type { Slot } from '../src/domain/types';
import {
  getActivePlanVersionId,
  listAllPlanVersions,
  listSlots,
  type PlanVersionWithCount,
} from '../src/services/planService';
import { SYNC_PULLED_EVENT } from '../src/services/syncService';
import { colors, radius, shadow } from '../src/ui/theme';

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}

export default function HistoryScreen() {
  const today = toLocalISODate(new Date());
  const [versions, setVersions] = useState<PlanVersionWithCount[] | null>(null);
  const [activePvId, setActivePvId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, Slot[]>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [pvs, activeId] = await Promise.all([listAllPlanVersions(), getActivePlanVersionId()]);
      setVersions(pvs);
      setActivePvId(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(SYNC_PULLED_EVENT, reload);
    return () => sub.remove();
  }, [reload]);

  const handleToggle = useCallback(async (pvId: string) => {
    if (expandedId === pvId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(pvId);
    if (!expandedSlots[pvId]) {
      try {
        const slots = await listSlots(pvId);
        setExpandedSlots((prev) => ({ ...prev, [pvId]: slots }));
      } catch {
        setExpandedSlots((prev) => ({ ...prev, [pvId]: [] }));
      }
    }
  }, [expandedId, expandedSlots]);

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (versions === null) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Verlauf</Text>
        {versions.length === 0 ? (
          <Text style={styles.empty}>Noch keine Planversionen vorhanden.</Text>
        ) : (
          versions.map((pv) => {
            const isActive = pv.id === activePvId;
            const isExpanded = expandedId === pv.id;
            const slots = expandedSlots[pv.id];

            return (
              <View key={pv.id} style={styles.card}>
                <Pressable
                  style={({ pressed }) => [styles.cardHeader, pressed && { opacity: 0.75 }]}
                  onPress={() => handleToggle(pv.id)}
                >
                  <View style={styles.cardMain}>
                    <Text style={styles.versionName}>{pv.name}</Text>
                    <Text style={styles.versionDate}>ab {formatDate(pv.valid_from)}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    {isActive && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Aktiv</Text>
                      </View>
                    )}
                    <Text style={styles.slotCount}>{pv.slotCount} Slots</Text>
                    <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.slotList}>
                    {slots === undefined ? (
                      <ActivityIndicator style={styles.slotLoader} />
                    ) : slots.length === 0 ? (
                      <Text style={styles.noSlots}>Keine Slots in dieser Version.</Text>
                    ) : (
                      slots.map((slot) => (
                        <View key={slot.id} style={styles.slotRow}>
                          <Text style={styles.slotTime}>{minutesToHHMM(slot.timeMinutes)}</Text>
                          <Text style={styles.slotTitle}>{slot.title}</Text>
                          <Text style={styles.slotType}>{slot.type === 'meal' ? 'Mahlzeit' : 'Med'}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardMain: {
    flex: 1,
  },
  versionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  versionDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  activeBadgeText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
  },
  slotCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 11,
    color: colors.textMuted,
  },
  slotList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  slotLoader: {
    marginVertical: 8,
  },
  noSlots: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    width: 50,
  },
  slotTitle: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  slotType: {
    fontSize: 11,
    color: colors.textMuted,
  },
  bottomSpacer: {
    height: 24,
  },
});
