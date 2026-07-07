import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { HouseholdContext } from '../services/authService';
import { drainOutbox, pullAll } from '../services/syncService';

export function useSyncEffect(context: HouseholdContext | null): void {
  const stateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!context) return;

    pullAll(context).catch(console.warn);
    drainOutbox(context).catch(console.warn);

    const sub = AppState.addEventListener('change', (nextState) => {
      const wasBackground = stateRef.current.match(/inactive|background/);
      if (wasBackground && nextState === 'active') {
        pullAll(context).catch(console.warn);
        drainOutbox(context).catch(console.warn);
      }
      stateRef.current = nextState;
    });

    return () => sub.remove();
  }, [context]);
}
