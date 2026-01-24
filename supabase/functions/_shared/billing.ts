import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

export function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceKey);
}

export function getSupabaseAuthClient(authHeader: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(supabaseUrl, anonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
  });
}

export function getPaystackSecret() {
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!secret) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }
  return secret;
}

export function getPaystackWebhookSecret() {
  return Deno.env.get("PAYSTACK_WEBHOOK_SECRET") || getPaystackSecret();
}

export function getBillingCurrency() {
  return Deno.env.get("BILLING_CURRENCY") || "USD";
}

export function getPaystackCurrency() {
  return Deno.env.get("PAYSTACK_CURRENCY") || getBillingCurrency();
}

export function getCurrencyConversionRate() {
  const rate = Deno.env.get("PAYSTACK_CURRENCY_RATE");
  return rate ? Number(rate) : null;
}

export function resolveAmountInMinorUnits(amountCents: number) {
  const billingCurrency = getBillingCurrency();
  const paystackCurrency = getPaystackCurrency();

  if (billingCurrency === paystackCurrency) {
    return { amount: amountCents, currency: billingCurrency };
  }

  const rate = getCurrencyConversionRate();
  if (!rate || Number.isNaN(rate) || rate <= 0) {
    throw new Error(
      `Currency conversion rate required for ${billingCurrency} -> ${paystackCurrency}. Set PAYSTACK_CURRENCY_RATE.`
    );
  }

  const converted = Math.round((amountCents / 100) * rate * 100);
  return { amount: converted, currency: paystackCurrency };
}

export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null
) {
  const secret = getPaystackWebhookSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody)
  );
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return signature === expected;
}

export async function paystackRequest(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>
) {
  const secret = getPaystackSecret();
  const response = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new Error(data.message || "Paystack request failed");
  }
  return data;
}

export function toInt(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}
