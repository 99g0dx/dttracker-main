import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Proxy webhook requests from dttracker.app to Supabase Edge Function
 * This allows using a custom domain for the Paystack webhook URL
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (webhooks)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ucbueapoexnxhttynfzy.supabase.co';
  const webhookUrl = `${SUPABASE_URL}/functions/v1/paystack-webhook`;

  try {
    // Get the raw body for signature verification
    const rawBody = JSON.stringify(req.body);

    // Forward the request to Supabase Edge Function
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the Paystack signature header for verification
        'x-paystack-signature': req.headers['x-paystack-signature'] as string || '',
      },
      body: rawBody,
    });

    const data = await response.text();

    // Return the same status code as the Edge Function
    return res.status(response.status).send(data);
  } catch (error) {
    console.error('Webhook proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
