
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
