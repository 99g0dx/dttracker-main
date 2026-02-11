import {
  Body,
  Container,
  Head,
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
                brand: "#E8153A",
                bg: "#0A0A0A",
                card: "#111111",
                infobox: "#1A1A1A",
                text: "#FFFFFF",
                muted: "#94A3B8",
                dimmed: "#64748B",
              },
            },
          },
        }}
      >
        <Body className="bg-[#0A0A0A] my-auto mx-auto font-sans antialiased">
          <Container className="bg-[#0A0A0A] my-[40px] mx-auto max-w-[600px]">
            {/* Header with Logo */}
            <Section className="py-[32px] px-[30px] text-center border-b border-solid border-[rgba(255,255,255,0.08)]">
              <Link href="https://dttracker.app">
                <Img
                  src="https://dttracker.app/logo.png"
                  width="140"
                  alt="DTTracker"
                  className="mx-auto block"
                  style={{ display: 'block', margin: '0 auto' }}
                />
              </Link>
            </Section>

            {/* Content */}
            <Section className="px-[30px] py-[40px]">
              {heading && (
                <Text className="text-white text-[24px] font-bold leading-[30px] m-0 mb-[8px] text-center">
                  {heading}
                </Text>
              )}
              {children}
            </Section>

            {/* Footer */}
            <Section className="py-[24px] px-[30px] text-center border-t border-solid border-[rgba(255,255,255,0.08)]">
              <Text className="text-[#64748B] text-[12px] leading-[18px] m-0 mb-[4px]">
                © {new Date().getFullYear()} DTTracker
              </Text>
              <Link
                href="https://dttracker.app"
                className="text-[#64748B] text-[12px] no-underline"
              >
                dttracker.app
              </Link>
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
    className={`text-[#94A3B8] text-[15px] leading-[24px] m-0 mb-[16px] ${className || ""}`}
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
  <Section className="my-[32px] text-center">
    <Link
      href={href}
      className="bg-[#E8153A] text-white rounded-[8px] px-[32px] py-[14px] text-[15px] font-semibold no-underline"
    >
      {children}
    </Link>
  </Section>
);

export const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between py-[10px] border-b border-solid border-[rgba(255,255,255,0.08)] last:border-0">
    <span className="text-[#94A3B8] text-[14px]">{label}</span>
    <span className="text-white text-[14px] font-medium">{value}</span>
  </div>
);

export const InfoCard = ({ children }: { children: React.ReactNode }) => (
  <Section className="bg-[#1A1A1A] border border-solid border-[rgba(255,255,255,0.08)] rounded-[10px] p-[20px] my-[24px]">
    {children}
  </Section>
);

export const Label = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-[#94A3B8] text-[11px] uppercase tracking-[0.8px] font-semibold m-0 mb-[6px]">
    {children}
  </Text>
);

export const Value = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-white text-[16px] font-medium m-0">
    {children}
  </Text>
);
