import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '../src/ui/theme';

type Status = 'idle' | 'running' | 'done';

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const [totalMlInput, setTotalMlInput] = useState('50');
  const [initialMlInput, setInitialMlInput] = useState('10');
  const [totalMinutesInput, setTotalMinutesInput] = useState('30');
  const [status, setStatus] = useState<Status>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Mutable timer state for setInterval closure (avoids stale closures)
  const timerRef = useRef({
    secondsLeft: 0,
    currentStep: 0,
    steps: 0,
    intervalSec: 0,
    totalMl: 0,
    initialMl: 0,
    canNotify: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fire timestamps (ms) and notification IDs for each step
  const scheduleRef = useRef<{
    notifIds: string[];
    fireTimes: number[];
  } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (scheduleRef.current) {
        scheduleRef.current.notifIds.forEach((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
        );
      }
    };
  }, []);

  // Foreground: when a timer notification fires while app is open
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notif) => {
      if (notif.request.content.data?.type !== 'timer') return;
      const isLast = notif.request.content.data?.isLast as boolean;

      if (isLast) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        scheduleRef.current = null;
        setStatus('done');
      } else {
        const stepIndex = notif.request.content.data?.stepIndex as number;
        const ref = scheduleRef.current;
        if (ref && ref.fireTimes[stepIndex + 1] !== undefined) {
          const newSecondsLeft = Math.ceil((ref.fireTimes[stepIndex + 1] - Date.now()) / 1000);
          timerRef.current.secondsLeft = newSecondsLeft;
          timerRef.current.currentStep = stepIndex + 1;
          setCurrentStep(stepIndex + 1);
          setSecondsLeft(newSecondsLeft);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Background → foreground sync: recalculate step and countdown from fire times
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active' || !scheduleRef.current) return;

      const now = Date.now();
      const { fireTimes } = scheduleRef.current;
      const nextIdx = fireTimes.findIndex((t) => t > now);

      if (nextIdx === -1) {
        // All steps fired while in background
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        scheduleRef.current = null;
        setStatus('done');
      } else {
        const newSecondsLeft = Math.ceil((fireTimes[nextIdx] - now) / 1000);
        timerRef.current.secondsLeft = newSecondsLeft;
        timerRef.current.currentStep = nextIdx;
        setCurrentStep(nextIdx);
        setSecondsLeft(newSecondsLeft);
      }
    });
    return () => sub.remove();
  }, []);

  const parsedTotal = parseInt(totalMlInput, 10) || 0;
  const parsedInitial = parseInt(initialMlInput, 10) || 0;
  const parsedMinutes = parseInt(totalMinutesInput, 10) || 0;
  const remaining = parsedTotal - parsedInitial;
  const isValid = parsedTotal > 0 && parsedMinutes > 0 && parsedInitial >= 0 && remaining > 0;
  const steps = isValid ? Math.ceil(remaining / 10) : 0;
  const intervalSec = isValid && steps > 0 ? Math.round((parsedMinutes * 60) / steps) : 0;
  const lastStepMl = remaining % 10;

  const handleStart = async () => {
    if (!isValid) return;
    Keyboard.dismiss();

    const { status: permStatus } = await Notifications.requestPermissionsAsync();
    const canNotify = permStatus === 'granted';

    const now = Date.now();
    const notifIds: string[] = [];
    const fireTimes: number[] = [];

    for (let i = 0; i < steps; i++) {
      const fireTime = now + (i + 1) * intervalSec * 1000;
      fireTimes.push(fireTime);

      if (canNotify) {
        const isLast = i === steps - 1;
        const stepMl = isLast ? (remaining - i * 10) : 10;
        const administered = parsedInitial + i * 10;

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: isLast ? 'Fertig!' : `Nächste ${stepMl}ml verabreichen`,
            body: isLast
              ? `${parsedTotal}ml vollständig verabreicht`
              : `Schritt ${i + 1} von ${steps} — ${administered + stepMl}ml von ${parsedTotal}ml`,
            sound: true,
            data: { type: 'timer', stepIndex: i, isLast },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(fireTime),
          },
        });
        notifIds.push(id);
      }
    }

    scheduleRef.current = { notifIds, fireTimes };
    timerRef.current = {
      secondsLeft: intervalSec,
      currentStep: 0,
      steps,
      intervalSec,
      totalMl: parsedTotal,
      initialMl: parsedInitial,
      canNotify,
    };

    setCurrentStep(0);
    setSecondsLeft(intervalSec);
    setStatus('running');

    intervalRef.current = setInterval(() => {
      const state = timerRef.current;
      state.secondsLeft -= 1;

      // Fallback step-advancement when notifications are unavailable (permissions denied)
      if (!state.canNotify && state.secondsLeft <= 0) {
        if (state.currentStep + 1 >= state.steps) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          Vibration.vibrate([0, 400, 150, 400, 150, 400]);
          setStatus('done');
          return;
        }
        state.currentStep += 1;
        state.secondsLeft = state.intervalSec;
        Vibration.vibrate([0, 300, 100, 300]);
        setCurrentStep(state.currentStep);
      }

      setSecondsLeft(Math.max(0, state.secondsLeft));
    }, 1000);
  };

  const handleStop = async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (scheduleRef.current) {
      await Promise.all(
        scheduleRef.current.notifIds.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
        ),
      );
      scheduleRef.current = null;
    }
    setStatus('idle');
  };

  const handleReset = () => {
    setStatus('idle');
    setCurrentStep(0);
    setSecondsLeft(0);
  };

  // Values for running display (computed from frozen input state)
  const currentStepMl = currentStep === steps - 1 ? remaining - currentStep * 10 : 10;
  const administeredMl = parsedInitial + currentStep * 10;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Timer</Text>

        {status === 'idle' && (
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Gesamtmenge</Text>
              <View style={styles.inputUnit}>
                <TextInput
                  style={styles.input}
                  value={totalMlInput}
                  onChangeText={setTotalMlInput}
                  keyboardType="numeric"
                  selectTextOnFocus
                  maxLength={4}
                />
                <Text style={styles.unit}>ml</Text>
              </View>
            </View>
            <View style={[styles.inputRow, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Bereits verabreicht</Text>
              <View style={styles.inputUnit}>
                <TextInput
                  style={styles.input}
                  value={initialMlInput}
                  onChangeText={setInitialMlInput}
                  keyboardType="numeric"
                  selectTextOnFocus
                  maxLength={4}
                />
                <Text style={styles.unit}>ml</Text>
              </View>
            </View>
            <View style={[styles.inputRow, { marginTop: 12 }]}>
              <Text style={styles.inputLabel}>Dauer</Text>
              <View style={styles.inputUnit}>
                <TextInput
                  style={styles.input}
                  value={totalMinutesInput}
                  onChangeText={setTotalMinutesInput}
                  keyboardType="numeric"
                  selectTextOnFocus
                  maxLength={3}
                />
                <Text style={styles.unit}>min</Text>
              </View>
            </View>

            {isValid && steps > 0 ? (
              <View style={styles.preview}>
                <Text style={styles.previewText}>
                  Noch {remaining}ml verteilen auf {steps}{' '}
                  {steps === 1 ? 'Schritt' : 'Schritte'}
                  {lastStepMl !== 0 ? ` (letzter ${lastStepMl}ml)` : ' × 10ml'}
                </Text>
                <Text style={styles.previewText}>
                  Intervall: alle {formatCountdown(intervalSec)} min
                </Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                !isValid && styles.btnDisabled,
                pressed && styles.btnPressed,
                { marginTop: 20 },
              ]}
              onPress={handleStart}
              disabled={!isValid}
            >
              <Text style={styles.btnTextWhite}>Starten</Text>
            </Pressable>
          </View>
        )}

        {status === 'running' && (
          <View style={[styles.card, styles.cardRunning]}>
            <Text style={styles.runningLabel}>Nächste {currentStepMl}ml in</Text>
            <Text style={styles.countdown}>{formatCountdown(secondsLeft)}</Text>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                Schritt {currentStep + 1} von {steps}
              </Text>
              <Text style={styles.progressText}>
                {administeredMl}ml von {parsedTotal}ml verabreicht
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnStop, pressed && styles.btnPressed]}
              onPress={handleStop}
            >
              <Text style={styles.btnTextDanger}>Stopp</Text>
            </Pressable>
          </View>
        )}

        {status === 'done' && (
          <View style={[styles.card, styles.cardDone]}>
            <Text style={styles.doneTitle}>Fertig!</Text>
            <Text style={styles.doneSubtitle}>
              {timerRef.current.totalMl}ml verabreicht
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                pressed && styles.btnPressed,
                { marginTop: 24 },
              ]}
              onPress={handleReset}
            >
              <Text style={styles.btnTextWhite}>Neuer Timer</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardRunning: { alignItems: 'center', paddingVertical: 36 },
  cardDone: { alignItems: 'center', paddingVertical: 40 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  inputUnit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    minWidth: 80,
  },
  unit: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  preview: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    gap: 4,
  },
  previewText: { fontSize: 14, color: colors.textSecondary },
  runningLabel: { fontSize: 16, color: colors.textSecondary, marginBottom: 8 },
  countdown: { fontSize: 72, fontWeight: '800', color: colors.primary, letterSpacing: -2 },
  progressInfo: { marginTop: 20, alignItems: 'center', gap: 4 },
  progressText: { fontSize: 15, color: colors.textSecondary },
  doneTitle: { fontSize: 36, fontWeight: '800', color: colors.success },
  doneSubtitle: { fontSize: 18, color: colors.textSecondary, marginTop: 8 },
  btn: { paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnStop: { marginTop: 28, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.8 },
  btnTextWhite: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnTextDanger: { color: colors.error, fontWeight: '700', fontSize: 16 },
});
