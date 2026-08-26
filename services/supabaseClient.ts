
import { createClient } from '@supabase/supabase-js';

// Credentials come from the environment only. They are deliberately NOT
// hardcoded: this repository is public, and a baked-in fallback would point
// every clone, fork and local dev server at the live production database.
// Copy .env.example to .env.local and fill both values in (see README).
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  '';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  '';

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly and early — a half-configured client produces confusing
  // "failed to fetch" errors deep inside the app instead of naming the cause.
  throw new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    '(copy .env.example to .env.local for local development, or configure them as ' +
    'build environment variables in your hosting provider).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Attach (or clear) the server-minted staff session token on every REST call.
 * The token is created by the staff_login / staff_switch / owner_activate_staff
 * RPCs after a server-side PIN check; Postgres RLS resolves the operator's
 * role and shop from it. Client-asserted role headers are no longer used —
 * they were spoofable.
 */
let activeStaffToken: string | null = null;

export const setSupabaseStaffToken = (token?: string | null) => {
  const headers = (supabase as any).rest?.headers || {};
  if (token) {
    headers['x-staff-token'] = token;
    activeStaffToken = token;
  } else {
    delete headers['x-staff-token'];
    activeStaffToken = null;
  }
  // Clean up legacy spoofable headers if present
  delete headers['x-staff-role'];
  delete headers['x-staff-id'];
};

/**
 * The staff token currently in effect. Edge Function calls do not inherit the
 * REST headers above, so callers that need to prove staff identity to a
 * function (e.g. the AI endpoint) must forward this explicitly.
 */
export const getSupabaseStaffToken = () => activeStaffToken;

