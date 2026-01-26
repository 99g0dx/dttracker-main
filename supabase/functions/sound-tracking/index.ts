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

  // Initialize client outside try block so it's available in catch
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  let soundId: string | null = null
  let userId: string | null = null

  try {
    // Unified Ingest Endpoint
    // Body: { action: 'ingest' | 'refresh', url: string, campaignId?: string }
    const { action = 'ingest', url, campaignId, sound_id } = await req.json()
    
    const authHeader =
      req.headers.get('Authorization') ||
      req.headers.get('authorization') ||
      ''
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!bearerToken) throw new Error('Missing authorization token')

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(bearerToken)

    if (userError) throw userError
    if (!user) throw new Error('Unable to identify authenticated user')
    userId = user.id

    if (!url && !sound_id) throw new Error('URL or sound_id is required')
    const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY')
    if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY secret is not set')

    const APIFY_API_TOKEN = Deno.env.get('APIFY_API_TOKEN')
    if (!APIFY_API_TOKEN) throw new Error('APIFY_API_TOKEN secret is not set')

    // Debug collector
    const debug: any = { steps: [] }
    const log = (step: string, data: any) => debug.steps.push({ step, data })

    // 1. Identify Platform & Resolve Sound
    let platform: 'tiktok' | 'instagram' | 'youtube' | null = null
    soundId = sound_id
    let soundMeta = {
      canonical_key: '',
      title: '',
      artist: '',
      sound_page_url: ''
    }

    if (soundId) {
      const { data: s, error } = await supabase.from('sounds').select('*').eq('id', soundId).single()
      if (error || !s) throw new Error('Sound not found')
      if (s.user_id !== userId) throw new Error('Sound not found')
      platform = s.platform as any
      soundMeta.canonical_key = s.canonical_sound_key
      soundMeta.title = s.title
      soundMeta.artist = s.artist
      soundMeta.sound_page_url = s.sound_page_url
      
      await supabase.from('sounds').update({ indexing_state: 'indexing' }).eq('id', soundId)
    } else {
      if (url.includes('tiktok.com')) platform = 'tiktok'
      else if (url.includes('instagram.com')) platform = 'instagram'
      else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube'
      
      if (!platform) throw new Error('Unsupported platform')

      // --- TIKTOK RESOLUTION ---
      if (platform === 'tiktok') {
      // Strategy: If video URL, fetch video info to get music_id. If music URL, extract ID.
      let musicId = ''
      
      if (url.includes('/video/') || url.includes('/v/')) {
        const videoId = url.match(/video\/(\d+)/)?.[1] || url.match(/\/v\/(\d+)/)?.[1]
        log('Extracted Video ID', videoId)
        
        if (videoId) {
          const apiUrl = `https://tiktok-data-api.p.rapidapi.com/video/info?video_id=${videoId}`
          const res = await fetchWithRetry(apiUrl, {
            headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'tiktok-data-api.p.rapidapi.com' }
          })
          
          if (!res.ok) {
             const errText = await res.text()
             log('API Error Video Info', { status: res.status, body: errText })
          } else {
            const data = await res.json()
            log('API Response Video Info', data)
            
            // Try different response structures (TikApi vs others)
            const item = data.aweme_detail || data.itemInfo?.itemStruct || data.data || data
            const music = item.music || item.music_info || data.music || data.music_info

            if (music) {
                musicId = music.id || music.mid || music.id_str
                soundMeta.title = music.title || music.musicName || music.song_name
                soundMeta.artist = music.author || music.authorName || music.owner_handle || music.ownerNickname
                soundMeta.sound_page_url = music.playUrl || music.play_url
                log('Resolved Music ID from Video', musicId)
            }
          }
        }
      } else {
        // Direct Sound URL
        musicId = url.match(/music\/[^/]+-(\d+)/)?.[1] || url.match(/music\/(\d+)/)?.[1] || ''
        log('Extracted Music ID from URL', musicId)
      }

      if (!musicId) throw new Error('Could not resolve TikTok Music ID. Check API logs in response.')
      soundMeta.canonical_key = musicId
      
      // If we didn't get metadata from video, fetch music info now
      if (!soundMeta.title) {
        const res = await fetchWithRetry(`https://tiktok-data-api.p.rapidapi.com/music/info?music_id=${musicId}`, {
          headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'tiktok-data-api.p.rapidapi.com' }
        })
        const data = await res.json()
        log('API Response Music Info', data)
        
        const music = data.music || data.data?.music || data.musicInfo?.music || data.music_info || data
        soundMeta.title = music?.title || music?.musicName || music?.song_name
        soundMeta.artist = music?.author || music?.authorName || music?.owner_handle
      }
    }

    // --- INSTAGRAM RESOLUTION ---
    else if (platform === 'instagram') {
      // Strategy: If Reel URL, fetch media info to get audio_id.
      let audioId = ''
      
      if (url.includes('/reel/') || url.includes('/p/')) {
        // Extract shortcode
        const shortcode = url.match(/(?:reel|p)\/([^/]+)/)?.[1]
        log('Extracted Shortcode', shortcode)
        
        if (shortcode) {
           // Note: Using a generic scraper endpoint pattern here
           const res = await fetchWithRetry(`https://instagram-scraper-stable.p.rapidapi.com/media/info?shortcode=${shortcode}`, {
             headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'instagram-scraper-stable.p.rapidapi.com' }
           })
           const data = await res.json()
           log('API Response Media Info', data)
           // Depending on API response structure (often nested in 'items' or 'data')
           const item = data.items ? data.items[0] : data
           if (item?.music_metadata?.music_canonical_id) {
             audioId = item.music_metadata.music_canonical_id
             soundMeta.title = item.music_metadata.music_info?.song_name
             soundMeta.artist = item.music_metadata.music_info?.artist_name
           } else if (item?.audio?.id) {
             // Fallback for original audio
             audioId = item.audio.id
             soundMeta.title = "Original Audio"
             soundMeta.artist = item.user?.username
           }
        }
      } else if (url.includes('/audio/')) {
        audioId = url.match(/audio\/(\d+)/)?.[1] || ''
        log('Extracted Audio ID from URL', audioId)
      }

      if (!audioId) throw new Error('Could not resolve Instagram Audio ID')
      soundMeta.canonical_key = audioId // For IG, we use the ID or the normalized URL as key
      soundMeta.sound_page_url = `https://www.instagram.com/reels/audio/${audioId}/`
    }

    // --- YOUTUBE RESOLUTION (Placeholder for Architecture) ---
    else if (platform === 'youtube') {
      // YouTube requires scraping the "attribution" text from the Shorts player
      // For now, we assume the user might pass a specific ID or we fail gracefully
      throw new Error('YouTube resolution requires advanced scraping not yet enabled')
    }

    // 3. Upsert into Canonical Sounds Table
    const { data: soundData, error: soundError } = await supabase
      .from('sounds')
      .upsert({
        user_id: userId,
        platform,
        canonical_sound_key: soundMeta.canonical_key,
        title: soundMeta.title || 'Unknown Sound',
        artist: soundMeta.artist || 'Unknown Artist',
        sound_page_url: soundMeta.sound_page_url,
        last_crawled_at: new Date().toISOString(),
        indexing_state: 'indexing'
      }, { onConflict: 'platform, canonical_sound_key' })
      .select()
      .single()

    if (soundError) throw soundError
    soundId = soundData.id
    }

    // 4. Link to Campaign (if provided)
    if (campaignId) {
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, user_id')
        .eq('id', campaignId)
        .single()

      if (campaignError || !campaign || campaign.user_id !== userId) {
        throw new Error('Campaign not found or unauthorized')
      }

      await supabase
        .from('campaigns')
        .update({ sound_id: soundId, sound_url: url }) // Keep sound_url for legacy reference
        .eq('id', campaignId)
    }

    // 5. Scrape Videos (Synchronous)
    log('Scraping videos for sound...', { soundId, platform })

    let videosToIndex: any[] = []
    let regions: string[] = []
    const canonicalKey = soundMeta.canonical_key

    if (platform === 'tiktok') {
      const apifyUrl = `https://api.apify.com/v2/acts/clockworks~tiktok-sound-scraper/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`

      const runInput = {
        "musics": [{ "id": canonicalKey }],
        "maxItems": 100,
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

    // 6. Bulk insert videos
    if (videosToIndex.length > 0) {
      const { error: videoError } = await supabase
        .from('sound_videos')
        .upsert(videosToIndex, { onConflict: 'sound_id, video_id' })

      if (videoError) {
        console.warn('Video insert warning:', videoError)
      }
    }

    // 7. Update sound with geo stats and mark as active
    const geoStats = calculateGeoStats(regions)
    await supabase.from('sounds').update({
      indexing_state: 'active',
      geo_estimated: geoStats,
      last_crawled_at: new Date().toISOString()
    }).eq('id', soundId)

    log('Successfully indexed videos', { soundId, count: videosToIndex.length })

    return new Response(
      JSON.stringify({
        success: true,
        sound: {
          id: soundId,
          platform,
          canonical_sound_key: soundMeta.canonical_key,
          title: soundMeta.title,
          artist: soundMeta.artist,
          sound_page_url: soundMeta.sound_page_url,
          indexing_state: 'active'
        },
        status: 'active',
        message: 'Sound indexed successfully!',
        indexed_count: videosToIndex.length,
        debug
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // If we have a soundId, mark it as failed so the UI doesn't get stuck loading
    if (soundId) {
      await supabase.from('sounds')
        .update({ indexing_state: 'failed' })
        .eq('id', soundId)
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message, stack: error.stack }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
