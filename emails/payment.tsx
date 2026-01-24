import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
} from "./components/DTTrackerLayout";
import { Section } from "@react-email/components";
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
        We have received your payment for the current billing period. A copy of
        this receipt is available in your account settings.
      </Paragraph>

      <Section className="my-[24px] border border-[#eaeaea] rounded-[8px] p-[16px]">
        <InfoRow label="Plan" value={plan} />
        <InfoRow label="Date" value={date} />
        <InfoRow label="Amount" value={amount} />
      </Section>

      <PrimaryButton href="https://dttracker.app/settings/billing">
        View Invoice
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
