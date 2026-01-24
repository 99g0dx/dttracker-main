import { DTTrackerLayout, Paragraph } from "./components/DTTrackerLayout";
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
      <Paragraph>
        Enter the following code to verify your email address and sign in to
        DTTracker.
      </Paragraph>

      <Section className="bg-[#f4f4f4] rounded-[8px] p-[24px] my-[24px] text-center">
        <Text className="text-[32px] font-mono font-bold tracking-[8px] m-0 text-[#171717]">
          {code}
        </Text>
      </Section>

      <Paragraph className="text-[#666666] text-[12px]">
        This code will expire in 10 minutes. If you didn't request this, you can
        safely ignore this email.
      </Paragraph>
    </DTTrackerLayout>
  );
}
