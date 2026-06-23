import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  componentPercentage,
  formatPercentage,
  suggestedRemainingMl,
  TUBE_LOSS_ML,
  type TargetActualPair,
} from '../domain/actualsMath';
import type { TodayRecipeItem } from '../domain/types';
import { DeliveryBadge } from './DeliveryBadge';

type Props = {
  items: TodayRecipeItem[];
  totalMl: number;
  editable: boolean;
  draftActuals: Record<string, string>;
  onActualChange: (itemId: string, componentId: string, text: string) => void;
};

export function RecipeCard({ items, totalMl, editable, draftActuals, onActualChange }: Props) {
  const pairs: TargetActualPair[] = items.map((it) => ({ ml: it.ml, actualMl: it.actualMl }));

  return (
    <View style={styles.container}>
      {items.map((r, idx) => {
        const others = pairs.filter((_, i) => i !== idx);
        const suggestion = suggestedRemainingMl(pairs[idx], others);
        const isEmpty = r.actualMl === null || r.actualMl === 0;
        const showSuggestion = editable && isEmpty && suggestion > 0;
        const pct = componentPercentage(pairs[idx]);
        const draftValue = draftActuals[r.itemId];
        const value = draftValue !== undefined
          ? draftValue
          : r.actualMl !== null
            ? String(r.actualMl)
            : '';

        return (
          <View key={`${r.componentId}:${r.sortOrder}`} style={styles.row}>
            <View style={styles.line1}>
              <View style={styles.nameWrap}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.name}
                </Text>
                <DeliveryBadge form={r.deliveryForm} />
              </View>
              <Text style={styles.target}>Maximalmenge {r.ml} ml</Text>
              <Text style={[styles.percent, pct === 0 && styles.percentZero]}>
                {formatPercentage(pct)}
              </Text>
            </View>
            {r.deliveryForm === 'sondomat' ? (
              <Text style={styles.tubeHint}>
                Pumpe {r.ml} + {TUBE_LOSS_ML} ml = {r.ml + TUBE_LOSS_ML} ml
              </Text>
            ) : null}
            <View style={styles.line2}>
              <Text style={styles.inputLabel}>Verabreicht</Text>
              <TextInput
                style={[styles.input, !editable && styles.inputReadonly]}
                value={value}
                onChangeText={(t) => onActualChange(r.itemId, r.componentId, t)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#bbb"
                editable={editable}
                maxLength={4}
              />
              <Text style={styles.inputUnit}>ml</Text>
              {showSuggestion ? (
                <Text style={styles.suggestion}>≈ {suggestion} ml</Text>
              ) : null}
            </View>
          </View>
        );
      })}
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
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  line1: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    color: '#222',
    flexShrink: 1,
  },
  target: {
    fontSize: 13,
    color: '#666',
    marginRight: 10,
    fontVariant: ['tabular-nums'],
  },
  percent: {
    fontSize: 13,
    color: '#111',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 42,
    textAlign: 'right',
  },
  percentZero: {
    color: '#999',
    fontWeight: '400',
  },
  line2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 12,
    color: '#666',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#bbb',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: '#111',
    fontVariant: ['tabular-nums'],
    minWidth: 56,
    textAlign: 'right',
  },
  inputReadonly: {
    backgroundColor: '#f5f5f5',
    color: '#555',
  },
  inputUnit: {
    fontSize: 13,
    color: '#666',
  },
  suggestion: {
    fontSize: 12,
    color: '#0a7d2c',
    fontStyle: 'italic',
    marginLeft: 6,
  },
  tubeHint: {
    fontSize: 12,
    color: '#7a5c00',
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 2,
  },
  total: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
