import { useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions<T> {
  initialData: T[];
  fetchMore: (cursor?: string) => Promise<{ 
    data: T[]; 
    nextCursor?: string;
    hasMore: boolean;
  }>;
  initialCursor?: string;
  initialHasMore?: boolean;
}

export function useInfiniteScroll<T>({ 
  initialData,
  fetchMore,
  initialCursor,
  initialHasMore = false
}: UseInfiniteScrollOptions<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const observerRef = useRef<IntersectionObserver>();
  const loadingRef = useRef<HTMLDivElement>(null);

  const loadMore = async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchMore(cursor);
      setData(prev => [...prev, ...result.data]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more items'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const currentLoadingRef = loadingRef.current;

    if (!currentLoadingRef) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(currentLoadingRef);

    return () => {
      if (observerRef.current && currentLoadingRef) {
        observerRef.current.unobserve(currentLoadingRef);
      }
    };
  }, [cursor, hasMore, isLoading]);

  return {
    data,
    isLoading,
    error,
    hasMore,
    loadingRef
  };
} 