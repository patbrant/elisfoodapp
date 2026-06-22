export const TUBE_LOSS_ML = 20;

export type TargetActualPair = {
  ml: number;
  actualMl: number | null;
};

export function componentPercentage(p: TargetActualPair): number {
  if (p.ml <= 0) return 0;
  return (p.actualMl ?? 0) / p.ml;
}

export function totalPercentage(items: TargetActualPair[]): number {
  return items.reduce((sum, p) => sum + componentPercentage(p), 0);
}

export function suggestedRemainingMl(item: TargetActualPair, others: TargetActualPair[]): number {
  if (item.ml <= 0) return 0;
  const otherSum = totalPercentage(others);
  const gap = Math.max(0, 1 - otherSum);
  return Math.round(gap * item.ml);
}

export function formatPercentage(pct: number): string {
  return `${Math.round(pct * 100)} %`;
}
