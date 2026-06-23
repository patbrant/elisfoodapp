import { Pressable, StyleSheet, Text, View } from 'react-native';
import { minutesToHHMM } from '../domain/time';
import type { Slot } from '../domain/types';
import { colors, radius, shadow } from './theme';

type Props = {
  slot: Slot;
  onPress: (slotId: string) => void;
};

const TYPE_LABEL: Record<Slot['type'], string> = {
  meal: 'Mahlzeit',
  med:  'Medikament',
};

export function SlotRow({ slot, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => onPress(slot.id)}
    >
      <Text style={styles.time}>{minutesToHHMM(slot.timeMinutes)}</Text>
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {slot.title}
        </Text>
        <Text style={styles.subtitle}>{TYPE_LABEL[slot.type]}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 8,
    ...shadow.card,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
    width: 62,
  },
  center: {
    flex: 1,
    marginLeft: 6,
  },
  title: {
    fontSize: 16,
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    paddingHorizontal: 6,
  },
});
