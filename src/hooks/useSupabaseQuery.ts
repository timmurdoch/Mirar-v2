import { useCallback, useEffect, useState } from 'react';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

interface UseSupabaseQueryResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
}

/**
 * Hook for Supabase data fetching with automatic retry and exponential backoff.
 * Retries up to 3 times (1s, 2s, 4s delays) on failure.
 */
export function useSupabaseQuery<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = []
): UseSupabaseQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetchFn = useCallback(fetchFn, deps);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await stableFetchFn();
        setData(result);
        setLoading(false);
        return;
      } catch (err) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          const message = err instanceof Error ? err.message : 'An unexpected error occurred';
          setError(message);
          setLoading(false);
        }
      }
    }
  }, [stableFetchFn]);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, error, loading, retry: execute };
}
