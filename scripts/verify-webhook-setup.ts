/**
 * Verify Paystack webhook setup and configuration
 * Run with: npx tsx scripts/verify-webhook-setup.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const appUrl = process.env.VITE_APP_URL || process.env.APP_URL;

console.log('\n🔍 Verifying Paystack Webhook Setup\n');
console.log('─'.repeat(80));

// Check environment variables
console.log('\n1️⃣  Environment Variables:');
console.log('─'.repeat(80));

const checks = [
  {
    name: 'SUPABASE_URL',
    value: supabaseUrl,
    required: true,
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    value: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : null,
    required: true,
  },
  {
    name: 'PAYSTACK_SECRET_KEY',
    value: paystackSecretKey ? `${paystackSecretKey.substring(0, 20)}...` : null,
    required: true,
  },
  {
    name: 'VITE_APP_URL / APP_URL',
    value: appUrl || 'Not set',
    required: false,
  },
];

let envErrors = 0;
checks.forEach((check) => {
  const status = check.value && check.value !== 'Not set' ? '✅' : check.required ? '❌' : '⚠️ ';
  console.log(`   ${status} ${check.name}: ${check.value || 'MISSING'}`);
  if (check.required && !check.value) {
    envErrors++;
  }
});

// Check database tables
console.log('\n2️⃣  Database Tables:');
console.log('─'.repeat(80));

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('   ⚠️  Skipping database checks (missing credentials)');
} else {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const tables = [
    'workspace_wallets',
    'wallet_transactions',
    'paystack_events',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error && error.code === 'PGRST116') {
        console.log(`   ✅ ${table}: Table exists (empty)`);
      } else if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: Table exists`);
      }
    } catch (err: any) {
      console.log(`   ❌ ${table}: ${err.message || 'Error checking table'}`);
    }
  }
}

// Webhook URL
console.log('\n3️⃣  Webhook Configuration:');
console.log('─'.repeat(80));

if (appUrl) {
  const webhookUrl = `${appUrl}/api/payments/paystack-webhook`;
  console.log(`   📍 Webhook URL: ${webhookUrl}`);
  console.log(`   ⚠️  Make sure this URL is configured in Paystack Dashboard:`);
  console.log(`      Settings → API Keys & Webhooks → Webhooks`);
} else {
  console.log(`   ⚠️  APP_URL not set - cannot determine webhook URL`);
  console.log(`   💡 Set VITE_APP_URL or APP_URL to your production domain`);
}

// Summary
console.log('\n' + '─'.repeat(80));
console.log('\n📋 Summary:');

if (envErrors === 0) {
  console.log('   ✅ All required environment variables are set');
} else {
  console.log(`   ❌ ${envErrors} required environment variable(s) missing`);
  console.log('   💡 Check your .env file or Vercel environment variables');
}

console.log('\n📝 Next Steps:');
console.log('   1. Ensure webhook URL is configured in Paystack Dashboard');
console.log('   2. Test webhook using Paystack\'s test webhook feature');
console.log('   3. Check Vercel function logs after a test payment');
console.log('   4. Verify wallet balance updates in your app\n');
