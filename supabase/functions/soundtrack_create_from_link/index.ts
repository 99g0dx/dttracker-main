import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Log immediately to confirm function is being called
  console.log("🔵 soundtrack_create_from_link: FUNCTION HIT", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  console.log("Headers:", {
    authorization: req.headers.get("authorization") ? "present" : "missing",
    apikey: req.headers.get("apikey") ? "present" : "missing",
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[soundtrack_create_from_link] Request received");

  try {
    const requestBody = await req.json();
    const { workspaceId, url } = requestBody;

    // Log full URL details - CRITICAL: Never truncate the actual URL
    const fullUrl = url ? String(url).trim() : '';
    console.log("[soundtrack_create_from_link] Received request:", {
      workspaceId,
      urlLength: fullUrl.length,
      urlPreview: fullUrl.length > 80 ? `${fullUrl.substring(0, 80)}...` : fullUrl,
      fullUrl: fullUrl, // Full URL in logs
    });

    if (!fullUrl) {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase config
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("[soundtrack_create_from_link] Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user (optional - for logging)
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    let userId: string | null = null;
    
    if (authHeader) {
      const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (bearerToken) {
        const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
        });
        const { data: { user } } = await supabaseAuth.auth.getUser();
        userId = user?.id || null;
      }
    }

    // Try to forward to sound-tracking function, but don't fail if it doesn't exist or returns error
    console.log("[soundtrack_create_from_link] Attempting to forward to sound-tracking function");
    
    let soundId: string | null = null;
    let soundData: any = null;
    
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/sound-tracking`, {
        method: "POST",
        headers: {
          "Authorization": authHeader || `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "ingest",
          url: fullUrl, // Use full URL, never truncate
        }),
      });

      // Safe JSON parsing - Apify might return non-JSON
      let data: any;
      const responseText = await response.text();
      console.log("[soundtrack_create_from_link] Response from sound-tracking:", {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get("content-type"),
        bodyPreview: responseText.substring(0, 500),
      });

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[soundtrack_create_from_link] Failed to parse JSON response:", parseError);
        throw new Error(`Invalid JSON response from sound-tracking: ${responseText.substring(0, 200)}`);
      }

      console.log("[soundtrack_create_from_link] Parsed response:", { 
        hasSound: !!data.sound,
        soundId: data.sound?.id,
        error: data.error,
        success: data.success,
      });

      if (response.ok && data.sound?.id) {
        soundId = data.sound.id;
        soundData = data;
      } else {
        console.warn("[soundtrack_create_from_link] sound-tracking returned error, will create directly:", data.error || data.message);
        // Continue to create sound directly
      }
    } catch (forwardError) {
      console.warn("[soundtrack_create_from_link] Failed to forward to sound-tracking, will create directly:", forwardError);
      // Continue to create sound directly
    }

    // If sound-tracking didn't work, create sound directly in sounds table
    if (!soundId) {
      console.log("[soundtrack_create_from_link] Creating sound directly in sounds table");
      
      // Detect platform using FULL URL
      let platform: 'tiktok' | 'instagram' | 'youtube' = 'tiktok';
      if (fullUrl.includes('instagram.com')) platform = 'instagram';
      else if (fullUrl.includes('youtube.com') || fullUrl.includes('youtu.be')) platform = 'youtube';

      // Extract sound ID and metadata from URL (using FULL URL)
      let canonicalKey = '';
      let extractedTitle: string | null = null;
      let extractedArtist: string | null = null;
      
      if (platform === 'tiktok') {
        // Match patterns like: /music/Everyday-7595744832015730704 or /music/7595744832015730704
        // Also try to extract title from URL: /music/Title-Name-7595744832015730704
        const titleMatch = fullUrl.match(/music\/([^-]+(?:-[^-]+)*)-(\d+)/);
        const idMatch = fullUrl.match(/music\/(\d+)/);
        
        if (titleMatch) {
          // Extract title from URL (everything before the last dash and number)
          const titlePart = titleMatch[1];
          canonicalKey = titleMatch[2];
          // Title is usually in format "Title-Name" - replace dashes with spaces and capitalize
          extractedTitle = titlePart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          console.log("[soundtrack_create_from_link] Extracted title from URL:", extractedTitle);
        } else if (idMatch) {
          canonicalKey = idMatch[1];
        }
        
        console.log("[soundtrack_create_from_link] Extracted canonical key:", canonicalKey, "from URL:", fullUrl);
      }

      // Check if sound already exists (unique constraint on platform + canonical_sound_key)
      const canonicalSoundKey = canonicalKey || fullUrl;
      let existingSound: any = null;
      
      // Try to find existing sound first
      const { data: foundSound, error: findError } = await supabase
        .from('sounds')
        .select('*')
        .eq('platform', platform)
        .eq('canonical_sound_key', canonicalSoundKey)
        .maybeSingle();

      if (!findError && foundSound) {
        existingSound = foundSound;
        console.log("[soundtrack_create_from_link] Found existing sound:", existingSound.id);
      }

      let newSound: any = null;
      let soundError: any = null;

      // Only insert if sound doesn't exist
      if (!existingSound) {
        console.log("[soundtrack_create_from_link] Creating new sound in sounds table");
        
        // Create sound in sounds table (this is what sound-tracking uses)
        let soundInsertData: any = {
          platform,
          canonical_sound_key: canonicalSoundKey,
          title: extractedTitle, // Use extracted title if available
          artist: extractedArtist, // Will be updated by webhook when scraping completes
          sound_page_url: fullUrl, // Use full URL
          last_crawled_at: new Date().toISOString(),
          indexing_state: 'indexing',
        };

        // Try to insert with user_id first (newer schema)
        const { data: insertedSound, error: insertError } = await supabase
          .from('sounds')
          .insert({
            ...soundInsertData,
            user_id: userId || workspaceId,
          })
          .select()
          .single();

        // If that fails with "column not found" or "schema cache", try without user_id (older schema)
        const isColumnError = insertError && (
          insertError.message?.includes("user_id") ||
          insertError.message?.includes("schema cache") ||
          insertError.message?.toLowerCase().includes("column") ||
          insertError.code === '42703' // PostgreSQL error code for undefined column
        );

        if (isColumnError) {
          console.log("[soundtrack_create_from_link] user_id column not found (schema cache issue), trying without it");
          const { data: insertedSound2, error: insertError2 } = await supabase
            .from('sounds')
            .insert(soundInsertData)
            .select()
            .single();
          
          if (insertError2) {
            soundError = insertError2;
          } else {
            newSound = insertedSound2;
            soundError = null;
          }
        } else if (insertError) {
          // Check if it's a duplicate key error
          if (insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint') || insertError.code === '23505') {
            console.log("[soundtrack_create_from_link] Duplicate sound detected, fetching existing sound");
            // Try to fetch the existing sound
            const { data: duplicateSound } = await supabase
              .from('sounds')
              .select('*')
              .eq('platform', platform)
              .eq('canonical_sound_key', canonicalSoundKey)
              .single();
            
            if (duplicateSound) {
              existingSound = duplicateSound;
              soundError = null;
            } else {
              soundError = insertError;
            }
          } else {
            soundError = insertError;
          }
        } else {
          newSound = insertedSound;
        }
      }

      // Use existing sound if found, otherwise use newly created one
      const finalSound = existingSound || newSound;

      if (soundError && !existingSound) {
        console.error("[soundtrack_create_from_link] Error creating sound:", soundError);
        
        // If sounds table doesn't exist, return a helpful error
        if (soundError.message?.includes('does not exist') || soundError.message?.includes('relation') || soundError.code === '42P01') {
          console.log("[soundtrack_create_from_link] sounds table doesn't exist");
          return new Response(
            JSON.stringify({
              error: "Sounds table not found. Please run the migration in Supabase SQL Editor: database/migrations/038_create_sounds_tables.sql",
              soundTrackId: null,
              fix: "Run the SQL migration to create the sounds table with the correct schema.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
        
        // If it's a column/schema cache issue, return helpful error with fix instructions
        if (soundError.message?.includes('column') || soundError.message?.includes('schema cache')) {
          return new Response(
            JSON.stringify({
              error: "The sounds table is missing the 'user_id' column. Please run the database fix script.",
              soundTrackId: null,
              fix: "Run this SQL in Supabase SQL Editor: database/fix_sounds_table.sql (or run the full migration: database/migrations/038_create_sounds_tables.sql)",
              details: soundError.message,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
        return new Response(
          JSON.stringify({ error: `Failed to create sound: ${soundError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!finalSound || !finalSound.id) {

      if (!finalSound || !finalSound.id) {
        return new Response(
          JSON.stringify({ error: "Failed to create or find sound: No ID returned" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      soundId = finalSound.id;
      soundData = { sound: finalSound };
      if (existingSound) {
        console.log("[soundtrack_create_from_link] Using existing sound:", soundId);
      } else {
        console.log("[soundtrack_create_from_link] Created sound directly:", soundId);
      }
    }

    // Use sound ID from either sound-tracking response or direct creation
    let finalSoundId = soundId || soundData?.sound?.id;
    
    // Try to map to sound_tracks table (non-blocking - if it fails, use sound ID directly)
    if (finalSoundId && workspaceId) {
      try {
        // Check if sound_tracks table exists by trying to query it
        // Check for existing track by URL first, then by sound_platform_id
        let existingTrack: any = null;
        const { data: trackByUrl } = await supabase
          .from('sound_tracks')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('source_url', fullUrl)
          .maybeSingle();
        
        if (trackByUrl) {
          existingTrack = trackByUrl;
        } else if (canonicalKey) {
          // Also check by sound_platform_id to catch duplicates
          const { data: trackByPlatformId } = await supabase
            .from('sound_tracks')
            .select('id')
            .eq('workspace_id', workspaceId)
            .eq('sound_platform_id', canonicalKey)
            .maybeSingle();
          
          if (trackByPlatformId) {
            existingTrack = trackByPlatformId;
          }
        }
        
        const checkError = null; // We handle errors below

        // If table doesn't exist, just return the sound ID from sounds table
        // (We check for table existence by trying the query - if it fails, we'll catch it)
        if (existingTrack) {
          console.log("[soundtrack_create_from_link] Found existing sound_track:", existingTrack.id);
          finalSoundId = existingTrack.id;
        } else {
          // Table exists but no existing track - create new one
          // Get sound data for mapping
          const soundDataForMapping = soundData?.sound || finalSound;
          
          console.log("[soundtrack_create_from_link] Creating new sound_track entry", {
            workspaceId,
            platform: soundDataForMapping?.platform || platform,
            soundId: finalSoundId,
          });
          
          const { data: newTrack, error: trackError } = await supabase
            .from('sound_tracks')
            .insert({
              workspace_id: workspaceId,
              platform: soundDataForMapping?.platform || platform,
              sound_platform_id: soundDataForMapping?.canonical_sound_key || canonicalKey || finalSoundId,
              source_url: fullUrl, // Use full URL
              title: soundDataForMapping?.title || extractedTitle || null, // Use extracted title if available
              artist: soundDataForMapping?.artist || extractedArtist || null, // Use extracted artist if available
              created_by: userId || workspaceId,
            })
            .select()
            .single();

          if (trackError) {
            // If duplicate, try to find existing track
            if (trackError.message?.includes('duplicate') || trackError.message?.includes('unique') || trackError.code === '23505') {
              console.log("[soundtrack_create_from_link] Duplicate sound_track detected, fetching existing");
              const { data: duplicateTrack } = await supabase
                .from('sound_tracks')
                .select('id')
                .eq('workspace_id', workspaceId)
                .eq('source_url', fullUrl)
                .maybeSingle();
              
              if (duplicateTrack) {
                finalSoundId = duplicateTrack.id;
                console.log("[soundtrack_create_from_link] Using existing sound_track:", finalSoundId);
              } else {
                console.error("[soundtrack_create_from_link] Error creating sound_track:", trackError);
              }
            } else {
              console.error("[soundtrack_create_from_link] Error creating sound_track:", trackError);
              // Continue - use sound ID instead
            }
          } else if (newTrack) {
            console.log("[soundtrack_create_from_link] ✅ Created sound_track:", newTrack.id);
            // Use newTrack.id as the final soundTrackId
            finalSoundId = newTrack.id;
          }
        }
      } catch (mapError) {
        console.error("[soundtrack_create_from_link] Error mapping to sound_tracks:", mapError);
        // Continue and return original response with sound ID
      }
    }

    // Automatically start scraping after sound is created (non-blocking)
    let scrapeJobId: string | null = null;
    if (finalSoundId && workspaceId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SB_URL") ?? "";
        console.log("[soundtrack_create_from_link] Attempting to start scrape job", {
          soundTrackId: finalSoundId,
          workspaceId,
          soundUrl: fullUrl.substring(0, 100), // Preview only
          scrapeFunctionUrl: `${supabaseUrl}/functions/v1/soundtrack_start_scrape`,
        });
        
        const scrapeResponse = await fetch(`${supabaseUrl}/functions/v1/soundtrack_start_scrape`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "apikey": supabaseServiceKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            soundTrackId: finalSoundId,
            workspaceId,
            soundUrl: fullUrl, // Use full URL
            maxItems: 200, // Default to 200 videos for MVP
          }),
        });

        const responseText = await scrapeResponse.text();
        console.log("[soundtrack_create_from_link] Scrape response:", {
          status: scrapeResponse.status,
          statusText: scrapeResponse.statusText,
          bodyPreview: responseText.substring(0, 500),
        });

        if (scrapeResponse.ok) {
          try {
            const scrapeData = JSON.parse(responseText);
            scrapeJobId = scrapeData.jobId;
            console.log("[soundtrack_create_from_link] ✅ Scrape job started successfully:", scrapeJobId);
          } catch (parseError) {
            console.error("[soundtrack_create_from_link] Failed to parse scrape response:", parseError);
            console.warn("[soundtrack_create_from_link] Response was OK but couldn't parse JSON, continuing anyway");
          }
        } else {
          console.error("[soundtrack_create_from_link] ❌ Failed to start scrape job:", {
            status: scrapeResponse.status,
            statusText: scrapeResponse.statusText,
            body: responseText.substring(0, 500),
          });
          // Don't fail the whole request if scraping fails - user can manually trigger later
        }
      } catch (scrapeError) {
        console.error("[soundtrack_create_from_link] ❌ Error starting scrape:", {
          error: scrapeError instanceof Error ? scrapeError.message : String(scrapeError),
          stack: scrapeError instanceof Error ? scrapeError.stack : undefined,
        });
        // Don't fail the whole request if scraping fails - user can manually trigger later
      }
    } else {
      console.warn("[soundtrack_create_from_link] Skipping scrape job - missing requirements:", {
        hasSoundId: !!finalSoundId,
        hasWorkspaceId: !!workspaceId,
      });
    }

    // Return in the format expected by the frontend (always return sound ID)
    if (!finalSoundId) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to create sound track. Please check logs for details.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[soundtrack_create_from_link] Returning success with soundTrackId:", finalSoundId, {
      fromSoundTracks: finalSoundId !== (soundId || soundData?.sound?.id),
      originalSoundId: soundId || soundData?.sound?.id,
    });

    return new Response(
      JSON.stringify({
        soundTrackId: finalSoundId, // Always return a sound ID (from sound_tracks if exists, otherwise sounds)
        scrapeJobId, // Include scrape job ID if started
        source: soundData?.sound ? 'sound-tracking' : 'direct-creation',
        ...soundData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[soundtrack_create_from_link] CRASH:", error);
    console.error("[soundtrack_create_from_link] Error stack:", error instanceof Error ? error.stack : 'No stack');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error",
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
