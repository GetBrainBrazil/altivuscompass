import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_SECURITY_TOKEN');
    if (!instanceId || !token) {
      return new Response(JSON.stringify({ error: 'Z-API not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: convs, error } = await supabase
      .from('wa_conversations')
      .select('id, phone, contact_name');
    if (error) throw error;

    const targets = (convs ?? []).filter(
      (c: any) => !c.contact_name || c.contact_name === '' || c.contact_name === c.phone,
    );

    const results: any[] = [];
    for (const c of targets) {
      const clean = String(c.phone).replace(/\D/g, '');
      try {
        const resp = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/contacts/${clean}`,
          { headers: clientToken ? { 'Client-Token': clientToken } : {} },
        );
        const data = await resp.json().catch(() => ({}));
        const name =
          data?.name ||
          data?.pushname ||
          data?.notify ||
          data?.short ||
          data?.vname ||
          null;
        if (name && typeof name === 'string' && name.trim()) {
          await supabase
            .from('wa_conversations')
            .update({ contact_name: name.trim() })
            .eq('id', c.id);
          results.push({ phone: c.phone, name: name.trim(), status: 'updated' });
        } else {
          results.push({ phone: c.phone, status: 'no_name', raw: data });
        }
      } catch (e: any) {
        results.push({ phone: c.phone, status: 'error', error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ total: targets.length, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
