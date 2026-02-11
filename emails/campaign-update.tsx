import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
  InfoCard,
} from "./components/DTTrackerLayout.tsx";
import * as React from "react";

interface CampaignUpdateEmailProps {
  campaignName?: string;
  newPosts?: number;
  totalViews?: string;
}

export default function CampaignUpdateEmail({
  campaignName = "Q4 Influencer Push",
  newPosts = 12,
  totalViews = "1.2M",
}: CampaignUpdateEmailProps) {
  return (
    <DTTrackerLayout
      previewText={`${newPosts} new posts detected for ${campaignName}`}
      heading="Campaign update"
    >
      <Paragraph>
        New content has been detected for{" "}
        <strong className="text-white">{campaignName}</strong> since the last report.
      </Paragraph>

      <InfoCard>
        <InfoRow label="New Posts" value={newPosts.toString()} />
        <InfoRow label="Total Views" value={totalViews} />
      </InfoCard>

      <PrimaryButton href="https://dttracker.app/campaigns">
        View Campaign
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
