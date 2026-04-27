import { supabase } from './supabase';
import { useState, useEffect } from 'react';

// ─── Default Item Names ───────────────────────────────────────────────────────
// Used as fallback when the school hasn't configured custom item names yet.

export const DEFAULT_RECURRING_ITEMS = [
  'Tuition Fee',
  'Computer Lab Fee',
  'Sports Fee',
  'Library Fee',
  'Transport Fee',
  'Utility / Misc Fee',
  'Examination Fee',
  'Stationery Fee',
  'Smart Board Fee',
  'Security Fee',
];

export const DEFAULT_ONETIME_ITEMS = [
  'Admission Fee',
  'Registration Fee',
  'Security Deposit',
  'Prospectus Fee',
  'Laboratory Fee',
  'Identity Card Fee',
  'Uniform Fee',
  'Almanac / Diary Fee',
];

export interface FeeItemNames {
  recurring: string[];
  onetime: string[];
  /** All items (recurring + onetime), deduplicated */
  all: string[];
}

// ─── Async Fetch ──────────────────────────────────────────────────────────────

/**
 * Fetch the school's configured fee item names from `form_settings`.
 * Falls back to DEFAULT_* lists when not yet configured.
 * The result is used both in FeeTemplates (for editing the library) and in
 * every module that renders a fee breakdown dropdown.
 */
export async function getFeeItems(schoolId: string): Promise<FeeItemNames> {
  const { data } = await supabase
    .from('form_settings')
    .select('sections_config')
    .eq('school_id', schoolId)
    .eq('form_name', 'fee_item_names')
    .maybeSingle();

  const recurring: string[] =
    data?.sections_config?.recurring?.length
      ? data.sections_config.recurring
      : DEFAULT_RECURRING_ITEMS;

  const onetime: string[] =
    data?.sections_config?.onetime?.length
      ? data.sections_config.onetime
      : DEFAULT_ONETIME_ITEMS;

  return {
    recurring,
    onetime,
    all: [...new Set([...recurring, ...onetime])],
  };
}

// ─── React Hook ───────────────────────────────────────────────────────────────

/**
 * React hook — fetches fee item names once per school session.
 * Safe to call in multiple components simultaneously (each gets its own fetch).
 *
 * @example
 *   const { all, recurring, loading } = useFeeItems(userRole?.school_id);
 */
export function useFeeItems(schoolId: string | undefined): FeeItemNames & { loading: boolean } {
  const defaultState: FeeItemNames = {
    recurring: DEFAULT_RECURRING_ITEMS,
    onetime: DEFAULT_ONETIME_ITEMS,
    all: [...new Set([...DEFAULT_RECURRING_ITEMS, ...DEFAULT_ONETIME_ITEMS])],
  };

  const [items, setItems] = useState<FeeItemNames>(defaultState);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    let cancelled = false;
    setLoading(true);
    getFeeItems(schoolId).then(result => {
      if (!cancelled) {
        setItems(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [schoolId]);

  return { ...items, loading };
}
