import { createContext, useContext } from 'react';
import type { HouseholdContext } from '../services/authService';

type HouseholdCtxValue = {
  context: HouseholdContext | null;
  isAdmin: boolean;
  isReady: boolean;
  refreshContext: () => Promise<void>;
};

export const HouseholdCtx = createContext<HouseholdCtxValue>({
  context: null,
  isAdmin: false,
  isReady: false,
  refreshContext: async () => {},
});

export function useHousehold(): HouseholdCtxValue {
  return useContext(HouseholdCtx);
}
