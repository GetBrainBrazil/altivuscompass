// Public endpoint that runs "complete" / "snooze" for a reminder via a short code.
// Called by the React page at /r/:code (POST { code }).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Accept code via JSON body (POST) or query param (?c=)
  let code: string | null = null
  if (req.method === 'POST') {
    try {
      const body = await req.json()
      code = body?.code ?? null
    } catch {}
  }
  if (!code) {
    const url = new URL(req.url)
    code = url.searchParams.get('c')
  }
  if (!code) return json({ ok: false, error: 'code ausente' }, 400)

  const { data: row } = await supabase
    .from('task_reminder_action_codes')
    .select('code, reminder_id, action, minutes, used_at, expires_at')
    .eq('code', code)
    .maybeSingle()

  if (!row) return json({ ok: false, error: 'Código inválido' }, 404)
  if (row.used_at) {
    return json({ ok: true, alreadyUsed: true, action: row.action })
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: 'Código expirado' }, 410)
  }

  const { data: r } = await supabase
    .from('task_reminders')
    .select('id, task_id, user_id, channels, message')
    .eq('id', row.reminder_id)
    .maybeSingle()
  if (!r) return json({ ok: false, error: 'Lembrete não encontrado' }, 404)

  let taskTitle: string | null = null
  const { data: t } = await supabase.from('tasks').select('title').eq('id', r.task_id).maybeSingle()
  taskTitle = t?.title ?? null

  if (row.action === 'complete') {
    await Promise.all([
      supabase
        .from('tasks')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', r.task_id),
      supabase
        .from('task_reminders')
        .update({ is_read: true })
        .eq('task_id', r.task_id)
        .eq('is_read', false),
    ])
  } else if (row.action === 'snooze') {
    const minutes = row.minutes ?? 30
    const next = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await Promise.all([
      supabase.from('task_reminders').insert({
        task_id: r.task_id,
        user_id: r.user_id,
        remind_at: next,
        channels: r.channels?.length ? r.channels : ['system'],
        message: r.message,
        status: 'pending',
      }),
      supabase
        .from('task_reminders')
        .update({ is_read: true, status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', r.id),
    ])
  } else {
    return json({ ok: false, error: 'Ação desconhecida' }, 400)
  }

  await supabase
    .from('task_reminder_action_codes')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)

  return json({
    ok: true,
    action: row.action,
    minutes: row.minutes,
    taskTitle,
    taskId: r.task_id,
  })
})
