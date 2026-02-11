import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
  InfoCard,
} from "./components/DTTrackerLayout.tsx";
import * as React from "react";

interface PaymentEmailProps {
  amount?: string;
  date?: string;
  plan?: string;
}

export default function PaymentEmail({
  amount = "$49.00",
  date = "Oct 24, 2023",
  plan = "Pro Plan (Monthly)",
}: PaymentEmailProps) {
  return (
    <DTTrackerLayout
      previewText={`Receipt for ${amount}`}
      heading="Payment confirmation"
    >
      <Paragraph>
        Thank you for your payment. Your receipt for the current billing period is below. A copy is also available in your account settings.
      </Paragraph>

      <InfoCard>
        <InfoRow label="Plan" value={plan} />
        <InfoRow label="Date" value={date} />
        <InfoRow label="Amount" value={amount} />
      </InfoCard>

      <PrimaryButton href="https://dttracker.app/settings/billing">
        View Invoice
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
