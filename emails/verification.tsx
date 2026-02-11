import { DTTrackerLayout, Paragraph } from "./components/DTTrackerLayout.tsx";
import { Section, Text } from "@react-email/components";
import * as React from "react";

export default function VerificationEmail({
  code = "123456",
}: {
  code?: string;
}) {
  return (
    <DTTrackerLayout
      previewText={`Your verification code is ${code}`}
      heading="Verify your email address"
    >
      <Paragraph className="text-center">
        Enter the following code to verify your email address and sign in to DTTracker.
      </Paragraph>

      <Section className="bg-[#1A1A1A] border border-solid border-[rgba(255,255,255,0.08)] rounded-[12px] p-[28px] my-[24px] text-center">
        <Text className="text-[32px] font-mono font-bold tracking-[8px] m-0 text-white">
          {code}
        </Text>
      </Section>

      <Paragraph className="text-[#64748B] text-[12px] text-center m-0">
        This code expires in 10 minutes. If you didn't request this, safely ignore this email.
      </Paragraph>
    </DTTrackerLayout>
  );
}
