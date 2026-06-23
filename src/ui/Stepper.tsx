import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from './theme';

type Props = {
  value: number;
  onChange: (next: number) => void;
  steps?: number[];
  min?: number;
  max?: number;
  unit?: string;
};

const DEFAULT_STEPS = [-10, -5, 5, 10];

export function Stepper({
  value,
  onChange,
  steps = DEFAULT_STEPS,
  min = 0,
  max,
  unit = 'ml',
}: Props) {
  const apply = (delta: number) => {
    let next = value + delta;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    if (next !== value) onChange(next);
  };

  return (
    <View style={styles.row}>
      {steps.filter((s) => s < 0).map((s) => {
        const disabled = value + s < min;
        return (
          <StepperButton key={s} label={`${s}`} disabled={disabled} onPress={() => apply(s)} />
        );
      })}
      <View style={styles.valueWrap}>
        <Text style={styles.value}>
          {value} {unit}
        </Text>
      </View>
      {steps.filter((s) => s > 0).map((s) => {
        const disabled = max !== undefined && value + s > max;
        return (
          <StepperButton key={s} label={`+${s}`} disabled={disabled} onPress={() => apply(s)} />
        );
      })}
    </View>
  );
}

function StepperButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  button: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.surfaceAlt,
  },
  buttonDisabled: {
    backgroundColor: colors.borderLight,
  },
  buttonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  buttonTextDisabled: {
    color: colors.textMuted,
  },
  valueWrap: {
    minWidth: 64,
    alignItems: 'center',
  },
  value: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
