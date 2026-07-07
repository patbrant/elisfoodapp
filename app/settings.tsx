import { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../src/context/HouseholdContext';
import { leaveHousehold, readSyncMeta, registerPushToken } from '../src/services/authService';
import { drainOutbox, pullAll } from '../src/services/syncService';
import { colors, radius } from '../src/ui/theme';

export default function SettingsScreen() {
  const { context, isAdmin } = useHousehold();
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [lastPull, setLastPull] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!context) return;
    loadMeta();
  }, [context]);

  const loadMeta = async () => {
    const [code, pull] = await Promise.all([
      readSyncMeta('household_id').then(async (hid) => {
        if (!hid) return null;
        // Fetch join code from Supabase (stored in households table)
        // We don't cache join code locally, so re-read from household context
        return null; // Will be shown once pulled from Supabase
      }),
      readSyncMeta('last_pull_at'),
    ]);
    setLastPull(pull ? formatDate(pull) : null);
    // Join code: fetch from Supabase
    if (context) {
      const { getSupabaseClient } = await import('../src/db/supabase');
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('households')
        .select('join_code')
        .eq('id', context.householdId)
        .single();
      if (data) setJoinCode(data.join_code);
    }
  };

  const handleCopyCode = () => {
    if (!joinCode) return;
    Clipboard.setString(joinCode);
    Alert.alert('Kopiert', 'Beitritts-Code in die Zwischenablage kopiert.');
  };

  const handleSync = async () => {
    if (!context) return;
    setSyncing(true);
    try {
      await pullAll(context);
      await drainOutbox(context);
      await loadMeta();
      Alert.alert('Synchronisiert', 'Daten erfolgreich abgeglichen.');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleRegisterToken = async () => {
    if (!context) return;
    try {
      await registerPushToken(context);
      Alert.alert('Erledigt', 'Push-Benachrichtigungen aktiviert.');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
    }
  };

  const handleLeave = () => {
    Alert.alert(
      'Haushalt verlassen?',
      'Du wirst aus dem gemeinsamen Plan entfernt. Lokale Daten bleiben erhalten.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Verlassen',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveHousehold();
              // The app will show the setup screen on next launch;
              // for now just show a message.
              Alert.alert('Haushalt verlassen', 'Bitte die App neu starten.');
            } catch (err) {
              Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  };

  if (!context) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.muted}>Kein Haushalt verbunden.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Einstellungen</Text>

        <View style={styles.card}>
          <Row label="Rolle" value={isAdmin ? 'Admin' : 'Betreuer'} />
          <Row label="Letzte Sync" value={lastPull ?? '—'} />
        </View>

        {isAdmin && joinCode ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Beitritts-Code</Text>
            <Text style={styles.codeHint}>
              Teile diesen Code mit Personen, die dem Haushalt beitreten sollen:
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{joinCode}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={handleCopyCode}
            >
              <Text style={styles.btnTextPrimary}>Code kopieren</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={handleSync}
            disabled={syncing}
          >
            <Text style={styles.btnTextWhite}>{syncing ? 'Synchronisiere…' : 'Jetzt synchronisieren'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSecondary, { marginTop: 8 }, pressed && styles.btnPressed]}
            onPress={handleRegisterToken}
          >
            <Text style={styles.btnTextPrimary}>Push-Benachrichtigungen aktivieren</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.btnPressed]}
            onPress={handleLeave}
          >
            <Text style={styles.btnTextDanger}>Haushalt verlassen</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 20 },
  muted: { color: colors.textMuted, fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  codeHint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
  codeBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  codeText: { fontSize: 28, fontWeight: '800', letterSpacing: 6, color: colors.primary },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowLabel: { fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  btn: {
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  btnPressed: { opacity: 0.8 },
  btnTextWhite: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextPrimary: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  btnTextDanger: { color: colors.error, fontWeight: '700', fontSize: 15 },
});
