
import { createClient } from '@supabase/supabase-js';

// Provided Credentials
const supabaseUrl = 'https://mnffqzcgcwqgpguigkzt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uZmZxemNnY3dxZ3BndWlna3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTQ0MTcsImV4cCI6MjA4MTA3MDQxN30.JQwLXczs6L7SP_XrddONNdYPjm5TwpJ918xuB6EVrR4';

export const supabase = createClient(supabaseUrl, supabaseKey);
