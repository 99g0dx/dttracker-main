#!/usr/bin/env node

/**
 * Manually sync an activation from DTTracker to Dobbletap
 * Usage: node manual-sync-activation.js <activation-id>
 */

const ACTIVATION_ID = process.argv[2] || 'be6502a1-9161-4eee-9f5c-9f422517df1e';
const DTTRACKER_URL = 'https://ucbueapoexnxhttynfzy.supabase.co';
const DTTRACKER_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjYnVlYXBvZXhueGh0dHluZnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg0MzY5MiwiZXhwIjoyMDgyNDE5NjkyfQ.mhCinNZXETF2Ql0tPnoqdi4l9H-jlQRn23_b3yiF7ag';
const DOBBLETAP_BASE = 'https://qetwrowpllnkucyxoojp.supabase.co/functions/v1/make-server-8061e72e';
const SYNC_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFldHdyb3dwbGxua3VjeXhvb2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MzA4MDEsImV4cCI6MjA4NDEwNjgwMX0.kQceGyBrsZr5OCo8zD0Xs4VvLNKH7YaDAdU9M7wmh9c';

async function main() {
  console.log('🔄 Syncing Activation to Dobbletap');
  console.log('===================================');
  console.log(`Activation ID: ${ACTIVATION_ID}\n`);

  // Step 1: Fetch activation from DTTracker
  console.log('Step 1: Fetching activation from DTTracker...');
  const activationResponse = await fetch(
    `${DTTRACKER_URL}/rest/v1/activations?id=eq.${ACTIVATION_ID}&select=*`,
    {
      headers: {
        'apikey': DTTRACKER_SERVICE_KEY,
        'Authorization': `Bearer ${DTTRACKER_SERVICE_KEY}`,
      },
    }
  );

  if (!activationResponse.ok) {
    console.error('❌ Failed to fetch activation:', activationResponse.statusText);
    process.exit(1);
  }

  const activations = await activationResponse.json();
  if (!activations || activations.length === 0) {
    console.error('❌ Activation not found in DTTracker');
    process.exit(1);
  }

  const activation = activations[0];
  console.log(`✅ Found activation: ${activation.title}`);
  console.log(`   Type: ${activation.type}`);
  console.log(`   Status: ${activation.status}`);
  console.log(`   Budget: ₦${activation.total_budget.toLocaleString()}\n`);

  // Step 2: Prepare sync payload
  console.log('Step 2: Preparing sync payload...');
  const syncPayload = {
    eventType: 'campaign_created',
    timestamp: new Date().toISOString(),
    data: {
      activation_id: activation.id,
      dttracker_workspace_id: activation.workspace_id,
      type: activation.type,
      title: activation.title,
      brief: activation.brief,
      deadline: activation.deadline,
      total_budget: activation.total_budget,
      prize_structure: activation.prize_structure || {},
      winner_count: activation.winner_count || 20,
      max_posts_per_creator: activation.max_posts_per_creator || 5,
      scoring_method: activation.type === 'contest' ? 'cumulative' : null,
      performance_weights: activation.type === 'contest' ? { views: 1, likes: 2, comments: 3 } : null,
      task_type: activation.task_type,
      target_url: activation.target_url,
      payment_per_action: activation.payment_per_action,
      base_rate: activation.base_rate,
      required_comment_text: activation.required_comment_text,
      comment_guidelines: activation.comment_guidelines,
      max_participants: activation.max_participants,
      platforms: activation.platforms || [],
      requirements: activation.requirements || {},
      instructions: activation.instructions,
    },
  };

  console.log('✅ Payload prepared\n');

  // Step 3: Sync to Dobbletap
  console.log('Step 3: Syncing to Dobbletap...');
  const syncResponse = await fetch(`${DOBBLETAP_BASE}/webhooks/dttracker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SYNC_API_KEY}`,
    },
    body: JSON.stringify(syncPayload),
  });

  const syncBody = await syncResponse.json();

  console.log(`📡 Response: HTTP ${syncResponse.status}`);
  console.log(JSON.stringify(syncBody, null, 2));
  console.log('');

  if (syncResponse.ok) {
    console.log('🎉 SUCCESS - Activation synced to Dobbletap!');
    if (syncBody.id || syncBody.campaign_id) {
      console.log(`   Dobbletap Campaign ID: ${syncBody.id || syncBody.campaign_id}`);
    }
    console.log('');
    console.log('✅ You can now send offers to creators for this activation!');
  } else {
    console.error('❌ FAILED - Sync error:', syncBody.error || syncBody.message);
    process.exit(1);
  }
}

main().catch(console.error);
