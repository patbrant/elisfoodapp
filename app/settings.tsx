import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHousehold } from '../src/context/HouseholdContext';
import {
  claimAdminRole,
  getAdminCode,
  leaveHousehold,
  readSyncMeta,
  registerPushToken,
} from '../src/services/authService';
import { drainOutbox, pullAll } from '../src/services/syncService';
import { colors, radius } from '../src/ui/theme';

export default function SettingsScreen() {
  const { context, isAdmin, refreshContext } = useHousehold();
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [adminCode, setAdminCode] = useState<string | null>(null);
  const [lastPull, setLastPull] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [draftAdminCode, setDraftAdminCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!context) return;
    const pull = await readSyncMeta('last_pull_at');
    setLastPull(pull ? formatDate(pull) : null);

    const { getSupabaseClient } = await import('../src/db/supabase');
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('households')
      .select('join_code')
      .eq('id', context.householdId)
      .single();
    if (data) setJoinCode(data.join_code);

    if (isAdmin) {
      const code = await getAdminCode(context.householdId);
      setAdminCode(code);
    }
  }, [context, isAdmin]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const handleCopyJoinCode = () => {
    if (!joinCode) return;
    Clipboard.setString(joinCode);
    Alert.alert('Kopiert', 'Beitritts-Code in die Zwischenablage kopiert.');
  };

  const handleCopyAdminCode = () => {
    if (!adminCode) return;
    Clipboard.setString(adminCode);
    Alert.alert('Kopiert', 'Admin-Code in die Zwischenablage kopiert.');
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

  const handleClaimAdmin = async () => {
    if (!context || !draftAdminCode.trim()) return;
    setClaiming(true);
    try {
      await claimAdminRole(context.householdId, draftAdminCode);
      await refreshContext();
      setDraftAdminCode('');
      Alert.alert('Erfolg', 'Du bist jetzt Admin dieses Haushalts.');
    } catch (err) {
      Alert.alert('Ungültiger Code', err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
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
            <CodeBox code={joinCode} />
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={handleCopyJoinCode}
            >
              <Text style={styles.btnTextPrimary}>Code kopieren</Text>
            </Pressable>
          </View>
        ) : null}

        {isAdmin && adminCode ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Admin-Code</Text>
            <Text style={styles.codeHint}>
              Teile diesen Code nur mit vertrauenswürdigen Personen — damit können sie sich selbst zum Admin ernennen:
            </Text>
            <CodeBox code={adminCode} />
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
              onPress={handleCopyAdminCode}
            >
              <Text style={styles.btnTextPrimary}>Code kopieren</Text>
            </Pressable>
          </View>
        ) : null}

        {!isAdmin ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Als Admin registrieren</Text>
            <Text style={styles.codeHint}>
              Gib den Admin-Code ein, den du vom Haushalts-Admin erhalten hast:
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="Admin-Code"
              placeholderTextColor={colors.textMuted}
              value={draftAdminCode}
              onChangeText={(t) => setDraftAdminCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
            />
            <Pressable
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { marginTop: 10 },
                (claiming || !draftAdminCode.trim()) && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={handleClaimAdmin}
              disabled={claiming || !draftAdminCode.trim()}
            >
              <Text style={styles.btnTextWhite}>
                {claiming ? 'Wird geprüft…' : 'Admin werden'}
              </Text>
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

function CodeBox({ code }: { code: string }) {
  return (
    <View style={styles.codeBox}>
      <Text style={styles.codeText}>{code}</Text>
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
  codeInput: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.text,
    textAlign: 'center',
  },
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
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.8 },
  btnTextWhite: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnTextPrimary: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  btnTextDanger: { color: colors.error, fontWeight: '700', fontSize: 15 },
});
