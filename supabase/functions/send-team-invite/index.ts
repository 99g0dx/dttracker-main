import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailData {
  email: string;
  inviteToken: string;
  inviterName: string | null;
  role: string;
  message: string | null;
  inviteUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    const body: InviteEmailData = await req.json();
    const { email, inviteToken, inviterName, role, message, inviteUrl } = body;

    if (!email || !inviteToken || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      // Return success even if email fails (don't block invite creation)
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

    // Get From email address from environment, fallback to default
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "DTTracker <no-reply@dttracker.app>";

    // Get role label
    const roleLabels: Record<string, string> = {
      owner: "Owner",
      admin: "Admin",
      member: "Member",
      viewer: "Viewer",
    };
    const roleLabel = roleLabels[role] || role;

    // Email subject
    const subject = `${inviterName ? `${inviterName} ` : ""}invited you to join their workspace on DTTracker`;

    // Email HTML body
    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #0A0A0A; border-radius: 8px; padding: 40px; text-align: center;">
            <h1 style="color: #fff; margin-bottom: 10px;">You've been invited!</h1>
            <p style="color: #94a3b8; margin-bottom: 30px;">${inviterName ? `${inviterName} ` : "Someone "}invited you to join their workspace on DTTracker.</p>
            
            <div style="background-color: #0D0D0D; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 20px; margin: 30px 0; text-align: left;">
              <div style="margin-bottom: 15px;">
                <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Role</strong>
                <p style="color: #fff; margin: 5px 0 0 0; font-size: 16px;">${roleLabel}</p>
              </div>
              ${message ? `
              <div style="margin-top: 20px;">
                <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</strong>
                <p style="color: #fff; margin: 5px 0 0 0; white-space: pre-wrap;">${message}</p>
              </div>
              ` : ""}
            </div>
            
            <a href="${inviteUrl}" style="display: inline-block; background-color: #00f5ff; color: #000; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; margin: 20px 0;">
              Accept Invitation
            </a>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #00f5ff; word-break: break-all;">${inviteUrl}</a>
            </p>
            
            <p style="color: #64748b; font-size: 12px; margin-top: 40px;">
              This invitation will expire in 7 days.
            </p>
          </div>
        </body>
      </html>
    `;

    // Plain text version
    const textBody = `
You've been invited!

${inviterName ? `${inviterName} ` : "Someone "}invited you to join their workspace on DTTracker.

Role: ${roleLabel}
${message ? `\nMessage:\n${message}\n` : ""}

Accept your invitation by clicking this link:
${inviteUrl}

This invitation will expire in 7 days.
    `.trim();

    // Send email via Resend API
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
      
      // Return more specific error message
      const errorMessage = errorData.message || errorData.error?.message || "Failed to send email";
      
      // Return success even if email fails (don't block invite creation)
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
    
    // Return success even if email fails (don't block invite creation)
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

