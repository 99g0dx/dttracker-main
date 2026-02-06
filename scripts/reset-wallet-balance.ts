/**
 * Script to reset wallet balance to 0 for testing
 * Run with: npx tsx scripts/reset-wallet-balance.ts [workspace_id]
 * 
 * Make sure to set these environment variables:
 * - SUPABASE_URL (or VITE_SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set them in .env or as environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listWorkspaces() {
  try {
    const { data, error } = await supabase
      .from('workspace_wallets')
      .select('workspace_id, balance, locked_balance, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching wallets:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('ℹ️  No wallets found in database');
      return;
    }

    console.log('\n📋 Available wallets:');
    console.log('─'.repeat(80));
    data.forEach((wallet, index) => {
      console.log(`${index + 1}. Workspace ID: ${wallet.workspace_id}`);
      console.log(`   Balance: ₦${wallet.balance || 0}`);
      console.log(`   Locked: ₦${wallet.locked_balance || 0}`);
      console.log(`   Updated: ${wallet.updated_at || 'Never'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function resetWalletBalance(workspaceId: string) {
  try {
    // First, check if wallet exists
    const { data: existingWallet } = await supabase
      .from('workspace_wallets')
      .select('id, workspace_id, balance, locked_balance')
      .eq('workspace_id', workspaceId)
      .single();

    if (!existingWallet) {
      console.log(`⚠️  Wallet not found for workspace: ${workspaceId}`);
      console.log('   Creating new wallet with balance 0...');
      
      const { error: createError } = await supabase
        .from('workspace_wallets')
        .insert({
          workspace_id: workspaceId,
          balance: 0,
          locked_balance: 0,
          currency: 'NGN',
        });

      if (createError) {
        console.error('❌ Error creating wallet:', createError);
        return;
      }
      console.log('✅ Created new wallet with balance 0');
      return;
    }

    console.log(`\n📊 Current wallet state:`);
    console.log(`   Balance: ₦${existingWallet.balance || 0}`);
    console.log(`   Locked: ₦${existingWallet.locked_balance || 0}`);

    // Reset balance
    const { error } = await supabase
      .from('workspace_wallets')
      .update({
        balance: 0,
        locked_balance: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('❌ Error resetting wallet:', error);
      return;
    }

    // Verify reset
    const { data: updatedWallet } = await supabase
      .from('workspace_wallets')
      .select('id, workspace_id, balance, locked_balance')
      .eq('workspace_id', workspaceId)
      .single();

    console.log('\n✅ Wallet balance reset successfully!');
    console.log(`   New Balance: ₦${updatedWallet?.balance || 0}`);
    console.log(`   New Locked: ₦${updatedWallet?.locked_balance || 0}`);
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Main execution
const workspaceId = process.argv[2];

if (workspaceId) {
  console.log(`\n🔄 Resetting wallet for workspace: ${workspaceId}\n`);
  resetWalletBalance(workspaceId);
} else {
  console.log('\n📋 Listing all wallets...\n');
  listWorkspaces();
  console.log('\n💡 To reset a specific wallet, run:');
  console.log('   npx tsx scripts/reset-wallet-balance.ts YOUR_WORKSPACE_ID\n');
}
