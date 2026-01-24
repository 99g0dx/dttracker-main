import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
} from "./components/DTTrackerLayout";
import { Section } from "@react-email/components";
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
        We've just completed a scrape for <strong>{campaignName}</strong>. New
        content has been detected since the last report.
      </Paragraph>

      <Section className="my-[24px] border border-[#eaeaea] rounded-[8px] p-[16px]">
        <InfoRow label="New Posts" value={newPosts.toString()} />
        <InfoRow label="Total Views" value={totalViews} />
      </Section>

      <PrimaryButton href="https://dttracker.app/campaigns">
        View Campaign
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
