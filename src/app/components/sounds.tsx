import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Music2, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { PlatformIcon } from './ui/PlatformIcon';
import { useSoundTracks } from '../../hooks/useSoundTracks';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { Skeleton } from './ui/skeleton';
import { formatNumber } from '../../lib/utils/format';

interface SoundsProps {
  onNavigate: (path: string) => void;
}

export function Sounds({ onNavigate }: SoundsProps) {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const { data: soundTracks = [], isLoading } = useSoundTracks(activeWorkspaceId);

  const filteredTracks = React.useMemo(() => {
    if (!searchQuery.trim()) return soundTracks;
    const query = searchQuery.toLowerCase();
    return soundTracks.filter(
      (track) =>
        track.title?.toLowerCase().includes(query) ||
        track.artist?.toLowerCase().includes(query) ||
        track.source_url.toLowerCase().includes(query)
    );
  }, [soundTracks, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Sound Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track how sounds perform across TikTok, Instagram, and YouTube
          </p>
        </div>
        <Button
          onClick={() => onNavigate('/sounds/new')}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Track a Sound
        </Button>
      </div>

      {/* Search */}
      {soundTracks.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            placeholder="Search sounds by title, artist, or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
          />
        </div>
      )}

      {/* Empty State */}
      {soundTracks.length === 0 && (
        <Card className="border-white/5 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Music2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No sounds tracked yet</h3>
            <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
              Start tracking sounds by pasting a TikTok, Instagram Reel, or YouTube Shorts link.
              We'll monitor how the sound performs over time.
            </p>
            <Button onClick={() => onNavigate('/sounds/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Track Your First Sound
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Sound Tracks List */}
      {filteredTracks.length > 0 && (
        <div className="space-y-3">
          {filteredTracks.map((track) => (
            <Card
              key={track.id}
              className="border-white/5 bg-white/5 hover:bg-white/[0.07] transition-colors cursor-pointer"
              onClick={() => onNavigate(`/sounds/${track.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-white/[0.05] flex items-center justify-center">
                      <PlatformIcon platform={track.platform} className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-white truncate">
                          {track.title || 'Untitled Sound'}
                        </h3>
                        {track.artist && (
                          <p className="text-sm text-slate-400 mt-1">{track.artist}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span className="capitalize">{track.platform}</span>
                          {track.total_uses !== null && (
                            <span>{formatNumber(track.total_uses)} uses</span>
                          )}
                          {track.latest_snapshot && (
                            <span>
                              Updated {new Date(track.latest_snapshot.captured_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate(`/sounds/${track.id}`);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* No Results */}
      {soundTracks.length > 0 && filteredTracks.length === 0 && (
        <Card className="border-white/5 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-slate-400">No sounds match your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
