import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('placeholder') || 
  supabaseUrl.includes('your-project') ||
  supabaseAnonKey.includes('placeholder') ||
  supabaseAnonKey.includes('your-') ||
  supabaseAnonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'; // Default placeholder JWT

if (isPlaceholder) {
  console.error('❌ Supabase environment variables are not configured correctly!');
  console.error('   Current values:', {
    url: supabaseUrl || 'MISSING',
    key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING'
  });
  console.error('   Please update your .env file with valid Supabase credentials from https://app.supabase.com');
  console.error('   Authentication and database features will not work until this is fixed.');
}

// Create client - this will fail on actual API calls if credentials are invalid
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

// Export a helper to check if Supabase is properly configured
export const isSupabaseConfigured = !isPlaceholder;






