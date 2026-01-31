import { useState } from "react";
import {
  Loader2,
  Music2,
  Search,
  ArrowRight,
  RefreshCw,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Button } from "./ui/button";
import { supabase } from "../../lib/supabase";
import type { Sound } from "../../lib/types/database";

type Props = {
  onSuccess?: () => void;
  onSoundDetected?: (sound: Sound) => void;
  campaignId?: string;
};

export function SoundIngest({ onSuccess, onSoundDetected, campaignId }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "analyzing" | "indexing" | "detected"
  >("idle");
  const [resolvedSound, setResolvedSound] = useState<Sound | null>(null);

  const handleIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus("analyzing");
    setResolvedSound(null);

    try {
      // Get current session to ensure we have a valid auth token
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Explicitly pass Authorization and apikey headers
      const headers: Record<string, string> = {};
      if (session.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      // Include apikey header (Supabase anon key) for edge function authentication
      // The Supabase client should handle this automatically, but we include it explicitly
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers.apikey = anonKey;
      }

      const { data, error } = await supabase.functions.invoke(
        "sound-tracking",
        {
          body: {
            action: "ingest",
            url: url.trim(),
            campaignId: campaignId,
          },
          headers,
        },
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResolvedSound(data?.sound || null);
      setStatus(
        data?.sound?.indexing_state === "active" ? "detected" : "indexing",
      );
      setUrl("");
      if (onSuccess) onSuccess();
      if (onSoundDetected && data?.sound) {
        onSoundDetected(data.sound);
      }
    } catch (err: any) {
      console.error("Sound ingest failed", err);
      alert(err?.message || "Unable to track that link right now.");
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStatus("idle");
    setResolvedSound(null);
  };

  const deleteCurrentSound = async () => {
    if (!resolvedSound?.id) return;
    if (!confirm("Delete this sound?")) return;

    const { error } = await supabase
      .from("sounds")
      .delete()
      .eq("id", resolvedSound.id);
    if (!error) {
      reset();
      if (onSuccess) onSuccess();
    }
  };

  return (
    <Card className="border-white/5 bg-white/5 shadow-[0_20px_35px_rgba(5,5,5,0.45)]">
      <CardHeader className="items-start gap-4">
        <div>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            Track a Sound
          </CardTitle>
          <CardDescription className="text-sm text-slate-400">
            Paste a TikTok, Instagram Reel, or YouTube Shorts link to let
            DTTracker index sound usage continuously.
          </CardDescription>
        </div>
        {(status === "detected" || status === "indexing") && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="text-white"
            >
              <RefreshCw className="h-3 w-3" />
              Track another
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteCurrentSound}
              disabled={!resolvedSound?.id}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {(status === "idle" || status === "analyzing") && (
          <div className="space-y-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                placeholder="Paste a Reel, TikTok, or Shorts link..."
                className="w-full rounded-xl border border-border bg-input px-3 py-3 pl-11 text-sm text-white placeholder:text-slate-500 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground sm:max-w-sm">
                Sound indexing begins immediately. First insights appear in
                minutes.
              </p>
              <Button
                onClick={handleIngest}
                disabled={loading || !url.trim()}
                className="w-full justify-center sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    Indexing link...
                  </>
                ) : (
                  <>
                    Start Tracking
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        {status !== "idle" && status !== "analyzing" && resolvedSound && (
          <div className="space-y-2 rounded-xl border border-border bg-background/50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Music2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                    Sound detected
                  </p>
                  <h3 className="text-lg font-semibold text-white">
                    {resolvedSound.title || "Original / Unnamed Audio"}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {resolvedSound.artist ||
                      resolvedSound.source ||
                      "Unknown artist or creator"}
                  </p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-3 py-1 text-xs text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Indexing in progress
              </div>
            </div>
            <p className="text-xs text-slate-400">
              We're discovering videos using this sound. This continues
              automatically and updates as new content appears.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-border px-3 py-1">
                Platform:{" "}
                {resolvedSound.platform ? resolvedSound.platform : "Unknown"}
              </span>
              {resolvedSound.sound_page_url && (
                <a
                  href={resolvedSound.sound_page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  View sound page
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
