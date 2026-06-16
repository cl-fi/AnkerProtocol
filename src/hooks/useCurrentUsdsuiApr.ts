import { useQuery } from '@tanstack/react-query';
import { fetchCurrentUsdsuiApr } from '../current/currentUsdsuiApr';

export function useCurrentUsdsuiApr() {
  return useQuery({
    queryKey: ['current-usdsui-apr'],
    queryFn: () => fetchCurrentUsdsuiApr(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
