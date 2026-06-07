// Public endpoint for "snooze" / "complete" links sent via WhatsApp/Email reminders.
// Verifies an HMAC-signed token and performs the action without requiring login.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function b64urlEncode(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes))
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  )
  return b64urlEncode(sig)
}

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  const json = JSON.stringify(payload)
  const body = b64urlEncode(new TextEncoder().encode(json))
  const sig = await hmac(body)
  return `${body}.${sig}`
}

async function verifyToken(token: string): Promise<Record<string, any> | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = await hmac(body)
  if (expected !== sig) return null
  try {
    const json = new TextDecoder().decode(b64urlDecode(body))
    const payload = JSON.parse(json)
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function html(title: string, message: string, ok = true): Response {
  const color = ok ? '#0f3460' : '#b91c1c'
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:'DM Sans',Arial,sans-serif;background:#f6f7fb;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;color:#1f2a44}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px 28px;max-width:420px;text-align:center;box-shadow:0 4px 24px rgba(15,52,96,.06)}h1{font-family:'Playfair Display',Georgia,serif;font-size:22px;margin:0 0 12px;color:${color}}p{margin:0;line-height:1.5;color:#475569}a{color:#0f3460;font-weight:600;text-decoration:none}</style></head><body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('t')
  if (!token) return html('Link inválido', 'Token ausente.', false)
  const payload = await verifyToken(token)
  if (!payload) return html('Link inválido ou expirado', 'Solicite um novo lembrete.', false)
  const { rid, act } = payload as { rid?: string; act?: string }
  if (!rid || !act) return html('Link inválido', 'Parâmetros ausentes.', false)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: r } = await supabase
    .from('task_reminders')
    .select('id, task_id, user_id, channels, message')
    .eq('id', rid)
    .maybeSingle()
  if (!r) return html('Lembrete não encontrado', 'O lembrete pode ter sido removido.', false)

  if (act === 'complete') {
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
    return html('Tarefa concluída ✅', 'Tudo certo! A tarefa foi marcada como concluída.')
  }

  if (act === 'snooze') {
    const minutes = Number(url.searchParams.get('m') ?? payload.m ?? 30)
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
    return html(
      `Lembrete adiado por ${minutes} min ⏰`,
      'Você receberá um novo aviso no horário escolhido.'
    )
  }

  return html('Ação desconhecida', 'A ação solicitada não é suportada.', false)
})
