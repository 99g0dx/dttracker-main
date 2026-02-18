import { Music2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Badge } from "./ui/badge";

interface CampaignSoundSectionProps {
  campaignId: string;
  workspaceId: string | null;
  soundTrack: unknown;
  snapshots: unknown[];
  scrapeJob: unknown;
  scrapeVideos: unknown[];
  scrapeStats: unknown;
  soundPerformance?: unknown[];
  loading?: boolean;
  refreshPending?: boolean;
  onAddSound: () => void;
  onRemoveSound: () => void;
  onRefreshSound: () => void;
}

export function CampaignSoundSection(_props: CampaignSoundSectionProps) {
  return (
    <Card className="border-white/5 bg-white/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Music2 className="h-5 w-5 text-primary" />
            Sound Performance
          </CardTitle>
          <Badge
            variant="outline"
            className="border-primary/30 text-primary text-xs"
          >
            Coming Soon
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Track how your campaign sound performs across platforms — launching
          soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-10 text-center">
          <Music2 className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">
            Sound Tracking
          </h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Link a TikTok or Instagram sound to track its performance, see how
            many creators are using it, and analyze top-performing videos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
