import { Pressable, StyleSheet, Text, View } from 'react-native';
import { minutesToHHMM } from '../domain/time';
import type { Slot } from '../domain/types';

type Props = {
  slot: Slot;
  onPress: (slotId: string) => void;
};

const TYPE_LABEL: Record<Slot['type'], string> = {
  meal: 'Mahlzeit',
  med: 'Medikament',
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
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
  },
  pressed: {
    backgroundColor: '#f5f7fb',
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    fontVariant: ['tabular-nums'],
    width: 62,
  },
  center: {
    flex: 1,
    marginLeft: 6,
  },
  title: {
    fontSize: 16,
    color: '#222',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  chevron: {
    fontSize: 22,
    color: '#bbb',
    paddingHorizontal: 6,
  },
});
