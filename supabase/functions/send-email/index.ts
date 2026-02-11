import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { render } from "@react-email/render";
import { Resend } from "resend";
import * as React from "react";

// Import shared layout so it is bundled (templates depend on it)
import "../../../emails/components/DTTrackerLayout.tsx";
// Import templates
import VerificationEmail from "../../../emails/verification.tsx";
import WelcomeEmail from "../../../emails/welcome.tsx";
import TrialReminderEmail from "../../../emails/trial-reminder.tsx";
import TrialExpiredEmail from "../../../emails/trial-expired.tsx";
import PaymentEmail from "../../../emails/payment.tsx";
import CampaignUpdateEmail from "../../../emails/campaign-update.tsx";
import CreatorRequestEmail from "../../../emails/creator-request.tsx";
import WeeklySummaryEmail from "../../../emails/weekly-summary.tsx";
import SecurityAlertEmail from "../../../emails/security-alert.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { email, type, payload } = await req.json();

    if (!email || !type) {
      throw new Error("Missing email or type");
    }

    let component: React.ReactElement;
    let subject = "";

    switch (type) {
      case "verification":
        component = React.createElement(VerificationEmail, payload);
        subject = "Verify your email address";
        break;
      case "welcome":
        component = React.createElement(WelcomeEmail, payload);
        subject = "Welcome to DTTracker";
        break;
      case "trial-reminder":
        component = React.createElement(TrialReminderEmail, payload);
        subject = "Trial ending soon";
        break;
      case "trial-expired":
        component = React.createElement(TrialExpiredEmail);
        subject = "Your DTTracker Pro trial has ended";
        break;
      case "payment":
        component = React.createElement(PaymentEmail, payload);
        subject = "Payment confirmation";
        break;
      case "campaign-update":
        component = React.createElement(CampaignUpdateEmail, payload);
        subject = "Campaign update";
        break;
      case "creator-request":
        component = React.createElement(CreatorRequestEmail, payload);
        subject = `Creator request ${payload.status || "update"}`;
        break;
      case "weekly-summary":
        component = React.createElement(WeeklySummaryEmail, payload);
        subject = "Weekly performance summary";
        break;
      case "security-alert":
        component = React.createElement(SecurityAlertEmail, payload);
        subject = "New login detected";
        break;
      default:
        throw new Error("Invalid email type");
    }

    const html = render(component);

    const { data, error } = await resend.emails.send({
      from: "DTTracker <system@dttracker.app>",
      to: [email],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
