import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const res = {
    json: (data: any, status: number, headers: Record<string, string>) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders, ...headers },
      });
    },
  };

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return res.json({ error: "Invalid email" }, 400, { "X-Status": "Validation-Failed" });
    }

    // 1. Fetch users using the admin SDK
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    // 2. Find the user
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    // 3. Return both existence and confirmation status
    // !!user converts the object to true/false
    // !!user.email_confirmed_at checks if the timestamp exists
    return res.json({ 
      exists: !!user, 
      isConfirmed: !!user?.email_confirmed_at 
    }, 200, { "Cache-Control": "no-store" });

  } catch (err: any) {
    return res.json({ error: err.message || "Internal Server Error" }, 500, {});
  }
});