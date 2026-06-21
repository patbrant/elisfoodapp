import { StyleSheet, Text, View } from 'react-native';

type Props = {
  items: Array<{ componentId: string; name: string; ml: number; sortOrder: number }>;
  totalMl: number;
};

export function RecipeCard({ items, totalMl }: Props) {
  return (
    <View style={styles.container}>
      {items.map((r) => (
        <View key={r.componentId} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {r.name}
          </Text>
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
    paddingVertical: 2,
  },
  name: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    marginRight: 12,
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
