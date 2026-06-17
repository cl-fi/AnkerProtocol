'use client';

import { useQuery } from '@tanstack/react-query';
import type { PredictManagerState } from '../sui/predictManagerState';

async function fetchPredictManagerState(managerId: string): Promise<PredictManagerState> {
  const response = await fetch(`/api/predict/manager-state?managerId=${encodeURIComponent(managerId)}`, {
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `Predict manager state request failed: ${response.status}`);
  }
  return payload as PredictManagerState;
}

export function usePredictManagerState(managerId?: string) {
  return useQuery({
    queryKey: ['predict-manager-state', managerId],
    enabled: Boolean(managerId),
    queryFn: () => fetchPredictManagerState(managerId!),
    refetchInterval: 10_000,
  });
}
