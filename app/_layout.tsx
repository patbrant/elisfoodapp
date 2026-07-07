import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDb } from '../src/db';
import { HouseholdCtx } from '../src/context/HouseholdContext';
import {
  getLocalHouseholdContext,
  type HouseholdContext,
} from '../src/services/authService';
import { initSync } from '../src/services/syncService';
import { useSyncEffect } from '../src/hooks/useSyncEffect';
import { colors } from '../src/ui/theme';
import SetupScreen from './setup';

type DbState = 'loading' | 'setup' | 'ready';

export default function RootLayout() {
  const [dbState, setDbState] = useState<DbState>('loading');
  const [householdCtx, setHouseholdCtx] = useState<HouseholdContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDb();
        const ctx = await getLocalHouseholdContext();
        if (cancelled) return;

        if (ctx) {
          setHouseholdCtx(ctx);
          const unsub = await initSync(ctx);
          if (!cancelled) {
            unsubscribeRef.current = unsub;
          } else {
            unsub();
          }
          setDbState('ready');
        } else {
          setDbState('setup');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      unsubscribeRef.current?.();
    };
  }, []);

  const handleSetupComplete = async (ctx: HouseholdContext) => {
    setHouseholdCtx(ctx);
    const unsub = await initSync(ctx).catch(() => () => {});
    unsubscribeRef.current = unsub;
    setDbState('ready');
  };

  useSyncEffect(householdCtx);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>DB-Init fehlgeschlagen:</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (dbState === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (dbState === 'setup') {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  return (
    <HouseholdCtx.Provider
      value={{
        context: householdCtx,
        isAdmin: householdCtx?.role === 'admin',
        isReady: true,
      }}
    >
      <Tabs
        initialRouteName="today"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="setup" options={{ href: null }} />
        <Tabs.Screen
          name="today"
          options={{
            title: 'Heute',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="clipboard-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Verlauf',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="time-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Einstellungen',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </HouseholdCtx.Provider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  errorText: { color: colors.error, textAlign: 'center', marginTop: 8 },
});
