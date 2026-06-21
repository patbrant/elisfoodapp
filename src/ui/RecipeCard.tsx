import { StyleSheet, Text, View } from 'react-native';
import type { TodayRecipeItem } from '../domain/types';
import { DeliveryBadge } from './DeliveryBadge';

type Props = {
  items: TodayRecipeItem[];
  totalMl: number;
};

export function RecipeCard({ items, totalMl }: Props) {
  return (
    <View style={styles.container}>
      {items.map((r) => (
        <View key={r.componentId} style={styles.row}>
          <View style={styles.nameWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
            </Text>
            <DeliveryBadge form={r.deliveryForm} />
          </View>
          <Text style={styles.ml}>{r.ml} ml</Text>
        </View>
      ))}
      <Text style={styles.total}>Summe: {totalMl} ml</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  name: {
    fontSize: 14,
    color: '#222',
    flexShrink: 1,
  },
  ml: {
    fontSize: 14,
    color: '#222',
    fontVariant: ['tabular-nums'],
  },
  total: {
    marginTop: 6,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
