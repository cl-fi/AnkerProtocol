/**
 * PredictManager indexer lookups were removed with the 6-24 migration.
 * AccountWrapper discovery lands in #4; callers should treat this as empty.
 */
export function usePredictManagers() {
  return {
    data: [] as Array<{ managerId: string; owner?: string }>,
    isPending: false,
    isError: false,
    error: null,
    refetch: async () => ({ data: [] as Array<{ managerId: string; owner?: string }> }),
  };
}
