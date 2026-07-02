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
    const zapiBase = `https://api.z-api.io/instances/${instanceId}/token/${token}`;

    // ---- Build lid → real phone map from group participants ----
    const lidMap: Record<string, string> = {};
    const groupIds = new Set<string>();
    for (const c of convs ?? []) {
      if (c.is_group) {
        const raw = String(c.group_id || c.phone);
        const digits = raw.replace(/-group$/i, '').replace(/@g\.us$/i, '').replace(/\D/g, '');
        if (digits) groupIds.add(`${digits}-group`);
      }
    }
    for (const gid of groupIds) {
      try {
        const r = await fetch(`${zapiBase}/chats/${encodeURIComponent(gid)}`, { headers });
        const j = await r.json().catch(() => ({}));
        const participants = j?.participants || [];
        for (const p of participants) {
          if (p?.lid && p?.phone) {
            const lidKey = String(p.lid).replace(/@lid$/i, '').replace(/\D/g, '');
            const phoneKey = String(p.phone).replace(/\D/g, '');
            if (lidKey && phoneKey) lidMap[lidKey] = phoneKey;
          }
        }
        // Some Z-API responses include participants only via group-metadata
        const r2 = await fetch(`${zapiBase}/group-metadata/${encodeURIComponent(gid)}`, { headers });
        const j2 = await r2.json().catch(() => ({}));
        for (const p of j2?.participants || []) {
          if (p?.lid && p?.phone) {
            const lidKey = String(p.lid).replace(/@lid$/i, '').replace(/\D/g, '');
            const phoneKey = String(p.phone).replace(/\D/g, '');
            if (lidKey && phoneKey) lidMap[lidKey] = phoneKey;
          }
        }
      } catch { /* ignore per group */ }
    }

    const results: any[] = [];
    let updated = 0;

    const fetchPicture = async (phoneParam: string) => {
      const resp = await fetch(
        `${zapiBase}/profile-picture?phone=${encodeURIComponent(phoneParam)}`,
        { headers },
      );
      const data = await resp.json().catch(() => ({}));
      const link = data?.link || data?.imgUrl || data?.url || null;
      const valid = link && typeof link === 'string' && link.startsWith('http');
      return { link: valid ? link : null, raw: data };
    };

    for (const c of targets) {
      try {
        let link: string | null = null;
        let note = '';

        if (c.is_group) {
          const rawId = String(c.group_id || c.phone);
          const digits = rawId.replace(/-group$/i, '').replace(/@g\.us$/i, '').replace(/\D/g, '');
          const candidates = [`${digits}-group`, `${digits}@g.us`];
          for (const cand of candidates) {
            const r = await fetchPicture(cand);
            if (r.link) { link = r.link; break; }
            note = r.raw?.errorMessage || note;
          }
        } else {
          const raw = String(c.phone);
          const isLid = /@lid$/i.test(raw);
          const digits = raw.replace(/@lid$/i, '').replace(/@c\.us$/i, '').replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');

          const tried: string[] = [];

          // 1) If lid, resolve to real phone via participants map
          if (isLid && lidMap[digits]) {
            tried.push(lidMap[digits]);
          }
          // 2) Try chat metadata to resolve lid → phone
          if (isLid) {
            try {
              const r = await fetch(`${zapiBase}/chats/${encodeURIComponent(raw)}`, { headers });
              const j = await r.json().catch(() => ({}));
              const chatPhone = String(j?.phone || '').replace(/\D/g, '');
              if (chatPhone) tried.push(chatPhone);
            } catch { /* ignore */ }
          }
          // 3) Fallback: try raw digits + raw @lid variant
          tried.push(digits);
          if (isLid) tried.push(raw);

          const seen = new Set<string>();
          for (const cand of tried) {
            if (!cand || seen.has(cand)) continue;
            seen.add(cand);
            const r = await fetchPicture(cand);
            if (r.link) { link = r.link; break; }
            note = r.raw?.errorMessage || note;
          }
        }

        if (link) {
          await supabase
            .from('wa_conversations')
            .update({ profile_photo_url: link })
            .eq('id', c.id);
          updated++;
          results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: 'updated' });
        } else {
          results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: note || 'no_photo' });
        }
      } catch (e: any) {
        results.push({ id: c.id, phone: c.phone, is_group: c.is_group, status: 'error', error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ total: targets.length, updated, lidsResolved: Object.keys(lidMap).length, results }, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
