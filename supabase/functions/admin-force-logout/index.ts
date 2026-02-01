import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  user_id?: string;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: Body = await req.json();
    const targetUserId = body.user_id;
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is company admin
    const adminCheck = await fetch(`${supabaseUrl}/rest/v1/rpc/is_company_admin`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: "Admin check failed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminCheckResult = await adminCheck.json();
    const isAdmin = Array.isArray(adminCheckResult)
      ? Boolean(adminCheckResult[0])
      : Boolean(adminCheckResult);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force logout via GoTrue Admin API
    const logoutResp = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${targetUserId}/logout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!logoutResp.ok) {
      const errorText = await logoutResp.text();
      return new Response(
        JSON.stringify({ error: "Logout failed", details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Audit log (best-effort)
    const ipHeader =
      req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
    const userAgent = req.headers.get("user-agent") || "";

    await fetch(`${supabaseUrl}/rest/v1/rpc/log_company_admin_action`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: targetUserId,
        action: "force_logout",
        metadata: {
          ip: ipHeader,
          user_agent: userAgent,
        },
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message || "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
