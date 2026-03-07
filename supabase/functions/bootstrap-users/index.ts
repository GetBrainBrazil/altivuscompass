import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Check if users already exist
    const { data: existingProfiles } = await supabaseAdmin.from("profiles").select("email");
    const existingEmails = (existingProfiles ?? []).map((p: any) => p.email);

    const users = [
      { email: "rodrigo@altivusturismo.com.br", full_name: "Rodrigo", role: "admin" },
      { email: "camile@altivusturismo.com.br", full_name: "Camile", role: "admin" },
      { email: "ana.souza@altivusturismo.com.br", full_name: "Ana Souza", role: "sales_agent" },
    ];

    const results = [];

    for (const u of users) {
      if (existingEmails.includes(u.email)) {
        results.push({ email: u.email, status: "already_exists" });
        continue;
      }

      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: "Altivus@2026",
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });

      if (error) {
        results.push({ email: u.email, status: "error", message: error.message });
        continue;
      }

      if (newUser?.user) {
        await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: u.role });
        results.push({ email: u.email, status: "created", role: u.role });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
