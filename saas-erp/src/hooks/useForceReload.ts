import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribes to the Supabase Realtime broadcast channel `app-cache-clear`.
 * When an admin sends a `force_reload` event (from Settings → "Push Update to All Users"),
 * every open browser tab on any device wipes its service-worker caches and reloads,
 * guaranteeing users always run the latest deploy.
 *
 * The channel is school-agnostic (broadcast is already scoped to the Supabase project),
 * so a single broadcast reaches all authenticated users regardless of school_id.
 */
export function useForceReload() {
  useEffect(() => {
    const channel = supabase
      .channel('app-cache-clear')
      .on('broadcast', { event: 'force_reload' }, async () => {
        // 1. Clear all service-worker caches so the browser fetches fresh assets
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        // 2. Hard-reload (bypass any in-memory or disk cache)
        window.location.reload();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
