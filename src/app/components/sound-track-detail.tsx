import React, { useState, useMemo } from 'react';
import type { SoundTrackPost, SoundTrackPostSnapshot } from '../../lib/api/sound-tracks';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Music2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { PlatformIcon } from './ui/PlatformIcon';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  useSoundTrack,
  useSoundTrackSnapshots,
  useSoundTrackPosts,
  useRefreshSoundTrack,
} from '../../hooks/useSoundTracks';
import {
  useScrapeJob,
  useSoundTrackVideos,
  useSoundTrackStats,
  useStartScrape,
} from '../../hooks/useSoundScrape';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { formatNumber, formatCompactNumber, calculateDelta, formatRelativeTime } from '../../lib/utils/format';
import { Skeleton } from './ui/skeleton';

interface SoundTrackDetailProps {
  onNavigate: (path: string) => void;
}

export function SoundTrackDetail({ onNavigate }: SoundTrackDetailProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'top' | 'recent'>('top');

  const { data: soundTrack, isLoading: trackLoading } = useSoundTrack(activeWorkspaceId, id || null);
  const { data: snapshots = [], isLoading: snapshotsLoading } = useSoundTrackSnapshots(
    activeWorkspaceId,
    id || null
  );
  const { data: topPosts = [], isLoading: topPostsLoading } = useSoundTrackPosts(
    activeWorkspaceId,
    id || null,
    'top'
  );
  const { data: recentPosts = [], isLoading: recentPostsLoading } = useSoundTrackPosts(
    activeWorkspaceId,
    id || null,
    'recent'
  );
  const refreshMutation = useRefreshSoundTrack();

  // Scrape job status and results
  const { data: scrapeJob, isLoading: scrapeJobLoading } = useScrapeJob(activeWorkspaceId, id || null);
  const { data: scrapeVideos = [], isLoading: videosLoading } = useSoundTrackVideos(
    activeWorkspaceId,
    id || null,
    'views',
    50
  );
  const { data: scrapeStats } = useSoundTrackStats(activeWorkspaceId, id || null);
  const startScrape = useStartScrape();

  // Determine scraping state - show loading if scraping is active OR if we have no data but scraping should be happening
  const isScraping = scrapeJob?.status === 'running' || scrapeJob?.status === 'queued';
  const isWaitingForScrape = !scrapeJob && !scrapeVideos.length && !scrapeStats && soundTrack; // No job yet but sound exists
  const shouldShowLoading = isScraping || isWaitingForScrape || (videosLoading && !scrapeVideos.length);
  const hasNoData = !scrapeStats && !scrapeVideos.length && !snapshots.length;
  const shouldShowScrapingBanner = isScraping || (hasNoData && !scrapeJobLoading && soundTrack);

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!snapshots.length) {
      return {
        totalUses: null as number | null,
        delta24h: null as ReturnType<typeof calculateDelta> | null,
        delta7d: null as ReturnType<typeof calculateDelta> | null,
        velocity: null as number | null,
      };
    }

    const latest = snapshots[snapshots.length - 1];
    const now24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find snapshots nearest to 24h and 7d ago
    let snapshot24h = snapshots[0];
    let snapshot7d = snapshots[0];
    let minDiff24h = Math.abs(new Date(snapshot24h.captured_at).getTime() - now24h.getTime());
    let minDiff7d = Math.abs(new Date(snapshot7d.captured_at).getTime() - now7d.getTime());

    for (const snapshot of snapshots) {
      const diff24h = Math.abs(new Date(snapshot.captured_at).getTime() - now24h.getTime());
      const diff7d = Math.abs(new Date(snapshot.captured_at).getTime() - now7d.getTime());
      if (diff24h < minDiff24h) {
        minDiff24h = diff24h;
        snapshot24h = snapshot;
      }
      if (diff7d < minDiff7d) {
        minDiff7d = diff7d;
        snapshot7d = snapshot;
      }
    }

    const totalUses = latest.total_uses;
    const delta24h = calculateDelta(totalUses, snapshot24h.total_uses);
    const delta7d = calculateDelta(totalUses, snapshot7d.total_uses);
    // Velocity: change in uses per hour (only if we have a valid delta)
    const velocity = delta24h.value !== null && snapshot24h.total_uses !== null 
      ? delta24h.value / 24 
      : null;

    return {
      totalUses,
      delta24h,
      delta7d,
      velocity,
    };
  }, [snapshots]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return snapshots.map((snapshot) => ({
      date: new Date(snapshot.captured_at).toLocaleDateString(),
      timestamp: new Date(snapshot.captured_at).getTime(),
      uses: snapshot.total_uses || 0,
    }));
  }, [snapshots]);

  const handleRefresh = async () => {
    if (!activeWorkspaceId || !id) return;
    await refreshMutation.mutateAsync({ workspaceId: activeWorkspaceId, soundTrackId: id });
  };

  if (trackLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!soundTrack) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/sounds')}
            className="w-11 h-11 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sound Not Found</h1>
        </div>
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-6">
            <p className="text-muted-foreground">The sound track you're looking for doesn't exist.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isBlocked = snapshots.some((s) => s.meta?.blocked || s.meta?.note?.includes('pending'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/sounds')}
            className="w-11 h-11 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {soundTrack.title || 'Untitled Sound'}
              </h1>
              <PlatformIcon platform={soundTrack.platform as any} />
            </div>
            {soundTrack.artist && (
              <p className="text-sm text-muted-foreground mt-1">{soundTrack.artist}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>Created {new Date(soundTrack.created_at).toLocaleDateString()}</span>
              {soundTrack.source_url && (
                <a
                  href={soundTrack.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View original
                </a>
              )}
            </div>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshMutation.isPending}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Now
        </Button>
      </div>

      {/* Scraping Status Banner - Show prominently when scraping */}
      {shouldShowScrapingBanner && (
        <Card className="border-red-200 dark:border-blue-500/40 bg-red-100/70 dark:bg-blue-500/10 shadow-lg shadow-red-500/15 dark:shadow-blue-500/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <Loader2 className="h-6 w-6 text-red-600 dark:text-blue-400 flex-shrink-0 animate-spin mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-red-600 dark:text-blue-400 mb-1">
                  {scrapeJob?.status === 'queued' 
                    ? 'Scraping queued...' 
                    : scrapeJob?.status === 'running'
                    ? 'Scraping in progress...'
                    : 'Initializing scraping...'}
                </p>
                <p className="text-sm text-red-700/90 dark:text-blue-300/90 leading-relaxed">
                  {scrapeJob?.status === 'queued'
                    ? 'Your scrape job is queued and will start shortly. This usually takes 10-30 seconds.'
                    : scrapeJob?.status === 'running'
                    ? 'Apify is collecting videos using this sound. This typically takes 5-10 minutes depending on how many videos use the sound. Results will appear automatically when ready.'
                    : 'Setting up the scraping job. This will only take a moment...'}
                </p>
                {scrapeJob?.started_at && (
                  <p className="text-xs text-red-700/70 dark:text-blue-300/70 mt-2">
                    Started {new Date(scrapeJob.started_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Scraping Banner */}
      {scrapeJob && scrapeJob.status === 'failed' && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-400">Scraping failed</p>
                <p className="text-xs text-red-300/80 mt-1">
                  {scrapeJob.error || 'Failed to scrape sound data. Try refreshing.'}
                </p>
              </div>
              {soundTrack?.source_url && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!activeWorkspaceId || !id) return;
                    await startScrape.mutateAsync({
                      workspaceId: activeWorkspaceId,
                      soundTrackId: id,
                      soundUrl: soundTrack.source_url,
                    });
                  }}
                >
                  Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs - Use scrape stats if available, otherwise use snapshots */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={`border-border/50 ${isScraping ? 'bg-muted/40 opacity-75' : 'bg-muted/30'}`}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Uses</p>
            {isScraping && !scrapeStats ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-red-600 dark:text-blue-400 animate-spin" />
                <p className="text-sm text-red-600 dark:text-blue-400">Collecting data...</p>
              </div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-foreground">
                  {scrapeStats?.total_videos 
                    ? formatNumber(scrapeStats.total_videos)
                    : kpis.totalUses !== null 
                    ? formatNumber(kpis.totalUses) 
                    : '-'}
                </p>
                {scrapeStats && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {scrapeStats.total_videos} videos found
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">24h Change</p>
            <div className="flex items-center gap-2">
              {kpis.delta24h && kpis.delta24h.percentage !== null ? (
                <>
                  {kpis.delta24h.isPositive ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <p
                    className={`text-2xl font-semibold ${
                      kpis.delta24h.isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {kpis.delta24h.isPositive ? '+' : ''}
                    {formatNumber(kpis.delta24h.value)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ({kpis.delta24h.percentage.toFixed(1)}%)
                  </p>
                </>
              ) : (
                <p className="text-2xl font-semibold text-muted-foreground">-</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">7d Change</p>
            <div className="flex items-center gap-2">
              {kpis.delta7d && kpis.delta7d.percentage !== null ? (
                <>
                  {kpis.delta7d.isPositive ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  )}
                  <p
                    className={`text-2xl font-semibold ${
                      kpis.delta7d.isPositive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {kpis.delta7d.isPositive ? '+' : ''}
                    {formatNumber(kpis.delta7d.value)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ({kpis.delta7d.percentage.toFixed(1)}%)
                  </p>
                </>
              ) : (
                <p className="text-2xl font-semibold text-muted-foreground">-</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Velocity</p>
            <p className="text-2xl font-semibold text-foreground">
              {kpis.velocity !== null
                ? `${kpis.velocity >= 0 ? '+' : ''}${formatCompactNumber(Math.abs(kpis.velocity))}/hr`
                : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Uses per hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Uses Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="date"
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => formatCompactNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: any) => formatNumber(value)}
                />
                <Line
                  type="monotone"
                  dataKey="uses"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Videos from Scrape Results - Show loading if scraping, otherwise show videos if available */}
      {(shouldShowLoading || scrapeVideos.length > 0) && (
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Videos Using This Sound</CardTitle>
            {scrapeStats && scrapeStats.total_videos > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatNumber(scrapeStats.total_videos)} videos found • 
                Avg {formatNumber(scrapeStats.avg_views)} views
              </p>
            )}
            {shouldShowLoading && !scrapeStats && (
              <p className="text-sm text-red-600 dark:text-blue-400 mt-1">
                {isScraping ? 'Collecting videos...' : 'Initializing...'}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {shouldShowLoading || videosLoading ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-3 py-8">
                  <Loader2 className="h-5 w-5 text-red-600 dark:text-blue-400 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-red-600 dark:text-blue-400">
                      {isScraping 
                        ? 'Scraping in progress...' 
                        : isWaitingForScrape
                        ? 'Initializing scraping...'
                        : 'Loading videos...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isScraping 
                        ? 'Videos will appear here automatically when ready (usually 5-10 minutes)'
                        : 'Please wait while we collect video data'}
                    </p>
                  </div>
                </div>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : scrapeVideos.length > 0 ? (
              <div className="space-y-3">
                {scrapeVideos.slice(0, 50).map((video) => (
                  <VideoRow key={video.id} video={video} />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Posts Tabs - Only show if no scrape videos AND not loading */}
      {!shouldShowLoading && scrapeVideos.length === 0 && (
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Posts Using This Sound</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'top' | 'recent')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="top">Top Posts</TabsTrigger>
                <TabsTrigger value="recent">Recent Posts</TabsTrigger>
              </TabsList>

              <TabsContent value="top" className="mt-4">
                {topPostsLoading || shouldShowLoading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 py-12">
                      <Loader2 className="h-5 w-5 text-red-600 dark:text-blue-400 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-red-600 dark:text-blue-400">
                          {isScraping 
                            ? 'Scraping in progress...' 
                            : isWaitingForScrape
                            ? 'Initializing scraping...'
                            : 'Loading videos...'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isScraping 
                            ? 'Videos will appear here automatically when ready (usually 5-10 minutes)'
                            : 'Please wait while we collect video data'}
                        </p>
                      </div>
                    </div>
                    {/* Show skeleton loaders while loading */}
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : topPosts.length === 0 ? (
                  <div className="text-center py-12">
                    {scrapeJob?.status === 'failed' ? (
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-2">Scraping failed</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          {scrapeJob.error || 'Failed to scrape sound data. Try refreshing or retry the scrape.'}
                        </p>
                        {soundTrack?.source_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!activeWorkspaceId || !id) return;
                              await startScrape.mutateAsync({
                                workspaceId: activeWorkspaceId,
                                soundTrackId: id,
                                soundUrl: soundTrack.source_url,
                              });
                            }}
                          >
                            Retry Scraping
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No posts found yet. Try refreshing or start a new scrape.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topPosts.map((post) => (
                      <PostRow key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="recent" className="mt-4">
                {recentPostsLoading || shouldShowLoading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 py-12">
                      <Loader2 className="h-5 w-5 text-red-600 dark:text-blue-400 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-red-600 dark:text-blue-400">
                          {isScraping 
                            ? 'Scraping in progress...' 
                            : isWaitingForScrape
                            ? 'Initializing scraping...'
                            : 'Loading videos...'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isScraping 
                            ? 'Videos will appear here automatically when ready (usually 5-10 minutes)'
                            : 'Please wait while we collect video data'}
                        </p>
                      </div>
                    </div>
                    {/* Show skeleton loaders while loading */}
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : recentPosts.length === 0 ? (
                  <div className="text-center py-12">
                    {scrapeJob?.status === 'failed' ? (
                      <div>
                        <p className="text-sm font-medium text-red-400 mb-2">Scraping failed</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          {scrapeJob.error || 'Failed to scrape sound data. Try refreshing or retry the scrape.'}
                        </p>
                        {soundTrack?.source_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!activeWorkspaceId || !id) return;
                              await startScrape.mutateAsync({
                                workspaceId: activeWorkspaceId,
                                soundTrackId: id,
                                soundUrl: soundTrack.source_url,
                              });
                            }}
                          >
                            Retry Scraping
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No posts found yet. Try refreshing or start a new scrape.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentPosts.map((post) => (
                      <PostRow key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PostRow({ post }: { post: SoundTrackPost & { latest_metrics: SoundTrackPostSnapshot | null } }) {
  const metrics = post.latest_metrics;

  return (
    <a
      href={post.post_url}
      target="_blank"
      rel="noreferrer"
      className="block p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <PlatformIcon platform={post.platform as any} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              @{post.creator_handle || 'Unknown'}
            </p>
            {post.created_at_platform && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(post.created_at_platform)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          {metrics?.views !== null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Views</p>
              <p className="text-foreground font-medium">{formatNumber(metrics.views)}</p>
            </div>
          )}
          {metrics?.likes !== null && (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Likes</p>
              <p className="text-foreground font-medium">{formatNumber(metrics.likes)}</p>
            </div>
          )}
          {metrics?.comments !== null && (
            <div className="text-right hidden sm:block">
              <p className="text-muted-foreground text-xs">Comments</p>
              <p className="text-foreground font-medium">{formatNumber(metrics.comments)}</p>
            </div>
          )}
          <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    </a>
  );
}

function VideoRow({ video }: { video: import('../../lib/api/sound-scrape-jobs').SoundTrackVideo }) {
  return (
    <a
      href={video.video_url}
      target="_blank"
      rel="noreferrer"
      className="block p-4 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0">
            <PlatformIcon platform={video.platform} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              @{video.creator_handle || 'Unknown'}
            </p>
            {video.posted_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(video.posted_at)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Views</p>
            <p className="text-foreground font-medium">{formatNumber(video.views)}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Likes</p>
            <p className="text-foreground font-medium">{formatNumber(video.likes)}</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-muted-foreground text-xs">Comments</p>
            <p className="text-foreground font-medium">{formatNumber(video.comments)}</p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    </a>
  );
}
