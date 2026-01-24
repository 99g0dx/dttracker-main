import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
} from "./components/DTTrackerLayout";
import { Section } from "@react-email/components";
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
        Here is a summary of your campaign performance for the week of{" "}
        {startDate} to {endDate}.
      </Paragraph>

      <Section className="my-[24px] border border-[#eaeaea] rounded-[8px] p-[16px]">
        <InfoRow label="Active Campaigns" value={activeCampaigns.toString()} />
        <InfoRow label="Avg. Engagement" value={totalEngagement} />
      </Section>

      <PrimaryButton href="https://dttracker.app/dashboard">
        View Analytics
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
