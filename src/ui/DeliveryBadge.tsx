import { StyleSheet, Text, View } from 'react-native';
import type { DeliveryForm } from '../domain/types';

type Props = { form: DeliveryForm | null | undefined };

const LABELS: Record<DeliveryForm, string> = {
  flasche: 'Flasche',
  sonde: 'Sonde',
};

export function DeliveryBadge({ form }: Props) {
  if (!form) return null;
  return (
    <View style={[styles.badge, form === 'flasche' ? styles.flasche : styles.sonde]}>
      <Text style={styles.text}>{LABELS[form]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flasche: {
    backgroundColor: '#e7ddf7',
  },
  sonde: {
    backgroundColor: '#d8ecdb',
  },
  text: {
    fontSize: 11,
    color: '#333',
    fontWeight: '500',
  },
});
