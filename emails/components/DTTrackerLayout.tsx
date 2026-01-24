import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

interface DTTrackerLayoutProps {
  previewText: string;
  heading?: string;
  children: React.ReactNode;
}

export const DTTrackerLayout = ({
  previewText,
  heading,
  children,
}: DTTrackerLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: "#000000",
                offwhite: "#fafafa",
                border: "#eaeaea",
                text: "#171717",
                muted: "#666666",
              },
            },
          },
        }}
      >
        <Body className="bg-white my-auto mx-auto font-sans antialiased">
          <Container className="border border-solid border-[#eaeaea] rounded-[8px] my-[40px] mx-auto p-[20px] max-w-[465px]">
            {/* Header */}
            <Section className="mt-[12px] mb-[24px]">
              <Img
                src="https://dttracker.app/static/logo-black.png" // Replace with actual asset URL
                width="32"
                height="32"
                alt="DTTracker"
                className="my-0"
              />
            </Section>

            {/* Optional Heading */}
            {heading && (
              <Text className="text-black text-[20px] font-semibold leading-[24px] m-0 mb-[24px]">
                {heading}
              </Text>
            )}

            {/* Main Content */}
            <Section>{children}</Section>

            {/* Footer */}
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Section>
              <Text className="text-[#666666] text-[12px] leading-[20px] m-0">
                © 2024 DTTracker Inc.
                <br />
                123 Market Street, San Francisco, CA 94105
              </Text>
              <Text className="text-[#666666] text-[12px] leading-[20px] mt-[12px]">
                You are receiving this email because you have an account on
                DTTracker.
                <br />
                <Link
                  href="{{unsubscribe_url}}"
                  className="text-[#666666] underline"
                >
                  Unsubscribe
                </Link>
                {" • "}
                <Link
                  href="https://dttracker.app/settings"
                  className="text-[#666666] underline"
                >
                  Account Settings
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export const Paragraph = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <Text
    className={`text-[#171717] text-[14px] leading-[24px] m-0 mb-[16px] ${className || ""}`}
  >
    {children}
  </Text>
);

export const PrimaryButton = ({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) => (
  <Section className="my-[24px]">
    <Link
      href={href}
      className="bg-[#000000] text-white rounded-[6px] px-[20px] py-[12px] text-[14px] font-medium no-underline text-center block w-full"
    >
      {children}
    </Link>
  </Section>
);

export const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-[8px] border-b border-[#eaeaea] last:border-0">
    <span className="text-[#666666] text-[14px]">{label}</span>
    <span className="text-[#171717] text-[14px] font-medium">{value}</span>
  </div>
);
