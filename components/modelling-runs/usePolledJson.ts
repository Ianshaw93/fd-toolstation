'use client';

import { useEffect, useState } from 'react';
import { MODELLING_POLL_MS, messageFrom } from '../../lib/modelling-runs/client';

export function usePolledJson<T>(url: string, parse: (data: unknown) => T) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function tick() {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(messageFrom(body) || `Request failed (${res.status})`);
        if (!active) return;
        setData(parse(body));
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        if (active) setLoading(false);
      }
    }

    tick();
    const id = setInterval(tick, MODELLING_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [url, parse]);

  return { data, error, loading };
}
