import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const cleanDigits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Z-API espera DDI+DDD+número, só dígitos. Garante prefixo 55 (BR). */
function normalizeBrPhone(raw: string | null | undefined): string {
  const d = cleanDigits(raw)
  if (!d) return ''
  if (d.startsWith('55') && d.length >= 12) return d
  return `55${d}`
}

interface AcceptBody {
  quote_id?: string
  accepter_name?: string
  accepter_email?: string
  accepter_phone?: string
  accepter_cpf?: string
  terms_accepted?: boolean
  selected_item_ids?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = (await req.json().catch(() => ({}))) as AcceptBody

    // 1. Validate input
    const quote_id = (body.quote_id ?? '').trim()
    const accepter_name = (body.accepter_name ?? '').trim()
    const accepter_email = (body.accepter_email ?? '').trim()
    const accepter_phone = cleanDigits(body.accepter_phone)
    const accepter_cpf = cleanDigits(body.accepter_cpf)
    const terms_accepted = body.terms_accepted === true
    const selected_item_ids = Array.isArray(body.selected_item_ids)
      ? body.selected_item_ids.filter((x) => typeof x === 'string')
      : []

    if (!quote_id) return json({ error: 'ID da cotação é obrigatório' }, 400)
    if (accepter_name.length < 3) return json({ error: 'Informe o nome completo' }, 400)
    if (!EMAIL_RE.test(accepter_email) || accepter_email.length > 254)
      return json({ error: 'E-mail inválido' }, 400)
    if (accepter_phone.length < 10 || accepter_phone.length > 13)
      return json({ error: 'Telefone inválido (10 a 13 dígitos)' }, 400)
    if (accepter_cpf.length !== 11) return json({ error: 'CPF deve ter 11 dígitos' }, 400)
    if (!terms_accepted) return json({ error: 'É necessário aceitar os termos' }, 400)

    // 2. Fetch quote and validate state
    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .maybeSingle()

    if (quoteErr) {
      console.error('Erro ao buscar cotação:', quoteErr)
      return json({ error: 'Erro ao buscar cotação' }, 500)
    }
    if (!quote) return json({ error: 'Cotação não encontrada' }, 404)
    if (quote.is_template) return json({ error: 'Cotação inválida' }, 400)
    if (quote.archived_at) return json({ error: 'Esta cotação foi arquivada' }, 400)
    if (quote.stage === 'confirmed' || quote.stage === 'completed')
      return json({ error: 'Esta cotação já foi aceita' }, 409)
    if (quote.quote_validity) {
      const today = new Date().toISOString().slice(0, 10)
      if (quote.quote_validity < today)
        return json({ error: 'Esta cotação está expirada' }, 400)
    }

    // 3. Fetch items + validate option groups
    const { data: items, error: itemsErr } = await supabase
      .from('quote_items')
      .select('id, option_group')
      .eq('quote_id', quote_id)

    if (itemsErr) {
      console.error('Erro ao buscar itens:', itemsErr)
      return json({ error: 'Erro ao buscar itens da cotação' }, 500)
    }

    const groups = new Map<string, string[]>()
    for (const it of items ?? []) {
      const g = (it.option_group ?? '').trim()
      if (!g) continue
      if (!groups.has(g)) groups.set(g, [])
      groups.get(g)!.push(it.id)
    }
    const optionGroups = [...groups.entries()].filter(([, ids]) => ids.length > 1)
    const selectedSet = new Set(selected_item_ids)

    for (const [groupName, ids] of optionGroups) {
      const chosen = ids.filter((id) => selectedSet.has(id))
      if (chosen.length !== 1) {
        return json(
          { error: `Escolha exatamente uma opção do grupo "${groupName}"` },
          400,
        )
      }
    }

    // 4. Insert acceptance
    const ip_address =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      null
    const user_agent = req.headers.get('user-agent') || null

    const finalSelected = optionGroups.length
      ? optionGroups.flatMap(([, ids]) => ids.filter((id) => selectedSet.has(id)))
      : selected_item_ids

    const { data: acceptance, error: accErr } = await supabase
      .from('quote_acceptances')
      .insert({
        quote_id,
        accepter_name,
        accepter_email,
        accepter_phone,
        accepter_cpf,
        terms_accepted: true,
        selected_item_ids: finalSelected,
        ip_address,
        user_agent,
      })
      .select('id')
      .single()

    if (accErr || !acceptance) {
      console.error('Erro ao registrar aceite:', accErr)
      return json({ error: 'Erro ao registrar aceite' }, 500)
    }

