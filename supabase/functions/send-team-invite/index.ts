import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
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

interface InviteEmailData {
  workspaceId: string;
  email: string;
  inviteToken: string;
  inviterName: string | null;
  role: string;
  message: string | null;
  inviteUrl: string;
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
    // 1. Require a valid JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: InviteEmailData = await req.json();
    const { workspaceId, email, inviteToken, inviterName, role, message, inviteUrl } = body;

    // 2. Require workspaceId and verify the caller is an active workspace member
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !inviteToken || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
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
          message: "Invite created but email not sent. Please configure RESEND_API_KEY."
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "DTTracker <invites@dttracker.app>";

    const roleLabels: Record<string, string> = {
      brand_owner: "Owner",
      agency_admin: "Admin",
      brand_member: "Editor",
      agency_ops: "Viewer",
    };
    const roleLabel = roleLabels[role] || role;

    const subject = `${inviterName ? `${inviterName} ` : ""}invited you to join their workspace on DTTracker`;

    const messageBlock = message ? `
      <div style="margin-top: 16px;">
        ${emailLabel("Message")}
        <p style="color: ${emailStyles.TEXT_PRIMARY}; margin: 6px 0 0 0; font-size: 15px; white-space: pre-wrap; line-height: 1.6;">${message}</p>
      </div>
    ` : "";

    const htmlBody = `${emailHeader()}
        ${emailHeading("You've been invited!")}
        ${emailSubtext(`${inviterName ? `<strong style="color: ${emailStyles.TEXT_PRIMARY};">${inviterName}</strong>` : "Someone"} invited you to join their workspace on DTTracker.`)}

        ${emailInfoBox(`
          ${emailLabel("Role")}
          ${emailValue(roleLabel)}
          ${messageBlock}
        `)}

        ${emailButton("Accept Invitation", inviteUrl)}
        ${emailLinkText("Accept invitation link", inviteUrl)}

        <p style="color: ${emailStyles.TEXT_MUTED}; font-size: 12px; text-align: center; margin-top: 32px;">
          This invitation will expire in 7 days.
        </p>
${emailFooter()}`;

    const textBody = `
You've been invited!

${inviterName ? `${inviterName} ` : "Someone "}invited you to join their workspace on DTTracker.

Role: ${roleLabel}
${message ? `\nMessage:\n${message}\n` : ""}

Accept your invitation by clicking this link:
${inviteUrl}

This invitation will expire in 7 days.
    `.trim();

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [email],
        subject: subject,
        html: htmlBody,
        text: textBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error("Resend API error:", {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        error: errorData,
      });

      const errorMessage = errorData.message || errorData.error?.message || "Failed to send email";

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send email",
          details: errorData,
          message: `Invite created but email sending failed: ${errorMessage}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendData = await resendResponse.json();
    console.log("Email sent successfully:", resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation email sent successfully",
        emailId: resendData.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-team-invite function:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Invite created but email sending failed.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
