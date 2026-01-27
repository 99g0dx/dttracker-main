# Fix 403 Error: soundtrack_create_from_link

## Problem
You're getting a 403 Forbidden error when trying to create a sound track. The frontend is calling `soundtrack_create_from_link` but that function doesn't exist.

## Solution

You have a `sound-tracking` function that expects this format:

```typescript
{
  action: "ingest" | "refresh",
  url: string,
  campaignId?: string,
  sound_id?: string  // for refresh action
}
```

But the frontend is calling `soundtrack_create_from_link` with:
```typescript
{
  workspaceId: string,
  url: string
}
```

## Quick Fix Options

### Option 1: Create the Missing Function (Recommended)

Create `supabase/functions/soundtrack_create_from_link/index.ts` that wraps `sound-tracking`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { workspaceId, url } = await req.json();
    
    // Forward to sound-tracking function
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const response = await fetch(`${supabaseUrl}/functions/v1/sound-tracking`, {
      method: "POST",
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "ingest",
        url,
        // campaignId can be added if needed
      }),
    });

    const data = await response.json();
    
    return new Response(JSON.stringify({
      soundTrackId: data.sound?.id,
      ...data
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: response.status,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

Then deploy it:
```bash
supabase functions deploy soundtrack_create_from_link
```

### Option 2: Update Frontend to Use sound-tracking

Update your frontend code to call `sound-tracking` instead:

```typescript
// In your API file
const { data, error } = await supabase.functions.invoke('sound-tracking', {
  body: {
    action: 'ingest',
    url: url.trim(),
    // Remove workspaceId - not needed by sound-tracking
  },
  headers,
});
```

## Current Function Requirements

The `sound-tracking` function needs:
- ✅ `APIFY_API_TOKEN` secret
- ✅ `RAPIDAPI_KEY` secret  
- ✅ `SUPABASE_URL` secret
- ✅ `SUPABASE_SERVICE_ROLE_KEY` secret

Make sure these are all set in Supabase Edge Functions secrets.
