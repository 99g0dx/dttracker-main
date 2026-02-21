import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { IncomingMessage } from 'http';

/**
 * Proxy webhook requests from dttracker.app to Supabase Edge Function.
 * Body parsing is disabled so we can forward the exact raw bytes that
 * Paystack signed — re-stringifying a parsed body breaks HMAC verification.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (webhooks)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ucbueapoexnxhttynfzy.supabase.co';
  const webhookUrl = `${SUPABASE_URL}/functions/v1/paystack-webhook`;

  try {
    // Read the raw body bytes — body parser is disabled so this is the original bytes
    // that Paystack HMAC-signed. Do NOT parse and re-stringify, as that would break
    // signature verification in the Supabase Edge Function.
    const rawBody = await readRawBody(req);

    // Forward the request to Supabase Edge Function with the original signature header
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
