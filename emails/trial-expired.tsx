import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
} from "./components/DTTrackerLayout";
import * as React from "react";

export default function TrialExpiredEmail() {
  return (
    <DTTrackerLayout
      previewText="Your DTTracker Pro trial has ended"
      heading="Trial expired"
    >
      <Paragraph>
        Your 14-day Pro trial has ended. Your campaigns have stopped scraping,
        and you can no longer add new creators.
      </Paragraph>
      <Paragraph>
        <strong>Your data is safe.</strong> We will retain your historical
        campaign data, but you must upgrade to a paid plan to resume tracking
        and access new insights.
      </Paragraph>

      <PrimaryButton href="https://dttracker.app/subscription">
        Upgrade Plan
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
