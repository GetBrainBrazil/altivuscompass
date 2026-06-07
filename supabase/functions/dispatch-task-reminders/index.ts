// Dispatch worker for task reminders (multi-channel)
// Runs every minute via pg_cron and sends WhatsApp / Email for due reminders.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const FUNCTIONS_BASE = `${Deno.env.get('SUPABASE_URL')}/functions/v1/task-reminder-action`

function b64urlEncode(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)),
  )
  return b64urlEncode(sig)
}
async function signToken(payload: Record<string, unknown>): Promise<string> {
  const body = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmac(body)
  return `${body}.${sig}`
}
async function buildActionLinks(reminderId: string) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  const [snoozeTok, completeTok] = await Promise.all([
    signToken({ rid: reminderId, act: 'snooze', m: 30, exp }),
    signToken({ rid: reminderId, act: 'complete', exp }),
  ])
  return {
    snooze: `${FUNCTIONS_BASE}?t=${snoozeTok}`,
    complete: `${FUNCTIONS_BASE}?t=${completeTok}`,
  }
}



const ZAPI_BASE_URL = 'https://api.z-api.io'

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  // Assume Brazil if missing country code
  return digits.startsWith('55') ? digits : `55${digits}`
}

async function sendWhatsApp(phone: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const id = Deno.env.get('ZAPI_INSTANCE_ID')
  const token = Deno.env.get('ZAPI_TOKEN')
  const sec = Deno.env.get('ZAPI_SECURITY_TOKEN')
  if (!id || !token || !sec) return { ok: false, error: 'Z-API não configurada' }
  try {
    const res = await fetch(`${ZAPI_BASE_URL}/instances/${id}/token/${token}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': sec },
      body: JSON.stringify({ phone, message }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, error: `Z-API ${res.status}: ${txt.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'erro ao enviar WhatsApp' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const nowIso = new Date().toISOString()
  const { data: due, error } = await supabase
    .from('task_reminders')
    .select('id, task_id, user_id, remind_at, channels, message')
    .eq('status', 'pending')
    .lte('remind_at', nowIso)
    .limit(50)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: any[] = []

  for (const r of due ?? []) {
    const channels: string[] = Array.isArray(r.channels) ? r.channels : ['system']
    const delivered: string[] = []
    const errors: string[] = []

    // system: nothing to do, popup reads from DB
    if (channels.includes('system')) delivered.push('system')

    // Fetch task + assignee for WhatsApp/email recipients
    let task: any = null
    let assignee: any = null
    if (channels.includes('whatsapp') || channels.includes('email')) {
      const { data: t } = await supabase
        .from('tasks')
        .select('id, title, assigned_to, contact_id, client_id')
        .eq('id', r.task_id)
        .maybeSingle()
      task = t
      if (task?.assigned_to) {
        const { data: p } = await supabase
          .from('profiles')
          .select('phone, email, full_name')
          .eq('user_id', task.assigned_to)
          .maybeSingle()
        assignee = p
      }
    }

    const text = (r.message?.trim() || task?.title || 'Lembrete de tarefa')
    const links = (channels.includes('whatsapp') || channels.includes('email'))
      ? await buildActionLinks(r.id)
      : null
    const waMessage = links
      ? `🔔 *Lembrete de tarefa*\n\n${text}\n\n✅ Concluir: ${links.complete}\n⏰ Adiar 30 min: ${links.snooze}`
      : `🔔 *Lembrete de tarefa*\n\n${text}`

    if (channels.includes('whatsapp')) {
      const phone = normalizePhone(assignee?.phone)
      if (!phone) {
        errors.push('whatsapp: responsável sem telefone válido')
      } else {
        const wa = await sendWhatsApp(phone, waMessage)
        if (wa.ok) delivered.push('whatsapp')
        else errors.push(`whatsapp: ${wa.error}`)
      }
    }

    if (channels.includes('email')) {
      const recipientEmail = assignee?.email
      if (!recipientEmail) {
        errors.push('email: responsável sem e-mail cadastrado')
      } else {
        try {
          const remindAt = new Date(r.remind_at).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
          const taskUrl = `https://compass.altivusturismo.com.br/tasks/${r.task_id}`
          const { error: emailErr } = await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'task-reminder',
              recipientEmail,
              idempotencyKey: `task-reminder-${r.id}`,
              templateData: {
                taskTitle: task?.title ?? 'Tarefa',
                message: r.message ?? null,
                remindAt,
                taskUrl,
                recipientName: assignee?.full_name ?? null,
                completeUrl: links?.complete ?? null,
                snoozeUrl: links?.snooze ?? null,
              },
            },
          })
          if (emailErr) errors.push(`email: ${emailErr.message ?? emailErr}`)
          else delivered.push('email')
        } catch (e: any) {
          errors.push(`email: ${e?.message ?? 'falha ao enviar'}`)
        }
      }
    }


    const allOk = channels.every((c) => delivered.includes(c))
    const anyOk = delivered.length > 0
    const status = allOk ? 'sent' : anyOk ? 'partial' : 'failed'

    await supabase
      .from('task_reminders')
      .update({
        status,
        sent_at: new Date().toISOString(),
        delivered_channels: delivered,
        error: errors.length ? errors.join(' | ') : null,
      })
      .eq('id', r.id)

    results.push({ id: r.id, status, delivered, errors })
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
