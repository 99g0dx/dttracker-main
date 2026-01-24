/**
 * Create Paystack Plans for DTTracker 4-Tier Billing
 *
 * This script creates 12 Paystack plans:
 * - 6 base plans (Starter/Pro/Agency x Monthly/Yearly)
 * - 6 seat add-on plans (Starter/Pro/Agency x Monthly/Yearly)
 *
 * Run with: npx ts-node scripts/create-paystack-plans.ts
 *
 * Make sure PAYSTACK_SECRET_KEY is set in your environment
 */

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET_KEY) {
  console.error('Error: PAYSTACK_SECRET_KEY environment variable is required');
  process.exit(1);
}

interface PaystackPlan {
  name: string;
  amount: number; // in kobo (smallest currency unit, e.g., cents)
  interval: 'monthly' | 'annually';
  currency: string;
  description?: string;
  plan_code?: string;
}

interface PlanConfig {
  code: string;
  type: 'base' | 'seat';
  name: string;
  amount: number; // in cents
  interval: 'monthly' | 'annually';
  description: string;
}

// USD to NGN conversion rate (1 USD = 1500 NGN)
// Amounts are in kobo (NGN smallest unit, 100 kobo = 1 NGN)
// Formula: USD cents * 15 = NGN kobo (because 1500/100 = 15)
const USD_TO_NGN_RATE = 15;

// Plan configurations based on locked pricing (converted to NGN)
const PLAN_CONFIGS: PlanConfig[] = [
  // Starter Base Plans
  {
    code: 'dtt_starter_base_monthly',
    type: 'base',
    name: 'DTTracker Starter (Monthly)',
    amount: 1900 * USD_TO_NGN_RATE, // $19 = ₦28,500
    interval: 'monthly',
    description: 'DTTracker Starter Plan - Monthly billing',
  },
  {
    code: 'dtt_starter_base_yearly',
    type: 'base',
    name: 'DTTracker Starter (Yearly)',
    amount: 18200 * USD_TO_NGN_RATE, // $182 = ₦273,000
    interval: 'annually',
    description: 'DTTracker Starter Plan - Annual billing (save 20%)',
  },

  // Starter Seat Plans
  {
    code: 'dtt_starter_seat_monthly',
    type: 'seat',
    name: 'DTTracker Starter Extra Seat (Monthly)',
    amount: 10000, // Minimum ₦100 (Paystack requires min 10000 kobo)
    interval: 'monthly',
    description: 'Additional seat for DTTracker Starter - Monthly',
  },
  {
    code: 'dtt_starter_seat_yearly',
    type: 'seat',
    name: 'DTTracker Starter Extra Seat (Yearly)',
    amount: 4800 * USD_TO_NGN_RATE, // $48 = ₦72,000
    interval: 'annually',
    description: 'Additional seat for DTTracker Starter - Annual',
  },

  // Pro Base Plans
  {
    code: 'dtt_pro_base_monthly',
    type: 'base',
    name: 'DTTracker Pro (Monthly)',
    amount: 4900 * USD_TO_NGN_RATE, // $49 = ₦73,500
    interval: 'monthly',
    description: 'DTTracker Pro Plan - Monthly billing',
  },
  {
    code: 'dtt_pro_base_yearly',
    type: 'base',
    name: 'DTTracker Pro (Yearly)',
    amount: 47000 * USD_TO_NGN_RATE, // $470 = ₦705,000
    interval: 'annually',
    description: 'DTTracker Pro Plan - Annual billing (save 20%)',
  },

  // Pro Seat Plans
  {
    code: 'dtt_pro_seat_monthly',
    type: 'seat',
    name: 'DTTracker Pro Extra Seat (Monthly)',
    amount: 900 * USD_TO_NGN_RATE, // $9 = ₦13,500
    interval: 'monthly',
    description: 'Additional seat for DTTracker Pro - Monthly',
  },
  {
    code: 'dtt_pro_seat_yearly',
    type: 'seat',
    name: 'DTTracker Pro Extra Seat (Yearly)',
    amount: 8600 * USD_TO_NGN_RATE, // $86 = ₦129,000
    interval: 'annually',
    description: 'Additional seat for DTTracker Pro - Annual',
  },

  // Agency Base Plans
  {
    code: 'dtt_agency_base_monthly',
    type: 'base',
    name: 'DTTracker Agency (Monthly)',
    amount: 12900 * USD_TO_NGN_RATE, // $129 = ₦193,500
    interval: 'monthly',
    description: 'DTTracker Agency Plan - Monthly billing',
  },
  {
    code: 'dtt_agency_base_yearly',
    type: 'base',
    name: 'DTTracker Agency (Yearly)',
    amount: 123800 * USD_TO_NGN_RATE, // $1238 = ₦1,857,000
    interval: 'annually',
    description: 'DTTracker Agency Plan - Annual billing (save 20%)',
  },

  // Agency Seat Plans
  {
    code: 'dtt_agency_seat_monthly',
    type: 'seat',
    name: 'DTTracker Agency Extra Seat (Monthly)',
    amount: 700 * USD_TO_NGN_RATE, // $7 = ₦10,500
    interval: 'monthly',
    description: 'Additional seat for DTTracker Agency - Monthly',
  },
  {
    code: 'dtt_agency_seat_yearly',
    type: 'seat',
    name: 'DTTracker Agency Extra Seat (Yearly)',
    amount: 6700 * USD_TO_NGN_RATE, // $67 = ₦100,500
    interval: 'annually',
    description: 'Additional seat for DTTracker Agency - Annual',
  },
];

