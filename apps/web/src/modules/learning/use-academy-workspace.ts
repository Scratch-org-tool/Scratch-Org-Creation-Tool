'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCatalog } from './learning-api';
import type { LearningCatalogResponse } from './types';

export function useAcademyWorkspace() {
  const [catalog, setCatalog] = useState<LearningCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCatalog();
      setCatalog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the academy catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { catalog, loading, error, reload: load };
}
