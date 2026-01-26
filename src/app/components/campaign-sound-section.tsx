import { useState } from 'react'
import { Play, Clock, Loader2, Music2, Plus, Trash2, RefreshCw } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { SoundIngest } from './sound-ingest'
import type { Sound, SoundVideo } from '../../lib/types/database'

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

const platformLabel = (platform?: string | null) => {
  if (!platform) return 'Unknown'
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

interface CampaignSoundSectionProps {
  campaignId: string
  sound: Sound | null
  soundVideos: SoundVideo[]
  loading?: boolean
  onAddSound: () => void
  onRemoveSound: () => void
  onRefreshSound: () => void
}

export function CampaignSoundSection({
  campaignId,
  sound,
  soundVideos,
  loading = false,
  onAddSound,
  onRemoveSound,
  onRefreshSound,
}: CampaignSoundSectionProps) {
  const [showAddDialog, setShowAddDialog] = useState(false)

  if (!sound) {
    return (
      <Card className="border-white/5 bg-white/5">
        <CardHeader className="items-start gap-4">
          <div>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Music2 className="h-5 w-5 text-primary" />
              Sound Performance
            </CardTitle>
            <CardDescription className="text-slate-400">
              Track how your campaign sound performs compared to creator posts.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-8 text-center">
            <Music2 className="h-8 w-8 text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-4">
              No sound linked to this campaign yet.
            </p>
            <Button
              onClick={() => {
                setShowAddDialog(true)
                onAddSound()
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Link a Sound
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const topVideos = soundVideos
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5)

  const totalViews = soundVideos.reduce((sum, v) => sum + (v.views || 0), 0)
  const topViewCount = Math.max(...soundVideos.map((v) => v.views || 0), 0)

  return (
    <Card className="border-white/5 bg-white/5">
      <CardHeader className="items-start gap-4">
        <div>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            Sound Performance
          </CardTitle>
          <CardDescription className="text-slate-400">
            {sound.title || 'Original / Unnamed Audio'} by {sound.artist || 'Unknown artist'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sound.sound_page_url && (
            <a
              href={sound.sound_page_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold uppercase tracking-[0.3em] text-primary hover:underline"
            >
              View sound page
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshSound}
            disabled={loading || sound.indexing_state === 'indexing'}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemoveSound}
          >
            <Trash2 className="h-3 w-3" />
            Remove Sound
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {sound.indexing_state === 'indexing' || sound.indexing_state === 'queued' ? (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 text-center">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
            <h3 className="mt-3 text-lg font-semibold text-white">
              Indexing in progress
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              We're discovering videos using this sound. New insights arrive on the fly.
            </p>
          </div>
        ) : (
          <>
            {/* Sound Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                  Videos Indexed
                </p>
                <p className="text-2xl font-semibold text-white">
                  {formatNumber(soundVideos.length)}
                </p>
                <p className="text-xs text-slate-400">Using this sound</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                  Total Views
                </p>
                <p className="text-2xl font-semibold text-white">
                  {formatNumber(totalViews)}
                </p>
                <p className="text-xs text-slate-400">Across all videos</p>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
                  Top Video Views
                </p>
                <p className="text-2xl font-semibold text-white">
                  {formatNumber(topViewCount)}
                </p>
                <p className="text-xs text-slate-400">Best performing</p>
              </div>
            </div>

            {/* Top Videos */}
            {topVideos.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">
                  Top Performing Videos
                </h3>
                <div className="space-y-3">
                  {topVideos.map((video) => (
                    <a
                      key={video.id}
                      href={video.video_url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 transition hover:border-white/30"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-20 rounded-xl bg-slate-900 flex items-center justify-center text-lg font-semibold text-white uppercase tracking-wide flex-shrink-0">
                          {video.creator_handle
                            ? video.creator_handle.charAt(0)
                            : 'V'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {video.creator_handle || 'Creator'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                            <span className="inline-flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              {formatNumber(video.views || 0)} views
                            </span>
                            {video.likes ? (
                              <span>
                                {((video.likes / Math.max(video.views || 1, 1)) *
                                  100).toFixed(1)}
                                % engagement
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 text-right flex-shrink-0">
                          {formatRelativeTime(video.posted_at)}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-background/50 p-6 text-center text-sm text-slate-400">
                We're still indexing videos for this sound. Check back in a few minutes.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
