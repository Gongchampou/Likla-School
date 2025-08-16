import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SchoolSettings } from '../types';

let cached: SupabaseClient | null = null;
let lastUrl: string | null = null;
let lastKey: string | null = null;

function getSettings(): SchoolSettings | null {
  try {
    const raw = localStorage.getItem('schoolSettings');
    return raw ? (JSON.parse(raw) as SchoolSettings) : null;
  } catch {
    return null;
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const s = getSettings();
  const url = (s?.supabaseUrl || (import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const key = (s?.supabaseAnonKey || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  // If cached exists but credentials changed, recreate
  if (cached && (lastUrl !== url || lastKey !== key)) {
    cached = null;
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false },
    });
    lastUrl = url;
    lastKey = key;
  }
  return cached;
}

export function resetSupabaseClient() {
  cached = null;
  lastUrl = null;
  lastKey = null;
}

export function getSupabaseBucket(): string {
  const s = getSettings();
  return (s?.supabaseBucket || 'public').trim();
}

