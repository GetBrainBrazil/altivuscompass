import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const cleanDigits = (s: unknown) => String(s ?? '').replace(/\D/g, '')

/** Z-API espera DDI+DDD+número, só dígitos. Garante prefixo 55 (BR). */
function normalizeBrPhone(raw: string | null | undefined): string {
  const d = cleanDigits(raw)
  if (!d) return ''
  if (d.startsWith('55') && d.length >= 12) return d
  return `55${d}`
}

function tomorrowISO(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const errors: Array<{ quote_id: string; step: string; error: string }> = []
  let processed = 0
  let whatsappsSent = 0

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')
    const ZAPI_SECURITY_TOKEN = Deno.env.get('ZAPI_SECURITY_TOKEN')
    const zapiReady = !!(ZAPI_INSTANCE_ID && ZAPI_TOKEN && ZAPI_SECURITY_TOKEN)

    const targetDate = tomorrowISO()

    // 2. Find quotes expiring tomorrow that still need a warning
    const { data: quotes, error: qErr } = await supabase
      .from('quotes')
      .select(
        'id, title, destination, quote_validity, assigned_to, client_id, stage',
      )
      .eq('quote_validity', targetDate)
      .is('archived_at', null)
      .eq('is_template', false)
      .not('stage', 'in', '(confirmed,completed)')
      .is('validity_warning_sent_at', null)
      .not('assigned_to', 'is', null)

    if (qErr) {
      console.error('Erro ao buscar cotações:', qErr)
      return json({ error: 'Erro ao buscar cotações', details: qErr.message }, 500)
    }

    console.log(`[check-quote-validity] Encontradas ${quotes?.length ?? 0} cotações para ${targetDate}`)

    for (const q of quotes ?? []) {
      try {
        const titleLabel = q.title || q.destination || `Cotação ${q.id.slice(0, 8)}`

        // 3a. Create task
        const { error: taskErr } = await supabase.from('tasks').insert({
          title: `Cotação expira amanhã: ${titleLabel}`,
          description:
            `A cotação para *${q.destination ?? 'destino não informado'}* expira em ${q.quote_validity}.\n\n` +
            `Entre em contato com o cliente para renovar ou fechar a proposta antes da expiração.`,
          status: 'pending',
          priority: 'high',
          assigned_to: q.assigned_to,
          created_by: null,
          quote_id: q.id,
          client_id: q.client_id,
          due_date: q.quote_validity,
          start_date: todayISO(),
        })

        if (taskErr) {
          console.error(`Falha ao criar tarefa para cotação ${q.id}:`, taskErr)
          errors.push({ quote_id: q.id, step: 'task', error: taskErr.message })
          // não interrompe — segue tentando WhatsApp e marcação
        }

        // 3b. WhatsApp (best-effort)
        if (zapiReady && q.assigned_to) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, phone')
              .eq('user_id', q.assigned_to)
              .maybeSingle()

            const phone = normalizeBrPhone(profile?.phone)
            if (phone && phone.length >= 12) {
              const message =
                `⏰ *Cotação expira amanhã!*\n\n` +
                `📋 ${titleLabel}\n` +
                `📍 Destino: ${q.destination ?? '—'}\n` +
                `📅 Validade: ${q.quote_validity}\n\n` +
                `Dê retorno ao cliente hoje para não perder a oportunidade.`

              const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
              const resp = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': ZAPI_SECURITY_TOKEN!,
                },
                body: JSON.stringify({ phone, message }),
              })

              if (resp.ok) {
                whatsappsSent++
              } else {
                const body = await resp.text()
                console.error(`Z-API erro p/ cotação ${q.id}:`, resp.status, body)
                errors.push({
                  quote_id: q.id,
                  step: 'whatsapp',
                  error: `Z-API ${resp.status}: ${body.slice(0, 200)}`,
                })
              }
            } else {
              console.log(`Vendedor da cotação ${q.id} sem telefone válido — pulando WhatsApp`)
            }
          } catch (waErr) {
            console.error(`Falha no WhatsApp para cotação ${q.id}:`, waErr)
            errors.push({
              quote_id: q.id,
              step: 'whatsapp',
              error: waErr instanceof Error ? waErr.message : String(waErr),
            })
          }
        }

        // 3c. Mark as warned (idempotência) — só marca se a tarefa foi criada
        // pra que, em caso de falha total, o próximo run tenta de novo.
        if (!taskErr) {
          const { error: updErr } = await supabase
            .from('quotes')
            .update({ validity_warning_sent_at: new Date().toISOString() })
            .eq('id', q.id)
          if (updErr) {
            console.error(`Falha ao marcar warning_sent para ${q.id}:`, updErr)
            errors.push({ quote_id: q.id, step: 'mark_warned', error: updErr.message })
          } else {
            processed++
          }
        }
      } catch (rowErr) {
        console.error(`Erro inesperado processando cotação ${q.id}:`, rowErr)
        errors.push({
          quote_id: q.id,
          step: 'row',
          error: rowErr instanceof Error ? rowErr.message : String(rowErr),
        })
      }
    }

    return json({
      success: true,
      target_date: targetDate,
      found: quotes?.length ?? 0,
      processed,
      whatsapps_sent: whatsappsSent,
      errors,
    })
  } catch (error) {
    console.error('Erro fatal em check-quote-validity:', error)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    return json({ error: msg, processed, whatsapps_sent: whatsappsSent, errors }, 500)
  }
})
