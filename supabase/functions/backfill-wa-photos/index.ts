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
      .select('id, phone, profile_photo_url, is_group, group_id');
    if (error) throw error;

    const targets = (convs ?? []).filter(
      (c: any) => c.phone && (force || !c.profile_photo_url),
    );

    const headers: Record<string, string> = clientToken ? { 'Client-Token': clientToken } : {};
    const results: any[] = [];
    let updated = 0;

    for (const c of targets) {
      try {
        let link: string | null = null;

        if (c.is_group) {
          const rawId = String(c.group_id || c.phone);
          const digits = rawId.replace(/-group$/i, '').replace(/@g\.us$/i, '').replace(/\D/g, '');
          // Z-API: foto do grupo vem do endpoint profile-picture usando o ID com -group
          const candidates = [`${digits}-group`, `${digits}@g.us`];
          let data: any = null;
          for (const cand of candidates) {
            const resp = await fetch(
              `https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${encodeURIComponent(cand)}`,
              { headers },
            );
            data = await resp.json().catch(() => ({}));
            if (data?.link || data?.imgUrl || data?.url) break;
          }
          link = data?.link || data?.imgUrl || data?.url || null;
        } else {
          const clean = String(c.phone).replace(/\D/g, '');
          const resp = await fetch(
            `https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${clean}`,
            { headers },
          );
          const data = await resp.json().catch(() => ({}));
          link = data?.link || data?.imgUrl || data?.url || null;
        }

        if (link && typeof link === 'string' && link.startsWith('http')) {
          await supabase
            .from('wa_conversations')
            .update({ profile_photo_url: link })
            .eq('id', c.id);
          updated++;
          results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: 'updated' });
        } else {
          results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: 'no_photo' });
        }
      } catch (e: any) {
        results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: 'error', error: e.message });
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
