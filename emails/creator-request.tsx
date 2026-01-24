import {
  DTTrackerLayout,
  Paragraph,
  PrimaryButton,
} from "./components/DTTrackerLayout";
import * as React from "react";

interface CreatorRequestEmailProps {
  creatorName?: string;
  status?: "approved" | "rejected";
}

export default function CreatorRequestEmail({
  creatorName = "@creatortest",
  status = "approved",
}: CreatorRequestEmailProps) {
  const isApproved = status === "approved";

  return (
    <DTTrackerLayout
      previewText={`Creator request ${status}: ${creatorName}`}
      heading={`Creator request ${status}`}
    >
      <Paragraph>
        The request to add <strong>{creatorName}</strong> to the Creator Library
        has been {status}.
      </Paragraph>

      {isApproved ? (
        <Paragraph>
          Data collection has started. You can now add this creator to your
          campaigns.
        </Paragraph>
      ) : (
        <Paragraph>
          We were unable to verify this creator account. Please check the
          username and try again, or contact support if you believe this is an
          error.
        </Paragraph>
      )}

      <PrimaryButton href="https://dttracker.app/creators">
        {isApproved ? "View Creator" : "Go to Library"}
      </PrimaryButton>
    </DTTrackerLayout>
  );
}
