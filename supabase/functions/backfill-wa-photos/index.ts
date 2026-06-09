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

    let force = false;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        force = !!body?.force;
      }
    } catch { /* ignore */ }

    const { data: convs, error } = await supabase
      .from('wa_conversations')
      .select('id, phone, profile_photo_url, is_group');
    if (error) throw error;

    const targets = (convs ?? []).filter(
      (c: any) => !c.is_group && c.phone && (force || !c.profile_photo_url),
    );

    const headers: Record<string, string> = clientToken ? { 'Client-Token': clientToken } : {};
    const results: any[] = [];
    let updated = 0;

    for (const c of targets) {
      const clean = String(c.phone).replace(/\D/g, '');
      try {
        const resp = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${clean}`,
          { headers },
        );
        const data = await resp.json().catch(() => ({}));
        const link: string | null = data?.link || data?.imgUrl || data?.url || null;
        if (link && typeof link === 'string' && link.startsWith('http')) {
          await supabase
            .from('wa_conversations')
            .update({ profile_photo_url: link })
            .eq('id', c.id);
          updated++;
          results.push({ phone: c.phone, status: 'updated' });
        } else {
          results.push({ phone: c.phone, status: 'no_photo' });
        }
      } catch (e: any) {
        results.push({ phone: c.phone, status: 'error', error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ total: targets.length, updated, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
