import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
  InfoCard,
} from "./components/DTTrackerLayout.tsx";
import * as React from "react";

interface WeeklySummaryEmailProps {
  startDate?: string;
  endDate?: string;
  activeCampaigns?: number;
  totalEngagement?: string;
}

export default function WeeklySummaryEmail({
  startDate = "Oct 16",
  endDate = "Oct 23",
  activeCampaigns = 3,
  totalEngagement = "4.5%",
}: WeeklySummaryEmailProps) {
  return (
    <DTTrackerLayout
      previewText={`Weekly summary: ${startDate} - ${endDate}`}
      heading="Weekly performance"
    >
      <Paragraph>
        Summary of your campaign performance for the week of{" "}
        <strong className="text-white">{startDate} to {endDate}</strong>.
      </Paragraph>

      <InfoCard>
        <InfoRow label="Active Campaigns" value={activeCampaigns.toString()} />
        <InfoRow label="Avg. Engagement" value={totalEngagement} />
      </InfoCard>

      <PrimaryButton href="https://dttracker.app/dashboard">
        View Analytics
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
