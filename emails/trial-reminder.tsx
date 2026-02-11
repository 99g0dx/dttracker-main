import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
} from "./components/DTTrackerLayout.tsx";
import * as React from "react";

export default function TrialReminderEmail({
  daysLeft = 3,
  endDate,
}: {
  daysLeft?: number;
  endDate?: string;
}) {
  const displayEndDate = endDate || (() => {
    const d = new Date();
    d.setDate(d.getDate() + daysLeft);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();
  return (
    <DTTrackerLayout
      previewText={`Your Pro trial ends in ${daysLeft} days`}
      heading="Trial ending soon"
    >
      <Paragraph>
        Your 14-day Pro trial will expire in{" "}
        <strong className="text-white">{daysLeft} days</strong>{" "}
        <span className="text-[#64748B]">(by {displayEndDate})</span>.
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
