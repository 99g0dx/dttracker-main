import { Music2 } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from './ui/card'

interface CampaignSoundSectionProps {
  campaignId: string
  sound: unknown
  soundVideos: unknown[]
  loading?: boolean
  onAddSound: () => void
  onRemoveSound: () => void
  onRefreshSound: () => void
}

export function CampaignSoundSection({}: CampaignSoundSectionProps) {
  return (
    <Card className="border-white/5 bg-white/5">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Music2 className="h-5 w-5 text-primary" />
          Sound Performance
        </CardTitle>
        <CardDescription className="text-slate-400">
          Track how your campaign sound performs compared to creator posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-10 text-center">
          <Music2 className="h-8 w-8 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white mb-2">Coming Soon</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Sound performance tracking is currently under development.
            You'll soon be able to link sounds and see how they perform across platforms.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
