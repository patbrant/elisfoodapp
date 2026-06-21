import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../src/db';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB-Init fehlgeschlagen:</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Tabs initialRouteName="today" screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="today" options={{ title: 'Heute' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="history" options={{ title: 'Verlauf' }} />
      <Tabs.Screen name="settings" options={{ title: 'Einstellungen' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#b00020', textAlign: 'center', marginTop: 8 },
});
