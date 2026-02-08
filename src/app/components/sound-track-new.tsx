import React, { useState, useEffect } from 'react';
import { ArrowLeft, Music2, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useCreateSoundTrack } from '../../hooks/useSoundTracks';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface SoundTrackNewProps {
  onNavigate: (path: string) => void;
}

export function SoundTrackNew({ onNavigate }: SoundTrackNewProps) {
  const navigate = useNavigate();
  const { activeWorkspaceId } = useWorkspace();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const createMutation = useCreateSoundTrack();

  // Ensure we have a valid workspaceId (fallback to user ID for personal workspace)
  useEffect(() => {
    const getWorkspaceId = async () => {
      if (activeWorkspaceId) {
        setWorkspaceId(activeWorkspaceId);
        return;
      }

      // Fallback: Use user's ID as workspaceId (personal workspace)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('[SoundTrackNew] Using user ID as workspaceId:', user.id);
        setWorkspaceId(user.id);
      } else {
        setError('Please log in to track sounds');
      }
    };

    getWorkspaceId();
  }, [activeWorkspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!workspaceId) {
      setError('No workspace available. Please log in again.');
      return;
    }

    console.log('[SoundTrackNew] Creating sound track with:', { workspaceId, url: url.trim() });

    try {
      const result = await createMutation.mutateAsync({
        workspaceId,
        url: url.trim(),
      });

      if (result?.soundTrackId) {
        navigate(`/sounds/${result.soundTrackId}`);
      }
    } catch (err: any) {
      console.error('[SoundTrackNew] Error creating sound track:', err);
      setError(err?.message || 'Failed to create sound track');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/sounds')}
          className="w-11 h-11 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
          aria-label="Back to sounds"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Track a Sound</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paste a TikTok, Instagram Reel, or YouTube Shorts link
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="border-border/50 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            Sound URL
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            We'll automatically detect the platform and start tracking the sound's performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="url"
                placeholder="https://www.tiktok.com/..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                disabled={createMutation.isPending}
                className="bg-muted/40 border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Supported: TikTok videos/music, Instagram Reels, YouTube Shorts
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {createMutation.isPending && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100/70 dark:bg-blue-500/10 border border-red-200 dark:border-blue-500/20 text-red-700 dark:text-blue-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                <span>Processing sound link...</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={createMutation.isPending || !url.trim()}
                className="flex-1 sm:flex-none"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Music2 className="h-4 w-4 mr-2" />
                    Start Tracking
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate('/sounds')}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-border/50 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base text-foreground">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">1. Paste a link</p>
              <p>Share any TikTok video, Instagram Reel, or YouTube Shorts link</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">2. We resolve the sound</p>
              <p>We extract the sound ID and start tracking its usage across the platform</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-1.5 mt-0.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">3. Continuous monitoring</p>
              <p>We automatically refresh data to show how the sound performs over time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
