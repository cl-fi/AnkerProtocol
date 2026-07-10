import type { PredictManagerState } from '../sui/predictManagerState';

/**
 * Manager-state JSON-RPC route was removed with the 6-24 migration.
 * Claim/custody moves to AccountWrapper in later tickets; this hook stays as a
 * disabled stub so portfolio UI can keep compiling against the old claim helpers.
 */
export function usePredictManagerState(_managerId?: string): {
  data: PredictManagerState | undefined;
  isPending: boolean;
  isError: boolean;
  error: null;
} {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
  };
}
