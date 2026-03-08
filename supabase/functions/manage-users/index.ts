import { createClient } from "npm:@supabase/supabase-js@2";

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Acesso negado. Somente administradores." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, full_name, role, phone } = body;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (newUser?.user) {
        if (role) {
          await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role });
        }
        if (phone) {
          await supabaseAdmin.from("profiles").update({ phone }).eq("user_id", newUser.user.id);
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser?.user?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { user_id, full_name, role, avatar_url, phone, cep, address_street, address_number, address_complement, neighborhood, city, state, country, emergency_contact_name, emergency_contact_phone, health_plan } = body;

      const profileUpdate: Record<string, any> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (avatar_url !== undefined) profileUpdate.avatar_url = avatar_url;
      if (phone !== undefined) profileUpdate.phone = phone;
      if (cep !== undefined) profileUpdate.cep = cep;
      if (address_street !== undefined) profileUpdate.address_street = address_street;
      if (address_number !== undefined) profileUpdate.address_number = address_number;
      if (address_complement !== undefined) profileUpdate.address_complement = address_complement;
      if (neighborhood !== undefined) profileUpdate.neighborhood = neighborhood;
      if (city !== undefined) profileUpdate.city = city;
      if (state !== undefined) profileUpdate.state = state;
      if (country !== undefined) profileUpdate.country = country;
      if (emergency_contact_name !== undefined) profileUpdate.emergency_contact_name = emergency_contact_name;
      if (emergency_contact_phone !== undefined) profileUpdate.emergency_contact_phone = emergency_contact_phone;
      if (health_plan !== undefined) profileUpdate.health_plan = health_plan;
      
      if (Object.keys(profileUpdate).length > 0) {
        await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", user_id);
        if (full_name) {
          await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: { full_name } });
        }
      }

      if (role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
        await supabaseAdmin.from("user_roles").insert({ user_id, role });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "change_password") {
      const { user_id, new_password } = body;

      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
      if (pwError) {
        return new Response(JSON.stringify({ error: pwError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;

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
    console.error("manage-users error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
