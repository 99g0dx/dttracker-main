import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      throw new Error('URL is required');
    }

    // Basic validation
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    console.log(`Resolving URL: ${url}`);

    // 1. Resolve URL (follow redirects)
    let resolvedUrl = url;
    let htmlContent = '';
    let response: Response | null = null;

    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          // Use a standard browser User-Agent to avoid being blocked by TikTok
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
      });
      resolvedUrl = response.url;
      console.log(`Fetch resolved to: ${resolvedUrl}`);

      // Check for meta refresh or JS redirect if URL still looks short
      // TikTok short links often return HTML with a redirect
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        htmlContent = await response.text();
      }
    } catch (err) {
      console.error('Fetch error during resolution:', err);
      // Continue with original URL if fetch fails
    }

    // TikTok specific: Check for canonical in HTML if URL still looks short or generic
    const isTikTok = resolvedUrl.includes('tiktok.com');
    if (isTikTok && (resolvedUrl.includes('/t/') || resolvedUrl.includes('vm.tiktok.com') || resolvedUrl.includes('vt.tiktok.com'))) {
       console.log('Checking HTML for canonical URL...');
       // Try to find canonical url in HTML
       // <link rel="canonical" href="...">
       const canonicalMatch = htmlContent.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/i);
       if (canonicalMatch && canonicalMatch[1]) {
         resolvedUrl = canonicalMatch[1];
         console.log(`Found canonical URL: ${resolvedUrl}`);
       } else {
         // Try og:url
         const ogUrlMatch = htmlContent.match(/<meta[^>]*property="og:url"[^>]*content="([^"]*)"[^>]*>/i);
         if (ogUrlMatch && ogUrlMatch[1]) {
           resolvedUrl = ogUrlMatch[1];
           console.log(`Found og:url: ${resolvedUrl}`);
         } else {
           // Try to find JS redirect (window.location.href = "...")
           const jsRedirectMatch = htmlContent.match(/window\.location\.href\s*=\s*["']([^"']+)["']/i);
           if (jsRedirectMatch && jsRedirectMatch[1]) {
             resolvedUrl = jsRedirectMatch[1].replace(/\\u002F/g, "/"); // Fix escaped slashes if any
             console.log(`Found JS redirect: ${resolvedUrl}`);
           }
         }
       }
    }

    // 2. Detect Platform
    let platform = 'unknown';
    const hostname = new URL(resolvedUrl).hostname;
    if (hostname.includes('tiktok.com')) platform = 'tiktok';
    else if (hostname.includes('instagram.com')) platform = 'instagram';
    else if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) platform = 'youtube';
    else if (hostname.includes('twitter.com') || hostname.includes('x.com')) platform = 'twitter';
    else if (hostname.includes('facebook.com')) platform = 'facebook';

    // 3. Extract Handle and Post ID
    let creatorHandle: string | null = null;
    let postId: string | null = null;

    if (platform === 'tiktok') {
      // Pattern: https://www.tiktok.com/@handle/video/123456
      // Also handle: https://www.tiktok.com/@handle
      const match = resolvedUrl.match(/@([^/?]+)(?:\/video\/(\d+))?/);
      if (match) {
        creatorHandle = match[1];
        if (match[2]) postId = match[2];
      }

      // If no handle found, try oEmbed
      if (!creatorHandle) {
        try {
          console.log('Attempting oEmbed extraction...');
          const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`;
          const oembedRes = await fetch(oembedUrl);
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            if (oembedData.author_unique_id) {
              creatorHandle = oembedData.author_unique_id;
              console.log(`Extracted handle from oEmbed: ${creatorHandle}`);
            }
          }
        } catch (e) {
          console.warn('oEmbed failed', e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        input_url: url,
        resolved_url: resolvedUrl,
        platform,
        creator_handle: creatorHandle,
        post_id: postId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Resolve URL error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});