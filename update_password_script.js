import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ucbueapoexnxhttynfzy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updatePassword() {
  const { data, error } = await supabase.auth.admin.updateUserById(
    // First get user ID
    '...',
    { password: 'sharable2025' }
  );
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Password updated successfully!');
  }
}
