import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  createHousehold,
  joinHousehold,
  pushSeedData,
  registerPushToken,
  type HouseholdContext,
} from '../src/services/authService';
import { colors, radius } from '../src/ui/theme';

type Screen = 'home' | 'create' | 'join' | 'created';

type Props = {
  onComplete: (ctx: HouseholdContext) => void;
};

export default function SetupScreen({ onComplete }: Props) {
  const [screen, setScreen] = useState<Screen>('home');
  const [householdName, setHouseholdName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [createdCtx, setCreatedCtx] = useState<HouseholdContext | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const name = householdName.trim() || 'Familie';
      const { joinCode: code, context } = await createHousehold(name);
      await pushSeedData(context);
      await registerPushToken(context).catch(() => {});
      setCreatedCode(code);
      setCreatedCtx(context);
      setScreen('created');
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      Alert.alert('Code zu kurz', 'Bitte den vollständigen Beitritts-Code eingeben.');
      return;
    }
    setLoading(true);
    try {
      const context = await joinHousehold(code);
      await registerPushToken(context).catch(() => {});
      onComplete(context);
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(createdCode);
    Alert.alert('Kopiert', 'Code in die Zwischenablage kopiert.');
  };

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Eli's Food App</Text>
          <Text style={styles.subtitle}>Geräte verbinden</Text>
          <Text style={styles.body}>
            Erstelle einen gemeinsamen Haushalt und teile den Code mit Eltern und Betreuern — alle sehen
            denselben Ernährungsplan.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
            onPress={() => setScreen('create')}
          >
            <Text style={styles.btnTextWhite}>Haushalt erstellen</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
            onPress={() => setScreen('join')}
          >
            <Text style={styles.btnTextPrimary}>Code eingeben</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'create') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.container}>
            <Pressable onPress={() => setScreen('home')} style={styles.back}>
              <Text style={styles.backText}>← Zurück</Text>
            </Pressable>
            <Text style={styles.title}>Haushalt erstellen</Text>
            <Text style={styles.label}>Haushaltsname (optional)</Text>
            <TextInput
              style={styles.input}
              value={householdName}
              onChangeText={setHouseholdName}
              placeholder="Familie"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={handleCreate}
              >
                <Text style={styles.btnTextWhite}>Erstellen</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === 'join') {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.container}>
            <Pressable onPress={() => setScreen('home')} style={styles.back}>
              <Text style={styles.backText}>← Zurück</Text>
            </Pressable>
            <Text style={styles.title}>Haushalt beitreten</Text>
            <Text style={styles.label}>Beitritts-Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="Z.B. XY7K2M"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              autoFocus
            />
            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
                onPress={handleJoin}
              >
                <Text style={styles.btnTextWhite}>Beitreten</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // screen === 'created'
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Haushalt erstellt!</Text>
        <Text style={styles.body}>
          Teile diesen Code mit Eltern und Betreuern, damit sie sich anmelden können:
        </Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{createdCode}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSecondary, pressed && styles.btnPressed]}
          onPress={handleCopyCode}
        >
          <Text style={styles.btnTextPrimary}>Code kopieren</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.btnPressed]}
          onPress={() => createdCtx && onComplete(createdCtx)}
        >
          <Text style={styles.btnTextWhite}>Weiter</Text>
        </Pressable>
        <Text style={styles.hint}>
          Du findest den Code jederzeit in den Einstellungen.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
  },
  back: { marginBottom: 24 },
  backText: { color: colors.primary, fontSize: 15 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: colors.text,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  codeBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.primary,
  },
  btn: {
    paddingVertical: 15,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 12,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPressed: { opacity: 0.8 },
  btnTextWhite: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnTextPrimary: { color: colors.primary, fontWeight: '700', fontSize: 16 },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
});
