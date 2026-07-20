
import { createClient } from '@supabase/supabase-js';

// Resolve credentials dynamically from Vite or process-injected variables with fallback to default demo
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  'https://mnffqzcgcwqgpguigkzt.supabase.co';

const supabaseKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZmZxemNnY3dxZ3BndWlna3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTQ0MTcsImV4cCI6MjA4MTA3MDQxN30.JQwLXczs6L7SP_XrddONNdYPjm5TwpJ918xuB6EVrR4';

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Attach (or clear) the server-minted staff session token on every REST call.
 * The token is created by the staff_login / staff_switch / owner_activate_staff
 * RPCs after a server-side PIN check; Postgres RLS resolves the operator's
 * role and shop from it. Client-asserted role headers are no longer used —
 * they were spoofable.
 */
export const setSupabaseStaffToken = (token?: string | null) => {
  const headers = (supabase as any).rest?.headers || {};
  if (token) {
    headers['x-staff-token'] = token;
  } else {
    delete headers['x-staff-token'];
  }
  // Clean up legacy spoofable headers if present
  delete headers['x-staff-role'];
  delete headers['x-staff-id'];
};

