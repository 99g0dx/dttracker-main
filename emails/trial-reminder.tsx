import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
} from "./components/DTTrackerLayout";
import * as React from "react";

export default function TrialReminderEmail({
  daysLeft = 3,
}: {
  daysLeft?: number;
}) {
  return (
    <DTTrackerLayout
      previewText={`Your Pro trial ends in ${daysLeft} days`}
      heading="Trial ending soon"
    >
      <Paragraph>
        Your 14-day Pro trial will expire in <strong>{daysLeft} days</strong>.
      </Paragraph>
      <Paragraph>
        To ensure uninterrupted tracking of your campaigns and creators, please
        add a payment method or select a plan before the trial ends.
      </Paragraph>

      <PrimaryButton href="https://dttracker.app/subscription">
        Manage Subscription
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
