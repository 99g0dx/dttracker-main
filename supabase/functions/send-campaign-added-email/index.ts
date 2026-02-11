import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailButton, emailInfoBox, emailLabel, emailValue, emailLinkText,
  emailStyles,
} from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CampaignAddedEmailData {
  email: string;
  campaignName: string;
  campaignUrl: string;
  role?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body: CampaignAddedEmailData = await req.json();
    const { email, campaignName, campaignUrl, role } = body;

    if (!email || !campaignName || !campaignUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, campaignName, campaignUrl" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "DTTracker <no-reply@dttracker.app>";
    const roleLabel = role === "viewer" ? "View only" : "Can edit";
    const subject = `You've been added to ${campaignName} on DTTracker`;

    const htmlBody = `${emailHeader()}
        ${emailHeading("You've been added to a campaign")}
        ${emailSubtext(`You now have access to <strong style="color: ${emailStyles.TEXT_PRIMARY};">${campaignName}</strong> on DTTracker.`)}

        ${emailInfoBox(`
          ${emailLabel("Campaign")}
          ${emailValue(campaignName)}
          <div style="margin-top: 16px;">
            ${emailLabel("Your access")}
            ${emailValue(roleLabel)}
          </div>
        `)}

        ${emailButton("Open Campaign", campaignUrl)}
        ${emailLinkText("Open campaign link", campaignUrl)}
${emailFooter()}`;

    const textBody = `
You've been added to a campaign

You now have access to ${campaignName} on DTTracker.
Your access: ${roleLabel}

Open the campaign:
${campaignUrl}
    `.trim();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [email],
        subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      let errorData: Record<string, unknown> = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("Resend API error:", errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send email",
          details: errorData,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendData = await resendResponse.json();
    console.log("Campaign added email sent:", resendData.id);

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-campaign-added-email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
