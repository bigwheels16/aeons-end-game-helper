import { useState, useCallback } from 'react';

/**
 * Custom hook to manage a set of string IDs with toggle, membership check, and clear capabilities.
 */
export function useToggleSet(initialValues: string[] = []) {
  const [set, setSet] = useState<Set<string>>(() => new Set(initialValues));

  const toggle = useCallback((id: string) => {
    setSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const has = useCallback((id: string) => set.has(id), [set]);

  const clear = useCallback(() => {
    setSet(new Set());
  }, []);

  return { set, toggle, has, clear };
}
