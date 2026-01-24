import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Play,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '../app/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../app/components/ui/card'
import { SoundIngest } from './SoundIngest'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

type Sound = {
  id: string
  title?: string | null
  artist?: string | null
  platform?: string | null
  sound_page_url?: string | null
  last_crawled_at?: string | null
  created_at?: string | null
  indexing_state?: 'queued' | 'indexing' | 'active' | 'failed' | null
  geo_estimated?: { country: string; percent: number }[] | null
}

type SoundVideo = {
  id?: string
  video_id?: string
  video_url?: string
  creator_handle?: string
  platform?: string
  views?: number
  likes?: number
  posted_at?: string
  engagement_rate?: number
}

const sortOptions = [
  { key: 'views', label: 'Views' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'recent', label: 'Recent' },
] as const

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)

const formatRelativeTime = (value?: string | null) => {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 1000 / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const getMomentum = (videos: SoundVideo[]) => {
  const now = Date.now()
  const dayMs = 1000 * 60 * 60 * 24
  const buckets = Array.from({ length: 14 }, (_, index) => ({
    day: index,
    count: 0,
    timestamp: now - dayMs * index,
  }))

  videos.forEach((video) => {
    if (!video.posted_at) return
    const created = new Date(video.posted_at).getTime()
    const diff = Math.floor((now - created) / dayMs)
    if (diff >= 0 && diff < 14) {
      buckets[diff].count += 1
    }
  })

  const last7 = buckets.slice(0, 7).reverse()
  const previous7 = buckets.slice(7, 14).reverse()
  const last7Sum = last7.reduce((acc, bucket) => acc + bucket.count, 0)
  const prev7Sum = previous7.reduce((acc, bucket) => acc + bucket.count, 0)
  const normalized = Math.max(...last7.map((bucket) => bucket.count), 1) || 1

  const chartPoints = last7
    .map((bucket, index) => {
      const x = (index / (last7.length - 1)) * 100
      const y = 100 - (bucket.count / normalized) * 100
      return `${x},${y}`
    })
    .join(' ')

  return {
    last7Sum,
    prev7Sum,
    chartPoints,
    total: buckets.reduce((acc, bucket) => acc + bucket.count, 0),
    avgPerDay: last7Sum / 7,
    normalized,
  }
}

const platformLabel = (platform?: string | null) => {
  if (!platform) return 'Unknown'
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

const platformIcon = (platform?: string | null) => {
  if (!platform) return <Play className="w-4 h-4" />
  if (platform.includes('tik')) return <Play className="w-4 h-4 text-pink-400" />
  if (platform.includes('insta')) return <Play className="w-4 h-4 text-rose-400" />
  if (platform.includes('youtube')) return <Play className="w-4 h-4 text-red-400" />
  return <Play className="w-4 h-4" />
}

export function SoundTracking() {
  const [sounds, setSounds] = useState<Sound[]>([])
  const [loadingSounds, setLoadingSounds] = useState(true)
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null)
  const [soundVideos, setSoundVideos] = useState<SoundVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [sortKey, setSortKey] = useState<(typeof sortOptions)[number]['key']>('views')
  const [geoTab, setGeoTab] = useState<'estimated' | 'verified'>('estimated')
  const listRef = useRef<HTMLDivElement | null>(null)

  const selectedSound = useMemo(
    () => sounds.find((sound) => sound.id === selectedSoundId) || null,
    [sounds, selectedSoundId],
  )

  const momentum = useMemo(() => getMomentum(soundVideos), [soundVideos])

  const handleSoundDetected = async (sound: Sound) => {
    await refreshSounds(sound.id)
    await handleSelectSound(sound.id, sound)
  }

  const refreshSounds = async (focusId?: string) => {
    setLoadingSounds(true)
    const { data, error } = await supabase
      .from('sounds')
      .select('*')
      .order('last_crawled_at', { ascending: false })

    if (error) {
      console.error('Unable to load sounds', error)
    } else {
      setSounds(data || [])
      if (focusId) {
        setSelectedSoundId(focusId)
      } else if (!selectedSoundId && data?.[0]?.id) {
        setSelectedSoundId(data[0].id)
        void handleSelectSound(data[0].id, data[0])
      }
    }

    setLoadingSounds(false)
  }

  useEffect(() => {
    void refreshSounds()
  }, [])

  const handleSelectSound = async (soundId: string, soundData?: Sound) => {
    setSelectedSoundId(soundId)
    setLoadingVideos(true)
    setSoundVideos([])
    const { data } = await supabase
      .from('sound_videos')
      .select('*')
      .eq('sound_id', soundId)
      .order('views', { ascending: false })
      .limit(50)

    setSoundVideos(data || [])
    setLoadingVideos(false)
  }

  const sortedVideos = useMemo(() => {
    const list = [...soundVideos]
    if (sortKey === 'views') {
      return list.sort((a, b) => (b.views || 0) - (a.views || 0))
    }
    if (sortKey === 'engagement') {
      return list.sort((a, b) => {
        const aEng =
          a.engagement_rate ?? ((a.likes || 0) / Math.max(a.views || 1, 1))
        const bEng =
          b.engagement_rate ?? ((b.likes || 0) / Math.max(b.views || 1, 1))
        return bEng - aEng
      })
    }
    if (sortKey === 'recent') {
      return list.sort((a, b) => {
        const aTime = new Date(a.posted_at || 0).getTime()
        const bTime = new Date(b.posted_at || 0).getTime()
        return bTime - aTime
      })
    }
    return list
  }, [soundVideos, sortKey])

  const topVideos = sortedVideos.slice(0, 10)
  const videosInLastWeek = momentum.last7Sum
  const velocity = Math.max(momentum.avgPerDay, 0.1)
  const delta = momentum.last7Sum - momentum.prev7Sum
  const topViews = Math.max(...soundVideos.map((video) => Number(video.views) || 0), 0)

  const bestVideoStats = (video: SoundVideo) => {
    const engagement =
      video.engagement_rate ?? ((video.likes || 0) / Math.max(video.views || 1, 1))
    return `${(engagement * 100).toFixed(1)}% engagement`
  }

  const handleViewAllSounds = () => {
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const deleteSound = async (
    soundId: string,
    event?: MouseEvent<HTMLButtonElement | HTMLDivElement>,
  ) => {
    event?.stopPropagation()
    if (!confirm('Are you sure you want to stop tracking this sound?')) return

    const { error } = await supabase
      .from('sounds')
      .delete()
      .eq('id', soundId)

    if (error) {
      console.error('Error deleting sound:', error)
      alert('Failed to delete sound')
    } else {
      setSounds(sounds.filter((s) => s.id !== soundId))
      if (selectedSoundId === soundId) {
        setSelectedSoundId(null)
        setSoundVideos([])
      }
    }
  }

  const handleRefresh = async () => {
    if (!selectedSound) return

    setSounds((prev) =>
      prev.map((s) =>
        s.id === selectedSound.id ? { ...s, indexing_state: 'indexing' } : s,
      ),
    )

    try {
      const { data, error } = await supabase.functions.invoke('sound-tracking', {
        body: { action: 'refresh', sound_id: selectedSound.id },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)

      await refreshSounds(selectedSound.id)
      await handleSelectSound(selectedSound.id, selectedSound)
    } catch (err) {
      console.error('Refresh failed', err)
      await refreshSounds(selectedSound?.id)
    }
  }

  const isIndexing =
    selectedSound?.indexing_state === 'indexing' ||
    selectedSound?.indexing_state === 'queued'
  const isFailed = selectedSound?.indexing_state === 'failed'

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">
            Sound Tracking
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Track sound usage, growth, and top-performing videos across platforms. DTTracker watches each sound continuously.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleViewAllSounds}>
          View All Tracked Sounds
          <ArrowRight className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <SoundIngest
            onSuccess={() => void refreshSounds()}
            onSoundDetected={handleSoundDetected}
          />

          <Card className="space-y-4">
            <CardHeader className="items-center gap-4">
              <div>
                <CardTitle className="text-lg text-white">Tracked sounds</CardTitle>
                <CardDescription className="text-slate-400">
                  Tap any entry to inspect usage and momentum.
                </CardDescription>
              </div>
              <span className="text-xs uppercase tracking-[0.4em] text-slate-500">
                Workspace
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSounds ? (
                <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-5 text-sm text-slate-500">
                  Loading your sound roster…
                </div>
              ) : sounds.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-5 text-sm text-slate-500">
                  No sounds have been added yet. Paste a link above and DTTracker starts watching.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sounds.map((sound) => {
                    const active = sound.id === selectedSoundId
                    return (
                      <button
                        key={sound.id}
                        onClick={() => void handleSelectSound(sound.id, sound)}
                        className={`group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition ${
                          active
                            ? 'border-cyan-500/50 bg-cyan-500/10'
                            : 'border-border bg-background/50 hover:border-white/30'
                        }`}
                      >
                        <span className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          {platformLabel(sound.platform)}
                        </span>
                        <p className="text-base font-semibold text-white truncate">
                          {sound.title || 'Original / Unnamed Audio'}
                        </p>
                        <p className="text-sm text-slate-400 truncate">
                          {sound.artist || 'Unknown artist'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>
                            {sound.last_crawled_at
                              ? formatRelativeTime(sound.last_crawled_at)
                              : 'Awaiting initial index'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => deleteSound(sound.id, e)}
                          className="absolute top-4 right-4 rounded-full p-1 text-slate-500 transition-opacity opacity-0 hover:text-red-400 group-hover:opacity-100"
                          aria-label="Delete sound"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedSound ? (
            <div className="space-y-6">
              <Card className="space-y-4">
                <CardHeader className="items-start gap-4">
                  <div>
                    <CardTitle className="text-lg text-white">Sound overview</CardTitle>
                    <CardDescription className="text-slate-400">
                      {selectedSound.artist || 'Creator collaboration'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedSound.sound_page_url && (
                      <a
                        href={selectedSound.sound_page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold uppercase tracking-[0.3em] text-primary hover:underline"
                      >
                        View sound page
                      </a>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteSound(selectedSound.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Stop tracking
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isIndexing ? (
                    <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 text-center">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">
                        Indexing in progress
                      </h3>
                      <p className="mt-2 text-sm text-slate-400">
                        We’re discovering videos using this sound. New insights arrive on the fly.
                      </p>
                    </div>
                  ) : isFailed ? (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 text-center">
                      <div className="flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-rose-400" />
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">
                        Indexing failed
                      </h3>
                      <p className="mt-2 text-sm text-slate-400">
                        The platform may be rate limiting us or the audio is restricted. Try refreshing shortly.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-3">
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          Videos indexed
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {formatNumber(soundVideos.length)}
                        </p>
                        <p className="text-xs text-slate-400">Samples from the crawler</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          New videos (7d)
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {formatNumber(videosInLastWeek)}
                        </p>
                        <p className={`text-xs ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {delta >= 0 ? '+' : ''}
                          {delta} vs prior week
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          Velocity
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {velocity.toFixed(1)}
                        </p>
                        <p className="text-xs text-slate-400">Videos / day</p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/50 p-4">
                        <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                          Top video views
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {formatNumber(topViews)}
                        </p>
                        <p className="text-xs text-slate-400">Sample of the most-watched clip</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="space-y-4">
                <CardHeader className="items-start gap-4">
                  <div>
                    <CardTitle className="text-lg text-white">Best performers</CardTitle>
                    <CardDescription className="text-slate-400">
                      Sort and preview the top videos that use this sound.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setSortKey(option.key)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                          sortKey === option.key
                            ? 'bg-white text-black'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingVideos ? (
                    <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-sm text-slate-500">
                      Gathering indexed videos and performance signals…
                    </div>
                  ) : topVideos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-sm text-slate-500">
                      We’re still indexing videos for this sound. Check back in a few minutes for trending clips.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topVideos.map((video) => {
                        const views = Number(video.views) || 0
                        return (
                          <a
                            key={video.video_id || video.id}
                            href={video.video_url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 transition hover:border-white/30"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-16 w-24 rounded-xl bg-slate-900 flex items-center justify-center text-2xl font-semibold text-white uppercase tracking-wide">
                                {video.creator_handle ? video.creator_handle.charAt(0) : 'V'}
                              </div>
                              <div className="flex-1">
                                <p className="text-lg font-semibold text-white truncate">
                                  {video.creator_handle || 'Creator'}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                  <span className="inline-flex items-center gap-1">
                                    <Play className="w-3 h-3 text-slate-400" />
                                    {formatNumber(views)} views
                                  </span>
                                  <span>{bestVideoStats(video)}</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatRelativeTime(video.posted_at)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-sm text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  {platformIcon(video.platform)}
                                  {platformLabel(video.platform)}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {video.platform ? 'Platform' : 'Unknown'}
                                </span>
                              </div>
                            </div>
                          </a>
                        )
                      })}
                      <div className="flex justify-end">
                        <a
                          href={selectedSound.sound_page_url || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300 hover:text-white"
                        >
                          View more
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="px-6 py-10 text-sm text-slate-500">
              Select a tracked sound to see momentum, best videos, and regional signals.
            </Card>
          )}
        </div>

        {selectedSound && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">Growth & momentum</CardTitle>
                  <CardDescription className="text-slate-400">
                    Creator adoption over the last 14 days.
                  </CardDescription>
                </div>
                <span className={`text-xs font-semibold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {delta >= 0 ? 'Accelerating' : 'Cooling down'}
                </span>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border bg-background/50 p-4">
                  <svg viewBox="0 0 100 100" className="h-36 w-full" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      points={momentum.chartPoints || '0,100 100,100'}
                    />
                    <polyline
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth="0.5"
                      points="0,100 0,0 100,0 100,100"
                    />
                  </svg>
                  <p className="mt-3 text-xs text-slate-400">
                    This shows creator adoption (last 7 days vs previous 7 days).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="items-start gap-4">
                <div>
                  <CardTitle className="text-lg text-white">Geographic usage</CardTitle>
                  <CardDescription className="text-slate-400">
                    Estimated regions from creator signals.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {(['estimated', 'verified'] as const).map((tab) => (
                    <Button
                      key={tab}
                      variant={geoTab === tab ? 'default' : 'ghost'}
                      size="sm"
                      className="text-xs uppercase tracking-[0.3em]"
                      onClick={() => setGeoTab(tab)}
                    >
                      {tab === 'estimated' ? 'Estimated' : 'Verified'}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {geoTab === 'estimated' ? (
                  selectedSound.geo_estimated && selectedSound.geo_estimated.length > 0 ? (
                    selectedSound.geo_estimated.map((item) => (
                      <div
                        key={item.country}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3 text-sm text-slate-200"
                      >
                        <div>
                          <p className="font-semibold text-white">{item.country}</p>
                          <p className="text-xs text-slate-400">
                            Estimated from creator signals and public data
                          </p>
                        </div>
                        <span className="text-sm text-cyan-400">{item.percent}%</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-6 text-sm text-slate-400">
                      Not enough data to estimate geographic usage yet.
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-6 text-sm text-slate-400">
                    Verified audience geography becomes available when creators connect accounts.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Card className="bg-gradient-to-r from-white/10 to-transparent">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-300">
            This sound is automatically refreshed daily. New videos are continuously added as the sound grows.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isIndexing}
            className="text-slate-300 hover:text-white"
          >
            {isIndexing ? 'Refreshing...' : 'Refresh now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