async function createPlan(config: PlanConfig): Promise<{ success: boolean; plan_code?: string; error?: string }> {
  try {
    const response = await fetch('https://api.paystack.co/plan', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: config.name,
        amount: config.amount, // Paystack uses lowest currency unit
        interval: config.interval,
        currency: 'NGN',
        description: config.description,
      }),
    });

    const data = await response.json();

    if (data.status && data.data?.plan_code) {
      return { success: true, plan_code: data.data.plan_code };
    } else {
      return { success: false, error: data.message || 'Unknown error' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

async function listExistingPlans(): Promise<Map<string, string>> {
  const planCodeMap = new Map<string, string>();

  try {
    const response = await fetch('https://api.paystack.co/plan?perPage=100', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (data.status && data.data) {
      for (const plan of data.data) {
        planCodeMap.set(plan.name, plan.plan_code);
      }
    }
  } catch (error) {
    console.error('Error listing plans:', error);
  }

  return planCodeMap;
}

async function main() {
  console.log('🚀 Creating Paystack plans for DTTracker 4-Tier Billing\n');

  // First, check for existing plans
  console.log('📋 Checking for existing plans...\n');
  const existingPlans = await listExistingPlans();

  const results: { config: PlanConfig; plan_code?: string; status: string }[] = [];

  for (const config of PLAN_CONFIGS) {
    // Check if plan already exists
    const existingCode = existingPlans.get(config.name);
    if (existingCode) {
      console.log(`⏭️  Skipping "${config.name}" - already exists (${existingCode})`);
      results.push({ config, plan_code: existingCode, status: 'exists' });
      continue;
    }

    console.log(`Creating plan: ${config.name}...`);
    const result = await createPlan(config);

    if (result.success) {
      console.log(`✅ Created: ${config.name} -> ${result.plan_code}`);
      results.push({ config, plan_code: result.plan_code, status: 'created' });
    } else {
      console.log(`❌ Failed: ${config.name} - ${result.error}`);
      results.push({ config, status: 'failed' });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Generate SQL update statements
  console.log('\n📝 SQL statements to update plan_catalog:\n');
  console.log('-- Run these in Supabase SQL Editor to link Paystack plan codes\n');

  const updateStatements: string[] = [];

  for (const result of results) {
    if (result.plan_code) {
      const tier = result.config.code.includes('starter')
        ? 'starter'
        : result.config.code.includes('pro')
          ? 'pro'
          : 'agency';
      const billingCycle = result.config.code.includes('yearly') ? 'yearly' : 'monthly';
      const column = result.config.type === 'base' ? 'paystack_base_plan_code' : 'paystack_seat_plan_code';

      updateStatements.push(
        `UPDATE plan_catalog SET ${column} = '${result.plan_code}' WHERE tier = '${tier}' AND billing_cycle = '${billingCycle}';`
      );
    }
  }

  console.log(updateStatements.join('\n'));

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Created: ${results.filter((r) => r.status === 'created').length}`);
  console.log(`   Existing: ${results.filter((r) => r.status === 'exists').length}`);
  console.log(`   Failed: ${results.filter((r) => r.status === 'failed').length}`);
  console.log('\n✅ Done! Copy the SQL statements above and run them in Supabase.');
}

main().catch(console.error);
