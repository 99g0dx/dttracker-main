import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Use esm.sh for better Deno compatibility
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

serve(async (req) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // ✅ Handle preflight immediately
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Define the helper per your requirement: res.json(data, status, headers)
  const res = {
    json: (data: any, status: number, headers: Record<string, string>) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders, ...headers },
      });
    },
  };

  try {
    // Initialize client inside try-block to catch config errors
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Ensure this is the SERVICE role key
    );

    const { email } = await req.json();

    if (!email || !email.includes("@")) {
      return res.json({ error: "Invalid email" }, 400, { "X-Status": "Validation-Failed" });
    }

    // Use admin.listUsers to check existence
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) throw error;

    const userExists = users.some((u) => u.email === email);

    return res.json({ exists: userExists }, 200, { "Cache-Control": "no-store" });

  } catch (err) {
    return res.json({ error: err.message || "Internal Server Error" }, 500, {});
  }
});