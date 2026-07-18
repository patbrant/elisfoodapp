import { Pressable, StyleSheet, Text, View } from 'react-native';
import { totalPercentage, formatPercentage } from '../domain/actualsMath';
import { minutesToHHMM } from '../domain/time';
import type { TodayItem } from '../domain/types';
import { RecipeCard } from './RecipeCard';
import { colors, radius, shadow } from './theme';

type Props = {
  item: TodayItem;
  draftActuals: Record<string, string>;
  onDone: (slotId: string) => void;
  onReset: (slotId: string) => void;
  onActualChange: (slotId: string, itemId: string, componentId: string, text: string) => void;
};

export function TimelineItemCard({ item, draftActuals, onDone, onReset, onActualChange }: Props) {
  const { slot, effectiveRecipe, totalMl, event } = item;
  const hasEvent = !!event;
  const hasRecipe = slot.type === 'meal' && effectiveRecipe && effectiveRecipe.length > 0;
  const mealPct = hasRecipe
    ? totalPercentage(effectiveRecipe.map((r) => ({ ml: r.ml, actualMl: r.actualMl })))
    : null;

  return (
    <View style={[styles.card, hasEvent && styles.cardWithEvent]}>
      <View style={styles.header}>
        <Text style={styles.time}>{minutesToHHMM(slot.timeMinutes)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {slot.title}
        </Text>
        {mealPct !== null ? (
          <Text style={styles.headerPct}>{formatPercentage(mealPct)}</Text>
        ) : null}
        {event?.status === 'done' && <StatusBadge label="Erledigt" tone="done" />}
        {event?.status === 'skipped' && <StatusBadge label="Übersprungen" tone="skipped" />}
      </View>
      {slot.info ? <Text style={styles.info}>{slot.info}</Text> : null}
      {hasRecipe ? (
        <RecipeCard
          items={effectiveRecipe}
          totalMl={totalMl ?? 0}
          editable={!hasEvent}
          draftActuals={draftActuals}
          onActualChange={(itemId, componentId, text) =>
            onActualChange(slot.id, itemId, componentId, text)
          }
        />
      ) : null}
      {event?.note ? <Text style={styles.note}>„{event.note}"</Text> : null}
      <View style={styles.actions}>
        {hasEvent ? (
          <Pressable
            style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
            onPress={() => onReset(slot.id)}
          >
            <Text style={styles.resetText}>Zurücksetzen</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.doneButton, pressed && styles.pressed]}
            onPress={() => onDone(slot.id)}
          >
            <Text style={styles.doneText}>Erledigt</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'done' | 'skipped' }) {
  return (
    <View style={[styles.badge, tone === 'done' ? styles.badgeDone : styles.badgeSkipped]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  cardWithEvent: {
    opacity: 0.72,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    width: 58,
  },
  title: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    marginLeft: 6,
  },
  headerPct: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 6,
    fontVariant: ['tabular-nums'],
  },
  info: {
    marginTop: 4,
    marginLeft: 64,
    fontSize: 13,
    color: colors.textSecondary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginLeft: 8,
  },
  badgeDone: {
    backgroundColor: colors.badgeDone,
  },
  badgeSkipped: {
    backgroundColor: colors.badgeSkipped,
  },
  badgeText: {
    fontSize: 12,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.75,
  },
  doneButton: {
    backgroundColor: colors.primary,
  },
  doneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  note: {
    marginTop: 6,
    marginLeft: 64,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
});
