import { Pressable, StyleSheet, Text, View } from 'react-native';
import { minutesToHHMM } from '../domain/time';
import type { TodayItem } from '../domain/types';
import { RecipeCard } from './RecipeCard';

type Props = {
  item: TodayItem;
  onDone: (slotId: string) => void;
};

export function TimelineItemCard({ item, onDone }: Props) {
  const { slot, effectiveRecipe, totalMl, event } = item;
  const hasEvent = !!event;

  return (
    <View style={[styles.card, hasEvent && styles.cardWithEvent]}>
      <View style={styles.header}>
        <Text style={styles.time}>{minutesToHHMM(slot.timeMinutes)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {slot.title}
        </Text>
        {event?.status === 'done' && <StatusBadge label="Erledigt" tone="done" />}
        {event?.status === 'skipped' && <StatusBadge label="Übersprungen" tone="skipped" />}
      </View>
      {slot.info ? <Text style={styles.info}>{slot.info}</Text> : null}
      {slot.type === 'meal' && effectiveRecipe && effectiveRecipe.length > 0 ? (
        <RecipeCard items={effectiveRecipe} totalMl={totalMl ?? 0} />
      ) : null}
      {event?.note ? <Text style={styles.note}>„{event.note}"</Text> : null}
      {!hasEvent ? (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.actionButton, styles.doneButton, pressed && styles.pressed]}
            onPress={() => onDone(slot.id)}
          >
            <Text style={styles.doneText}>Erledigt</Text>
          </Pressable>
        </View>
      ) : null}
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  cardWithEvent: {
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    fontVariant: ['tabular-nums'],
    width: 58,
  },
  title: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    marginLeft: 6,
  },
  info: {
    marginTop: 4,
    marginLeft: 64,
    fontSize: 13,
    color: '#555',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeDone: {
    backgroundColor: '#d9f0d9',
  },
  badgeSkipped: {
    backgroundColor: '#f0e0d9',
  },
  badgeText: {
    fontSize: 12,
    color: '#222',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  doneButton: {
    backgroundColor: '#1f6feb',
  },
  doneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    marginTop: 6,
    marginLeft: 64,
    fontSize: 13,
    fontStyle: 'italic',
    color: '#555',
  },
});
