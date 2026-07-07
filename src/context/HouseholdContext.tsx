import { createContext, useContext } from 'react';
import type { HouseholdContext } from '../services/authService';

type HouseholdCtxValue = {
  context: HouseholdContext | null;
  isAdmin: boolean;
  isReady: boolean;
};

export const HouseholdCtx = createContext<HouseholdCtxValue>({
  context: null,
  isAdmin: false,
  isReady: false,
});

export function useHousehold(): HouseholdCtxValue {
  return useContext(HouseholdCtx);
}
