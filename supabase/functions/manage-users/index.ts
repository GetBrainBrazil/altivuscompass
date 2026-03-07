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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Somente administradores." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...payload } = await req.json();

    if (action === "create") {
      const { email, password, full_name, role } = payload;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Assign role
      if (newUser?.user && role) {
        await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser?.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = payload;

      // Prevent self-deletion
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode remover a si mesmo." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
