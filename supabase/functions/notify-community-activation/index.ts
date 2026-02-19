import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  emailHeader, emailFooter, emailHeading, emailSubtext,
  emailButton, emailInfoBox, emailLabel, emailValue,
  emailStyles, emailDivider,
} from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "DTTracker <notifications@dttracker.app>";
    const dobbleTapAppUrl = Deno.env.get("DOBBLE_TAP_APP_URL") || "https://www.dobbletap.com";
    const siteUrl = Deno.env.get("SITE_URL") || "https://dttracker.app";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth: JWT or SYNC_API_KEY
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const syncApiKey = Deno.env.get("SYNC_API_KEY") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (syncApiKey && token === syncApiKey) {
      // API key auth — ok
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { activationId, workspaceId } = body;

    if (!activationId || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "activationId and workspaceId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch activation
    const { data: activation, error: activationError } = await supabase
      .from("activations")
      .select("id, title, brief, deadline, type, task_type, platforms, total_budget, prize_structure, visibility, community_fan_ids, dobble_tap_activation_id")
      .eq("id", activationId)
      .single();

    if (activationError || !activation) {
      return new Response(
        JSON.stringify({ error: "Activation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch workspace name
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    const workspaceName = workspace?.name || "A brand";

    // Fetch targeted fans
    let fansQuery = supabase
      .from("community_fans")
      .select("id, name, handle, platform, email, dobble_tap_user_id, creator_id")
      .eq("workspace_id", workspaceId);

    const communityFanIds = activation.community_fan_ids;
    if (Array.isArray(communityFanIds) && communityFanIds.length > 0) {
      fansQuery = fansQuery.in("id", communityFanIds);
    }

    const { data: fans, error: fansError } = await fansQuery;

    if (fansError || !fans || fans.length === 0) {
      return new Response(
        JSON.stringify({ error: "No community fans found", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Filter fans with valid emails
    const fansWithEmail = fans.filter(
      (f: any) => f.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)
    );

    if (fansWithEmail.length === 0) {
      return new Response(
        JSON.stringify({ error: "No fans with valid email addresses", sent: 0, total: fans.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check which fans already got notified for this activation
    const { data: existingNotifications } = await supabase
      .from("community_fan_notifications")
      .select("community_fan_id")
      .eq("activation_id", activationId)
      .eq("status", "sent");

    const alreadyNotifiedIds = new Set(
      (existingNotifications || []).map((n: any) => n.community_fan_id)
    );

    const fansToNotify = fansWithEmail.filter(
      (f: any) => !alreadyNotifiedIds.has(f.id)
    );

    if (fansToNotify.length === 0) {
      return new Response(
        JSON.stringify({ message: "All fans already notified", sent: 0, already_notified: alreadyNotifiedIds.size }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // For fans without a direct dobble_tap_user_id, fall back to the creators table
    const fansWithoutDtId = fansToNotify.filter((f: any) => !f.dobble_tap_user_id && f.creator_id);
    let creatorDtMap: Record<string, string> = {};
    if (fansWithoutDtId.length > 0) {
      const creatorIds = fansWithoutDtId.map((f: any) => f.creator_id);
      const { data: creators } = await supabase
        .from("creators")
        .select("id, dobble_tap_user_id")
        .in("id", creatorIds)
        .not("dobble_tap_user_id", "is", null);

      if (creators) {
        creatorDtMap = Object.fromEntries(
          creators.map((c: any) => [c.id, c.dobble_tap_user_id])
        );
      }
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured — skipping emails");
      return new Response(
        JSON.stringify({ error: "Email service not configured", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build activation info
    const taskTypeLabels: Record<string, string> = {
      post: "Create a Post",
      story: "Share a Story",
      repost: "Repost Content",
      like: "Like a Post",
      comment: "Leave a Comment",
      share: "Share Content",
    };
    const taskLabel = taskTypeLabels[activation.task_type || ""] || activation.task_type || "Participate";
    const deadlineStr = activation.deadline
      ? new Date(activation.deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const platformStr = Array.isArray(activation.platforms)
      ? activation.platforms.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ")
      : "";

    let sentCount = 0;
    let failedCount = 0;
    const notificationRecords: any[] = [];

    // Send in batches
    for (let i = 0; i < fansToNotify.length; i += BATCH_SIZE) {
      const batch = fansToNotify.slice(i, i + BATCH_SIZE);

      const emailPromises = batch.map(async (fan: any) => {
        const hasDtAccount = fan.dobble_tap_user_id || (fan.creator_id && creatorDtMap[fan.creator_id]);
        const dtActivationId = activation.dobble_tap_activation_id;

        // Determine CTA
        let ctaText: string;
        let ctaUrl: string;

        if (hasDtAccount && dtActivationId) {
          ctaText = "View on Dobble Tap";
          ctaUrl = `${dobbleTapAppUrl}/activations/${dtActivationId}`;
        } else if (hasDtAccount) {
          ctaText = "Open Dobble Tap";
          ctaUrl = dobbleTapAppUrl;
        } else {
          // No DT account — generate connect token for signup
          let connectTokenValue: string | null = null;
          try {
            const { data: existingToken } = await supabase
              .from("community_fan_connect_tokens")
              .select("token")
              .eq("community_fan_id", fan.id)
              .eq("status", "pending")
              .gt("expires_at", new Date().toISOString())
              .maybeSingle();

            if (existingToken) {
              connectTokenValue = existingToken.token;
            } else {
              const newToken = crypto.randomUUID();
              await supabase.from("community_fan_connect_tokens").insert({
                community_fan_id: fan.id,
                workspace_id: workspaceId,
                token: newToken,
                status: "pending",
              });
              connectTokenValue = newToken;
            }
          } catch (err) {
            console.error("Failed to create connect token:", err);
          }

          ctaText = "Sign Up to Participate";
          const signupParams = new URLSearchParams({
            email: fan.email,
            ...(fan.handle ? { handle: fan.handle } : {}),
            ...(fan.platform ? { platform: fan.platform } : {}),
            ...(connectTokenValue ? { community_token: connectTokenValue } : {}),
            ref: "dttracker",
            workspace_id: workspaceId,
          });
          ctaUrl = `${dobbleTapAppUrl}/signup?${signupParams.toString()}`;
        }

        // Build email HTML
        const subject = `You're invited to participate: ${activation.title}`;

        const infoRows = [
          `${emailLabel("What's Required")}${emailValue(taskLabel)}`,
          platformStr ? `<div style="margin-top: 12px;">${emailLabel("Platforms")}${emailValue(platformStr)}</div>` : "",
          deadlineStr ? `<div style="margin-top: 12px;">${emailLabel("Deadline")}${emailValue(deadlineStr)}</div>` : "",
          activation.total_budget ? `<div style="margin-top: 12px;">${emailLabel("Budget")}${emailValue(`₦${Number(activation.total_budget).toLocaleString()}`)}</div>` : "",
        ].filter(Boolean).join("");

        const htmlBody = `${emailHeader()}
          ${emailHeading(`You're invited to participate!`)}
          ${emailSubtext(`<strong style="color: ${emailStyles.TEXT_PRIMARY};">${workspaceName}</strong> has a new activation for you.`)}

          <h2 style="color: ${emailStyles.TEXT_PRIMARY}; font-size: 18px; font-weight: 600; margin: 24px 0 8px 0; text-align: center;">${activation.title}</h2>
          ${activation.brief ? `<p style="color: ${emailStyles.TEXT_SECONDARY}; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 20px 0;">${activation.brief}</p>` : ""}

          ${emailInfoBox(infoRows)}

          ${emailButton(ctaText, ctaUrl)}

          ${!hasDtAccount ? `
            ${emailDivider()}
            <p style="color: ${emailStyles.TEXT_MUTED}; font-size: 13px; text-align: center;">
              You'll need a Dobble Tap account to participate. Click the button above to get started.
            </p>
          ` : ""}
${emailFooter()}`;

        const textBody = `
You're invited to participate!

${workspaceName} has a new activation for you.

${activation.title}
${activation.brief || ""}

What's Required: ${taskLabel}
${platformStr ? `Platforms: ${platformStr}` : ""}
${deadlineStr ? `Deadline: ${deadlineStr}` : ""}
${activation.total_budget ? `Budget: ₦${Number(activation.total_budget).toLocaleString()}` : ""}

${ctaText}: ${ctaUrl}
${!hasDtAccount ? "\nYou'll need a Dobble Tap account to participate." : ""}
        `.trim();

        try {
          const resendResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: resendFromEmail,
              to: [fan.email],
              subject,
              html: htmlBody,
              text: textBody,
            }),
          });

          if (resendResponse.ok) {
            sentCount++;
            notificationRecords.push({
              community_fan_id: fan.id,
              activation_id: activationId,
              workspace_id: workspaceId,
              email_sent_to: fan.email,
              status: "sent",
            });
          } else {
            const errText = await resendResponse.text();
            console.error(`Failed to send to ${fan.email}:`, errText);
            failedCount++;
            notificationRecords.push({
              community_fan_id: fan.id,
              activation_id: activationId,
              workspace_id: workspaceId,
              email_sent_to: fan.email,
              status: "failed",
              error_message: errText.slice(0, 500),
            });
          }
        } catch (err) {
          console.error(`Error sending to ${fan.email}:`, err);
          failedCount++;
          notificationRecords.push({
            community_fan_id: fan.id,
            activation_id: activationId,
            workspace_id: workspaceId,
            email_sent_to: fan.email,
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          });
        }
      });

      await Promise.all(emailPromises);
    }

    // Log notification records
    if (notificationRecords.length > 0) {
      await supabase.from("community_fan_notifications").insert(notificationRecords);
    }

    // Update last_notified_at for sent fans
    const sentFanIds = notificationRecords
      .filter((n) => n.status === "sent")
      .map((n) => n.community_fan_id);

    if (sentFanIds.length > 0) {
      await supabase
        .from("community_fans")
        .update({ last_notified_at: new Date().toISOString() })
        .in("id", sentFanIds);
    }

    console.log("Community activation notification complete:", {
      activationId,
      total_fans: fans.length,
      with_email: fansWithEmail.length,
      already_notified: alreadyNotifiedIds.size,
      sent: sentCount,
      failed: failedCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        skipped_no_email: fans.length - fansWithEmail.length,
        already_notified: alreadyNotifiedIds.size,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in notify-community-activation:", error instanceof Error ? error.message : String(error));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
