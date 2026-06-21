import { Pressable, StyleSheet, Text, View } from 'react-native';

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
    backgroundColor: '#eef1f5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: '#dde2ea',
  },
  buttonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  buttonText: {
    fontSize: 14,
    color: '#222',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  buttonTextDisabled: {
    color: '#bbb',
  },
  valueWrap: {
    minWidth: 64,
    alignItems: 'center',
  },
  value: {
    fontSize: 15,
    color: '#111',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
