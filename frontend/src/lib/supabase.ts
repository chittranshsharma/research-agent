import { createClient } from '@supabase/supabase-js';

// Fallback to placeholder strings during build time to prevent Next.js static generation failures.
// Actual values must be set in the runtime environment variables (.env.local or Vercel settings).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
