import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  suggestedRemainingMl,
  TUBE_LOSS_ML,
  type TargetActualPair,
} from '../domain/actualsMath';
import type { TodayRecipeItem } from '../domain/types';
import { DeliveryBadge } from './DeliveryBadge';
import { colors, radius } from './theme';

type Props = {
  items: TodayRecipeItem[];
  totalMl: number;
  editable: boolean;
  draftActuals: Record<string, string>;
  onActualChange: (itemId: string, componentId: string, text: string) => void;
};

export function RecipeCard({ items, editable, draftActuals, onActualChange }: Props) {
  const pairs: TargetActualPair[] = items.map((it) => ({ ml: it.ml, actualMl: it.actualMl }));

  // Hero: remaining amount for the last component, computed from all others' actuals.
  const lastItem = items.length > 1 ? items[items.length - 1] : null;
  const heroSuggestion = lastItem
    ? suggestedRemainingMl(pairs[pairs.length - 1], pairs.slice(0, -1))
    : 0;
  const lastIsEmpty = lastItem
    ? lastItem.actualMl === null || lastItem.actualMl === 0
    : false;
  const showHero = editable && !!lastItem && lastIsEmpty && heroSuggestion > 0;

  return (
    <View style={styles.container}>
      {items.map((r) => {
        const draftValue = draftActuals[r.itemId];
        const value =
          draftValue !== undefined
            ? draftValue
            : r.actualMl !== null
              ? String(r.actualMl)
              : '';

        return (
          <View key={`${r.componentId}:${r.sortOrder}`} style={styles.row}>
            <View style={styles.rowMain}>
              <View style={styles.nameWrap}>
                <Text style={styles.name} numberOfLines={1}>
                  {r.name}
                </Text>
                <DeliveryBadge form={r.deliveryForm} />
              </View>
              <View style={styles.amountWrap}>
                <TextInput
                  style={[styles.input, !editable && styles.inputReadonly]}
                  value={value}
                  onChangeText={(t) => onActualChange(r.itemId, r.componentId, t)}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  editable={editable}
                  maxLength={4}
                />
                <Text style={styles.amountTarget}>/ {r.ml} ml</Text>
              </View>
            </View>
            {r.deliveryForm === 'sondomat' ? (
              <Text style={styles.tubeHint}>
                Pumpe {r.ml} + {TUBE_LOSS_ML} ml = {r.ml + TUBE_LOSS_ML} ml
              </Text>
            ) : null}
          </View>
        );
      })}

      {showHero ? (
        <View style={styles.heroBox}>
          <View>
            <Text style={styles.heroLabel}>{lastItem!.name} – noch nötig</Text>
            {lastItem!.deliveryForm === 'sondomat' ? (
              <Text style={styles.heroTubeHint}>
                Pumpe {heroSuggestion + TUBE_LOSS_ML} ml total
              </Text>
            ) : null}
          </View>
          <Text style={styles.heroValue}>{heroSuggestion} ml</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  row: {
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  rowMain: {
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
    color: colors.text,
    flexShrink: 1,
  },
  amountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    minWidth: 56,
    textAlign: 'right',
  },
  inputReadonly: {
    backgroundColor: colors.borderLight,
    color: colors.textSecondary,
  },
  amountTarget: {
    fontSize: 13,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  tubeHint: {
    fontSize: 12,
    color: colors.tubeLoss,
    fontStyle: 'italic',
    marginTop: 2,
    marginBottom: 2,
  },
  heroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  heroTubeHint: {
    fontSize: 11,
    color: colors.tubeLoss,
    marginTop: 2,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
});