    // 5. Update items selection within affected groups
    if (optionGroups.length) {
      const groupNames = optionGroups.map(([g]) => g)
      const groupItemIds = optionGroups.flatMap(([, ids]) => ids)
      const chosenIds = groupItemIds.filter((id) => selectedSet.has(id))
      const unchosenIds = groupItemIds.filter((id) => !selectedSet.has(id))

      if (chosenIds.length) {
        await supabase.from('quote_items').update({ is_selected: true }).in('id', chosenIds)
      }
      if (unchosenIds.length) {
        await supabase
          .from('quote_items')
          .update({ is_selected: false })
          .in('id', unchosenIds)
      }
      // fallback: ensure groupNames variable use (lint)
      void groupNames
    }

    // Update quote stage
    const { error: updErr } = await supabase
      .from('quotes')
      .update({ stage: 'confirmed', conclusion_type: 'won' })
      .eq('id', quote_id)
    if (updErr) console.error('Erro ao atualizar stage:', updErr)

    // 6. Create sale
    try {
      await supabase.from('sales').insert({
        quote_id: quote.id,
        client_id: quote.client_id,
        stage: 'issued',
        destination: quote.destination,
        total_value: quote.total_value,
        travel_date_start: quote.travel_date_start,
        travel_date_end: quote.travel_date_end,
        assigned_to: quote.assigned_to,
        created_by: quote.created_by,
        notes: `Venda gerada automaticamente pelo aceite do cliente em ${new Date().toISOString()}`,
      })
    } catch (e) {
      console.error('Falha ao criar venda (não bloqueia):', e)
    }

    // 7. Create high-priority task for assigned seller
    if (quote.assigned_to) {
      try {
        await supabase.from('tasks').insert({
          title: `Proposta aceita: ${quote.title || quote.destination || 'cotação'}`,
          description:
            `O cliente aceitou a proposta e os próximos passos precisam ser executados.\n\n` +
            `Contato do aceitante:\n` +
            `• Nome: ${accepter_name}\n` +
            `• E-mail: ${accepter_email}\n` +
            `• Telefone: ${accepter_phone}\n` +
            `• CPF: ${accepter_cpf}`,
          status: 'pending',
          priority: 'high',
          assigned_to: quote.assigned_to,
          created_by: quote.assigned_to,
          quote_id: quote.id,
          client_id: quote.client_id,
        })
      } catch (e) {
        console.error('Falha ao criar tarefa (não bloqueia):', e)
      }
    }

    // 8. Quote history entry
    try {
      await supabase.from('quote_history').insert({
        quote_id: quote.id,
        action: 'accepted',
        description: `Proposta aceita por ${accepter_name} (${accepter_email})`,
        user_name: accepter_name,
        details: {
          acceptance_id: acceptance.id,
          selected_item_ids: finalSelected,
          ip_address,
        },
      })
    } catch (e) {
      console.error('Falha ao registrar histórico (não bloqueia):', e)
    }

    // 9. Notify seller via WhatsApp (Z-API) — best effort
    try {
      if (quote.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('user_id', quote.assigned_to)
          .maybeSingle()

        const sellerPhone = normalizeBrPhone(profile?.phone)
        const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')
        const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')
        const ZAPI_SECURITY_TOKEN = Deno.env.get('ZAPI_SECURITY_TOKEN')

        if (sellerPhone && sellerPhone.length >= 12 && ZAPI_INSTANCE_ID && ZAPI_TOKEN && ZAPI_SECURITY_TOKEN) {
          const message =
            `🎉 *Proposta aceita!*\n\n` +
            `Cotação: ${quote.title || quote.destination || quote.id}\n\n` +
            `Cliente:\n` +
            `• ${accepter_name}\n` +
            `• ${accepter_email}\n` +
            `• ${accepter_phone}\n\n` +
            `Acesse o sistema para dar continuidade.`

          const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
          const resp = await fetch(zapiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': ZAPI_SECURITY_TOKEN,
            },
            body: JSON.stringify({ phone: sellerPhone, message }),
          })
          if (!resp.ok) {
            console.error('Z-API respondeu erro:', resp.status, await resp.text())
          }
        }
      }
    } catch (e) {
      console.error('Falha ao notificar vendedor via WhatsApp (não bloqueia):', e)
    }

    // 10. Success
    return json({ success: true, acceptance_id: acceptance.id }, 200)
  } catch (error) {
    console.error('Erro inesperado em accept-quote:', error)
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    return json({ error: msg }, 500)
  }
})
