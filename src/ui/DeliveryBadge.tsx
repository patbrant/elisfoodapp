import { StyleSheet, Text, View } from 'react-native';
import type { DeliveryForm } from '../domain/types';
import { colors, radius } from './theme';

type Props = { form: DeliveryForm | null | undefined };

const LABELS: Record<DeliveryForm, string> = {
  flasche:  'Flasche',
  sondomat: 'Sondomat',
  spritze:  'Spritze',
};

const BADGE_COLORS: Record<DeliveryForm, string> = {
  flasche:  colors.badgeFlasche,
  sondomat: colors.badgeSondomat,
  spritze:  colors.badgeSpritze,
};

export function DeliveryBadge({ form }: Props) {
  if (!form) return null;
  return (
    <View style={[styles.badge, { backgroundColor: BADGE_COLORS[form] }]}>
      <Text style={styles.text}>{LABELS[form]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  text: {
    fontSize: 11,
    color: colors.badgeText,
    fontWeight: '500',
  },
});
