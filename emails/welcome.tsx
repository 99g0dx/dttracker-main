import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
} from "./components/DTTrackerLayout";
import * as React from "react";

export default function WelcomeEmail({ name = "Creator" }: { name?: string }) {
  return (
    <DTTrackerLayout
      previewText="Welcome to DTTracker. Your Pro trial is active."
      heading="Welcome to DTTracker"
    >
      <Paragraph>Hello {name},</Paragraph>
      <Paragraph>
        Your account has been created and your <strong>14-day Pro trial</strong>{" "}
        is now active. You have full access to all features, including advanced
        campaign tracking and automated scraping.
      </Paragraph>
      <Paragraph>
        No credit card is required during the trial. We will notify you before
        your trial expires.
      </Paragraph>

      <PrimaryButton href="https://dttracker.app/dashboard">
        Go to Dashboard
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
