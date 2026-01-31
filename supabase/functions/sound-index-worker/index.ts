import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function calculateGeoStats(regions: string[]) {
  if (!regions.length) return []
  const counts: Record<string, number> = {}
  regions.forEach(r => counts[r] = (counts[r] || 0) + 1)
  const total = regions.length

  const names: Record<string, string> = {
    'US': 'United States', 'BR': 'Brazil', 'GB': 'United Kingdom', 'UK': 'United Kingdom',
    'CA': 'Canada', 'AU': 'Australia', 'DE': 'Germany', 'FR': 'France',
    'ES': 'Spain', 'IT': 'Italy', 'IN': 'India', 'JP': 'Japan',
    'KR': 'South Korea', 'MX': 'Mexico', 'ID': 'Indonesia', 'VN': 'Vietnam',
    'PH': 'Philippines', 'TH': 'Thailand', 'RU': 'Russia', 'TR': 'Turkey'
  }

  return Object.entries(counts)
    .map(([code, count]) => ({
      country: names[code.toUpperCase()] || code.toUpperCase(),
      percent: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 5)
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res
      }
      if (i === retries - 1) return res
    } catch (err) {
      if (i === retries - 1) throw err
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
  }
  throw new Error('Fetch failed')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')
    if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY secret is not set')

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')
    if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN secret is not set')

    // 1. Get next pending job(s) from queue (process up to 5 in parallel)
    const { data: jobs, error: fetchError } = await supabase
      .from('sound_refresh_queue')
      .select('id, sound_id, action, priority')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5)

    if (fetchError) throw fetchError

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending jobs', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${jobs.length} pending sound indexing jobs...`)

    // 2. Process jobs in parallel
    const results = await Promise.allSettled(
      jobs.map(job => processJob(supabase, job, RAPIDAPI_KEY, APIFY_API_TOKEN))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${succeeded} jobs successfully, ${failed} failed`,
        processed: succeeded,
        failed: failed,
        total: jobs.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Worker error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function processJob(
  supabase: any,
  job: any,
  RAPIDAPI_KEY: string,
  APIFY_API_TOKEN: string
) {
  const { id: queueId, sound_id: soundId } = job

  try {
    // 1. Mark job as processing
    await supabase
      .from('sound_refresh_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', queueId)

    // 2. Fetch sound metadata
    const { data: sound, error: soundError } = await supabase
      .from('sounds')
      .select('*')
      .eq('id', soundId)
      .single()

    if (soundError || !sound) throw new Error('Sound not found')

    const platform = sound.platform
    const canonicalKey = sound.canonical_sound_key
    let videosToIndex: any[] = []
    let regions: string[] = []

    // 3. Scrape videos based on platform
    if (platform === 'tiktok') {
      const apifyUrl = `https://api.apify.com/v2/acts/clockworks~tiktok-sound-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`

      const runInput = {
        "musics": [{ "id": canonicalKey }],
        "maxItems": 100,  // Increased from 30
        "proxyConfiguration": { "useApifyProxy": true }
      }

      const res = await fetchWithRetry(apifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runInput)
      })

      if (!res.ok) {
        throw new Error(`Apify API failed: ${res.status}`)
      }

      const videos = await res.json()

      // Extract regions
      regions = videos
        .map((v: any) => v.authorMeta?.region || v.author?.region || v.region)
        .filter((r: any) => typeof r === 'string' && r.length === 2)

      videosToIndex = videos.map((v: any) => {
        const author = v.authorMeta || v.author || {}
        const stats = {
          playCount: v.playCount || v.stats?.playCount || 0,
          diggCount: v.diggCount || v.stats?.diggCount || 0
        }
        const videoId = v.id || v.video_id
        const uniqueId = author.name || author.uniqueId || author.unique_id

        return {
          sound_id: soundId,
          platform: 'tiktok',
          video_id: videoId,
          video_url: v.webVideoUrl || `https://www.tiktok.com/@${uniqueId}/video/${videoId}`,
          creator_handle: uniqueId,
          views: stats.playCount,
          likes: stats.diggCount,
          posted_at: v.createTime ? new Date(v.createTime * 1000).toISOString() : null,
          bucket: 'top'
        }
      })
    } else if (platform === 'instagram') {
      // Use Promise.all() for parallel API calls (OPTIMIZATION)
      const [res1, res2] = await Promise.all([
        fetchWithRetry(`https://instagram-scraper-stable.p.rapidapi.com/audio/reels?audio_id=${canonicalKey}`, {
          headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'instagram-scraper-stable.p.rapidapi.com' }
        }),
        fetchWithRetry(`https://instagram-scraper-stable.p.rapidapi.com/music/clips?id=${canonicalKey}`, {
          headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'instagram-scraper-stable.p.rapidapi.com' }
        })
      ])

      let clips: any[] = []
      if (res1.ok) {
        const data = await res1.json()
        clips = data.items || data.data?.items || data.reels || []
      } else if (res2.ok) {
        const data = await res2.json()
        clips = data.items || data.data?.items || data.reels || []
      } else {
        throw new Error('Instagram API failed')
      }

      videosToIndex = clips.map((c: any) => ({
        sound_id: soundId,
        platform: 'instagram',
        video_id: c.code || c.pk,
        video_url: `https://www.instagram.com/reel/${c.code}/`,
        creator_handle: c.user?.username || c.owner?.username,
        views: c.view_count || c.play_count,
        likes: c.like_count,
        posted_at: c.taken_at ? new Date(c.taken_at * 1000).toISOString() : null,
        bucket: 'top'
      }))
    }

    // 4. Bulk insert videos
    if (videosToIndex.length > 0) {
      const { error: videoError } = await supabase
        .from('sound_videos')
        .upsert(videosToIndex, { onConflict: 'sound_id, video_id' })

      if (videoError) {
        console.warn('Video insert warning:', videoError)
      }
    }

    // 5. Update sound with geo stats and mark as active
    const geoStats = calculateGeoStats(regions)
    await supabase.from('sounds').update({
      indexing_state: 'active',
      geo_estimated: geoStats,
      last_crawled_at: new Date().toISOString()
    }).eq('id', soundId)

    // 6. Mark queue job as completed
    await supabase
      .from('sound_refresh_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', queueId)

    console.log(`Indexed ${videosToIndex.length} videos for sound ${soundId}`)
    return { soundId, videosIndexed: videosToIndex.length }

  } catch (error) {
    console.error(`Job ${queueId} failed:`, error.message)

    // Mark as failed and increment attempt count
    const { data: existing } = await supabase
      .from('sound_refresh_queue')
      .select('attempt_count, max_attempts')
      .eq('id', queueId)
      .single()

    const attemptCount = (existing?.attempt_count || 0) + 1
    const maxAttempts = existing?.max_attempts || 3

    if (attemptCount < maxAttempts) {
      // Schedule retry in 1 hour
      const nextRetry = new Date()
      nextRetry.setHours(nextRetry.getHours() + 1)

      await supabase
        .from('sound_refresh_queue')
        .update({
          status: 'failed',
          attempt_count: attemptCount,
          next_retry_at: nextRetry.toISOString(),
          error_message: error.message
        })
        .eq('id', queueId)
    } else {
      // Max attempts reached
      await supabase
        .from('sound_refresh_queue')
        .update({
          status: 'failed',
          attempt_count: attemptCount,
          error_message: `Max attempts (${maxAttempts}) reached: ${error.message}`
        })
        .eq('id', queueId)

      // Mark sound as failed
      await supabase.from('sounds')
        .update({ indexing_state: 'failed' })
        .eq('id', soundId)
    }

    throw error
  }
}
