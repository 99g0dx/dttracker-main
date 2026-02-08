import { Music2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface SoundsProps {
  onNavigate: (path: string) => void;
}

export function Sounds({ onNavigate }: SoundsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sound Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track how sounds perform across TikTok, Instagram, and YouTube
        </p>
      </div>

      <Card className="border-border/50 bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-20 px-4">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Music2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Coming Soon</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Sound tracking is currently under development. You'll soon be able to track
            how sounds perform across TikTok, Instagram, and YouTube.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
