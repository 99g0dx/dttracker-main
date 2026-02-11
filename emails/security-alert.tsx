import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
  InfoRow,
} from "./components/DTTrackerLayout.tsx";
import { Section } from "@react-email/components";
import * as React from "react";

interface SecurityAlertEmailProps {
  device?: string;
  location?: string;
  ip?: string;
}

export default function SecurityAlertEmail({
  device = "Chrome on macOS",
  location = "San Francisco, CA",
  ip = "192.168.1.1",
}: SecurityAlertEmailProps) {
  return (
    <DTTrackerLayout
      previewText="New login detected for your DTTracker account"
      heading="New login detected"
    >
      <Paragraph>
        We detected a new login to your DTTracker account. If this was you, you
        can ignore this email.
      </Paragraph>

      <Section className="my-[24px] bg-[#1A1A1A] border border-solid border-[rgba(255,255,255,0.08)] rounded-[10px] p-[20px]">
        <InfoRow label="Device" value={device} />
        <InfoRow label="Location" value={location} />
        <InfoRow label="IP Address" value={ip} />
      </Section>

      <Paragraph>
        If you did not authorize this login, secure your account immediately by changing your password.
      </Paragraph>

      <PrimaryButton href="https://dttracker.app/settings/security">
        Secure Account
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
