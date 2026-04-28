import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZAPI_BASE_URL = 'https://api.z-api.io'

/**
 * Formata um número de WhatsApp (E.164 sem '+', ex.: "5511999990000") como
 * placeholder humano para o campo "Nome do cliente" enquanto a IA ainda não
 * descobriu o nome real (ex.: "+55 11 99999-0000").
 */
function formatPhonePlaceholder(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (!digits) return 'Contato sem identificação'
  // BR: 55 + DDD(2) + 9XXXXXXXX (mobile) | 8XXXXXXX (fixed)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const cc = digits.slice(0, 2)
    const ddd = digits.slice(2, 4)
    const rest = digits.slice(4)
    if (rest.length === 9) return `+${cc} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`
    if (rest.length === 8) return `+${cc} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`
  }
  return `+${digits}`
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID')!
    const zapiToken = Deno.env.get('ZAPI_TOKEN')!
    const zapiSecurityToken = Deno.env.get('ZAPI_SECURITY_TOKEN')!

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json()
    console.log('Webhook payload:', JSON.stringify(body).substring(0, 500))

    // Z-API webhook payload structure
    const phone = body.phone || body.from || ''
    const isTextMsg = body.text?.message != null
    const isImageMsg = body.image != null
    const isDocumentMsg = body.document != null
    const isAudioMsg = body.audio != null
    const isVideoMsg = body.video != null
    const isStickerMsg = body.sticker != null
    const isLocationMsg = body.location != null
    const senderName = body.senderName || body.chatName || ''

    const messageText = body.text?.message || ''
    const imageUrl = body.image?.imageUrl || body.image?.url || ''
    const documentUrl = body.document?.documentUrl || body.document?.url || ''
    const documentMimeType = body.document?.mimeType || ''
    const audioUrl = body.audio?.audioUrl || body.audio?.url || ''
    const audioMime = body.audio?.mimeType || ''
    const videoUrl = body.video?.videoUrl || body.video?.url || ''
    const videoMime = body.video?.mimeType || ''
    const stickerUrl = body.sticker?.stickerUrl || body.sticker?.url || ''
    const imageCaption = body.image?.caption || ''
    const videoCaption = body.video?.caption || ''
    const documentCaption = body.document?.caption || body.document?.fileName || ''

    if (!phone) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Ignore group messages and messages sent by us — they should never create leads/prospects.
    // Z-API marks groups with isGroup=true and/or phone like "120363...-group".
    const looksLikeGroup =
      body.isGroup === true ||
      body.fromGroup === true ||
      /-group$/i.test(phone) ||
      /^120363\d+/.test(phone.replace(/\D/g, ''))
    if (looksLikeGroup) {
      console.log('Webhook: ignoring group message from', phone)
      return new Response(JSON.stringify({ status: 'ignored', reason: 'group message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (body.fromMe === true) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for #pago command
    const isPagoCommand = isTextMsg && messageText.trim().toLowerCase() === '#pago'
    const isCancelarCommand = isTextMsg && ['#cancelar', '#cancela', '#sair'].includes(messageText.trim().toLowerCase())

    // Find active financial-entry session for this phone (#pago flow only).
    // Lead-capture conversations are handled by handleLeadCapture below.
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone', phone)
      .eq('session_type', 'financial_entry')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (isCancelarCommand) {
      if (existingSession) {
        await supabase.from('whatsapp_sessions')
          .update({ status: 'cancelled' })
          .eq('id', existingSession.id)
        await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, '❌ Lançamento cancelado. Envie #pago para iniciar um novo.')
      } else {
        await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, 'Não há lançamento em andamento. Envie #pago para iniciar.')
      }
      return new Response(JSON.stringify({ status: 'cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (isPagoCommand) {
      if (existingSession) {
        await supabase.from('whatsapp_sessions')
          .update({ status: 'cancelled' })
          .eq('id', existingSession.id)
      }

      const greeting = senderName ? `Olá, ${senderName.split(' ')[0]}!` : 'Olá!'
      const { data: newSession } = await supabase.from('whatsapp_sessions').insert({
        phone,
        session_type: 'financial_entry',
        state: { messages: [], attachments: [], extracted_data: {}, sender_name: senderName },
        status: 'active',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }).select().single()

      const welcomeMsg = `${greeting} Vou ajudar a cadastrar a conta paga.\n\nMe envie a descrição, valor, fornecedor, e se tiver, a foto ou PDF do boleto ou comprovante de pagamento. Pode me enviar em várias mensagens.`

      await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, welcomeMsg)

      return new Response(JSON.stringify({ status: 'session_started', session_id: newSession?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If no active session, route the message to the lead-capture flow (AI conversation)
    if (!existingSession) {
      const result = await handleLeadCapture(supabase, lovableApiKey, zapiInstanceId, zapiToken, zapiSecurityToken, {
        phone,
        senderName,
        messageText: isTextMsg ? messageText : '',
        isTextMsg,
      })
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Process message within active session
    const sessionState = existingSession.state as any

    // Handle image/document - download and store
    let attachmentInfo: any = null
    if (isImageMsg && imageUrl) {
      attachmentInfo = await processAttachment(supabase, imageUrl, 'image', existingSession.id)
      sessionState.attachments = [...(sessionState.attachments || []), attachmentInfo]
    }
    if (isDocumentMsg && documentUrl) {
      attachmentInfo = await processAttachment(supabase, documentUrl, 'document', existingSession.id, documentMimeType)
      sessionState.attachments = [...(sessionState.attachments || []), attachmentInfo]
    }

    // Add text message to history
    if (isTextMsg && messageText) {
      sessionState.messages = [...(sessionState.messages || []), { role: 'user', content: messageText }]
    } else if (attachmentInfo) {
      sessionState.messages = [...(sessionState.messages || []), { role: 'user', content: `[Enviou ${attachmentInfo.type === 'image' ? 'uma imagem' : 'um documento'}]` }]
    }

    // Check if user is confirming
    const isConfirmation = isTextMsg && ['sim', 'confirma', 'confirmo', 'ok', 'yes', 's'].includes(messageText.trim().toLowerCase())
    const isCancellation = isTextMsg && ['não', 'nao', 'cancelar', 'cancela', 'n'].includes(messageText.trim().toLowerCase())

    if (isCancellation && sessionState.awaiting_confirmation) {
      await supabase.from('whatsapp_sessions')
        .update({ status: 'cancelled' })
        .eq('id', existingSession.id)
      await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, 'Cadastro cancelado. Envie #pago para iniciar novamente.')
      return new Response(JSON.stringify({ status: 'cancelled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (isConfirmation && sessionState.awaiting_confirmation && sessionState.final_data) {
      // Save to financial_transactions
      const finalData = sessionState.final_data
      const attachmentUrls = (sessionState.attachments || []).map((a: any) => a.storage_url).filter(Boolean)

      // Handle supplier: check if exists, if not create in suppliers table
      let supplierName = finalData.supplier || null
      if (supplierName) {
        const { data: existingSupplier } = await supabase
          .from('financial_parties')
          .select('name')
          .ilike('name', `%${supplierName}%`)
          .limit(1)
          .single()

        if (!existingSupplier) {
          // Create new supplier in both financial_parties and suppliers tables
          await supabase.from('financial_parties').insert({
            name: supplierName,
            type: 'company',
          })
          await supabase.from('suppliers').insert({
            name: supplierName,
            is_active: true,
          })
        } else {
          supplierName = existingSupplier.name
        }
      }

      const { error: insertError } = await supabase.from('financial_transactions').insert({
        description: finalData.description || 'Conta paga via WhatsApp',
        type: 'expense',
        amount: finalData.amount || 0,
        status: 'paid',
        date: finalData.payment_date || new Date().toISOString().split('T')[0],
        due_date: finalData.due_date || null,
        party_name: supplierName,
        category: finalData.category || null,
        payment_account: finalData.bank_account || null,
        observations: `Cadastrado via WhatsApp por ${sessionState.sender_name || phone}`,
        attachment_urls: attachmentUrls,
      })

      if (insertError) {
        console.error('Insert error:', insertError)
        await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, `Erro ao salvar: ${insertError.message}. Tente novamente.`)
      } else {
        await supabase.from('whatsapp_sessions')
          .update({ status: 'completed', state: sessionState })
          .eq('id', existingSession.id)
        
        const newSupplierNote = finalData.is_new_supplier ? '\n📋 Novo fornecedor cadastrado: ' + supplierName : ''
        await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, `✅ Esta conta paga foi cadastrada com sucesso em Contas a Pagar!${newSupplierNote}`)
      }

      return new Response(JSON.stringify({ status: 'saved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call AI to process the conversation
    const aiResponse = await callAI(supabase, lovableApiKey, sessionState, attachmentInfo)

    // Update session state with AI response
    sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: aiResponse.reply }]
    if (aiResponse.extracted_data) {
      sessionState.extracted_data = { ...sessionState.extracted_data, ...aiResponse.extracted_data }
    }
    if (aiResponse.awaiting_confirmation) {
      sessionState.awaiting_confirmation = true
      sessionState.final_data = aiResponse.final_data
    }

    // Extend session expiry
    await supabase.from('whatsapp_sessions').update({
      state: sessionState,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }).eq('id', existingSession.id)

    // Send AI reply via WhatsApp
    await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, aiResponse.reply)

    return new Response(JSON.stringify({ status: 'processed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// --- Helper functions ---

async function sendZapiText(instanceId: string, token: string, securityToken: string, phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '')
  const url = `${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': securityToken },
    body: JSON.stringify({ phone: cleanPhone, message }),
  })
  if (!res.ok) {
    console.error('Z-API send error:', res.status, await res.text())
  }
  return res
}

async function processAttachment(
  supabase: any, url: string, type: string, sessionId: string, mimeType?: string
) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download: ${response.status}`)

    const blob = await response.blob()
    const ext = type === 'image' ? 'jpg' : (mimeType?.includes('pdf') ? 'pdf' : 'bin')
    const fileName = `${sessionId}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('financial-attachments')
      .upload(fileName, blob, { contentType: mimeType || (type === 'image' ? 'image/jpeg' : 'application/octet-stream') })

    if (error) {
      console.error('Storage upload error:', error)
      return { type, original_url: url, storage_url: null, error: error.message }
    }

    const storageUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/financial-attachments/${fileName}`
    return { type, original_url: url, storage_path: data.path, storage_url: storageUrl }
  } catch (e) {
    console.error('Attachment processing error:', e)
    return { type, original_url: url, storage_url: null, error: String(e) }
  }
}

async function callAI(supabase: any, apiKey: string, sessionState: any, newAttachment: any) {
  // Fetch reference data for context
  const [suppliersRes, categoriesRes, accountsRes] = await Promise.all([
    supabase.from('financial_parties').select('name, document_number').limit(50),
    supabase.from('financial_categories').select('name, type, code').eq('is_active', true).limit(50),
    supabase.from('bank_accounts').select('bank_name, account_type').eq('is_active', true).limit(20),
  ])

  const suppliers = (suppliersRes.data || []).map((s: any) => s.name).join(', ')
  const categories = (categoriesRes.data || []).map((c: any) => `${c.name} (${c.type})`).join(', ')
  const accounts = (accountsRes.data || []).map((a: any) => a.bank_name).join(', ')

  const systemPrompt = `Você é um assistente financeiro da Altivus Turismo que ajuda a cadastrar contas pagas via WhatsApp.

Seu objetivo é coletar as seguintes informações para registrar uma conta paga:
- Descrição (obrigatório)
- Valor (obrigatório)
- Fornecedor/Pagador (obrigatório - busque nos cadastrados abaixo. Se encontrar, informe "✅ Fornecedor encontrado: [nome]". Se NÃO encontrar, informe "⚠️ Fornecedor não encontrado. Será cadastrado como novo: [nome]")
  Fornecedores cadastrados: ${suppliers || 'nenhum cadastrado'}
- Data de vencimento (obrigatório - se não conseguir identificar no documento/texto, PERGUNTE ao usuário)
- Data de pagamento (opcional, padrão: hoje ${new Date().toISOString().split('T')[0]})
- Categoria (obrigatório - DEVE ser uma das categorias cadastradas abaixo, NÃO invente categorias novas. Sugira a mais adequada)
  Categorias cadastradas: ${categories || 'nenhuma cadastrada'}
- Conta bancária (obrigatório - DEVE ser uma das contas cadastradas abaixo, NÃO invente contas novas. Pergunte ao usuário qual conta)
  Contas cadastradas: ${accounts || 'nenhuma cadastrada'}

Regras:
1. Se o usuário enviar uma imagem ou documento, analise o conteúdo descrito e extraia os dados possíveis (valor, fornecedor, vencimento, etc.)
2. TODOS os campos obrigatórios devem estar preenchidos antes de apresentar o resumo para confirmação
3. Se faltar data de vencimento, pergunte explicitamente
4. Se faltar categoria, sugira uma das cadastradas e pergunte se concorda
5. Se faltar conta bancária, liste as opções cadastradas e peça para escolher
6. Para fornecedor, faça busca aproximada. Se encontrar, use o nome exato cadastrado. Se não encontrar, avise que será cadastrado como novo
7. NUNCA apresente o resumo final se faltar algum campo obrigatório
8. Responda sempre em português brasileiro, de forma concisa e amigável
9. Use emojis com moderação
10. Formate valores como R$ X.XXX,XX

Dados coletados até agora: ${JSON.stringify(sessionState.extracted_data || {})}
Anexos recebidos: ${(sessionState.attachments || []).length} arquivo(s)

Quando apresentar o resumo para confirmação (SOMENTE quando TODOS os campos obrigatórios estiverem preenchidos), retorne EXATAMENTE neste formato JSON no final da sua mensagem, em uma linha separada começando com ###JSON###:
###JSON###{"awaiting_confirmation":true,"final_data":{"description":"...","amount":0,"supplier":"...","is_new_supplier":false,"due_date":"YYYY-MM-DD","payment_date":"YYYY-MM-DD","category":"...","bank_account":"..."}}

O campo is_new_supplier deve ser true se o fornecedor NÃO foi encontrado nos cadastrados.
Não inclua o JSON se ainda estiver coletando informações.`

  // Build messages for AI
  const aiMessages: any[] = [{ role: 'system', content: systemPrompt }]

  // Add conversation history
  for (const msg of (sessionState.messages || [])) {
    aiMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })
  }

  // If there's a new attachment with an image, add visual context
  if (newAttachment?.type === 'image' && newAttachment.original_url) {
    const lastMsg = aiMessages[aiMessages.length - 1]
    if (lastMsg?.role === 'user') {
      aiMessages[aiMessages.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text: lastMsg.content || 'Analise esta imagem e extraia os dados financeiros (valor, fornecedor, vencimento, etc.)' },
          { type: 'image_url', image_url: { url: newAttachment.original_url } },
        ],
      }
    }
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('AI error:', response.status, errText)
      return { reply: 'Desculpe, tive um problema ao processar. Pode repetir a informação?', extracted_data: null, awaiting_confirmation: false }
    }

    const data = await response.json()
    let reply = data.choices?.[0]?.message?.content || 'Não entendi, pode repetir?'

    // Parse JSON data if present
    let awaitingConfirmation = false
    let finalData = null
    let extractedData = null

    const jsonMatch = reply.match(/###JSON###(.+)$/s)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim())
        awaitingConfirmation = parsed.awaiting_confirmation || false
        finalData = parsed.final_data || null
        extractedData = parsed.final_data || null
        // Remove JSON from reply
        reply = reply.replace(/###JSON###.+$/s, '').trim()
      } catch (e) {
        console.error('Failed to parse AI JSON:', e)
      }
    }

    return { reply, extracted_data: extractedData, awaiting_confirmation: awaitingConfirmation, final_data: finalData }
  } catch (e) {
    console.error('AI call error:', e)
    return { reply: 'Desculpe, tive um problema técnico. Tente novamente em instantes.', extracted_data: null, awaiting_confirmation: false }
  }
}

// ============================================================================
// LEAD CAPTURE FLOW
// ============================================================================
// When a new contact (no active #pago session) sends a message, treat the
// conversation as an inbound sales lead. Auto-create a `leads` row tied to a
// `whatsapp_sessions` row of type `lead_capture`, then use the AI to extract
// destination, dates, travelers, budget and preferences from each message and
// keep the lead row updated. The AI replies in PT-BR like a friendly travel
// consultant assistant.
// ============================================================================

async function handleLeadCapture(
  supabase: any,
  lovableApiKey: string,
  zapiInstanceId: string,
  zapiToken: string,
  zapiSecurityToken: string,
  ctx: { phone: string; senderName: string; messageText: string; isTextMsg: boolean },
) {
  const { phone, senderName, messageText, isTextMsg } = ctx

  // 1) Lookup contact by phone (matches by digits, ignoring formatting)
  const phoneDigits = phone.replace(/\D/g, '')
  let matchedContact: any = null
  if (phoneDigits) {
    const { data: candidates } = await supabase
      .from('contacts')
      .select('id, full_name, phone, level, client_id, lead_id')
      .ilike('phone', `%${phoneDigits.slice(-9)}%`)
      .limit(10)
    matchedContact = (candidates || []).find((c: any) =>
      (c.phone || '').replace(/\D/g, '').endsWith(phoneDigits.slice(-9)),
    ) || null
  }

  // 2) Find or create the lead-capture session for this phone
  let { data: leadSession } = await supabase
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone', phone)
    .eq('session_type', 'lead_capture')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let leadId: string | null = leadSession?.lead_id ?? matchedContact?.lead_id ?? null
  let leadRow: any = null

  if (leadId) {
    const { data } = await supabase.from('leads').select('*').eq('id', leadId).single()
    leadRow = data
  }

  // 3) If no lead exists yet, look one up by phone before creating a new row —
  //    isso evita duplicar leads quando várias mensagens chegam quase juntas
  //    (race condition que estava criando 2-4 prospects iguais).
  if (!leadRow && phoneDigits) {
    const tail = phoneDigits.slice(-9)
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('*')
      .ilike('phone', `%${tail}%`)
      .order('created_at', { ascending: false })
      .limit(5)
    const found = (existingLeads || []).find((l: any) =>
      (l.phone || '').replace(/\D/g, '').endsWith(tail),
    )
    if (found) {
      leadRow = found
      leadId = found.id
    }
  }

  // 4) Still nothing? Then create a fresh lead. Use known name from contact when available;
  //    se a IA / WhatsApp não trouxerem um nome real, o placeholder é o número de
  //    telefone formatado — NUNCA o destino, assunto ou outro campo.
  if (!leadRow) {
    const contactName = (matchedContact?.full_name || '').trim()
    const waSenderName = (senderName || '').trim()
    const looksLikeHumanName = (s: string) =>
      !!s && !/\d/.test(s) && s.split(/\s+/).filter((w) => w.length > 1).length >= 2
    const cleanName =
      contactName ||
      (looksLikeHumanName(waSenderName) ? waSenderName : '') ||
      formatPhonePlaceholder(phone)
    const { data: newLead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        full_name: cleanName,
        phone,
        source: 'whatsapp_ai',
        status: 'new',
        ai_collected_data: { whatsapp_sender_name: senderName || null },
      })
      .select('*')
      .single()
    if (leadErr) {
      console.error('Lead insert error:', leadErr)
      return { status: 'error', error: leadErr.message }
    }
    leadRow = newLead
    leadId = newLead.id
  }

  // Create or refresh the session
  if (!leadSession) {
    const { data: created } = await supabase
      .from('whatsapp_sessions')
      .insert({
        phone,
        session_type: 'lead_capture',
        state: { messages: [], sender_name: senderName },
        status: 'active',
        lead_id: leadId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('*')
      .single()
    leadSession = created
  }

  const sessionState = (leadSession?.state as any) || { messages: [] }

  // Append user message to history
  if (isTextMsg && messageText) {
    sessionState.messages = [...(sessionState.messages || []), { role: 'user', content: messageText }]
  } else {
    // Non-text messages: still acknowledge but skip AI extraction this turn
    await sendZapiText(
      zapiInstanceId, zapiToken, zapiSecurityToken, phone,
      'Recebi seu arquivo! Pode me contar em texto também o que você está procurando? (destino, datas, quantas pessoas)',
    )
    await supabase.from('whatsapp_sessions').update({
      state: sessionState,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', leadSession!.id)
    return { status: 'lead_capture_attachment', lead_id: leadId }
  }

  // Build contact context (level, last trip) so the AI can adapt its tone
  let contactCtx: any = null
  if (matchedContact) {
    contactCtx = {
      level: matchedContact.level,
      full_name: matchedContact.full_name,
      client_id: matchedContact.client_id,
      last_trip: null as null | { destination: string; date: string },
    }
    if (matchedContact.client_id) {
      const todayIso = new Date().toISOString().split('T')[0]
      const { data: lastQuote } = await supabase
        .from('quotes')
        .select('destination, title, travel_date_start, travel_date_end')
        .eq('client_id', matchedContact.client_id)
        .lte('travel_date_start', todayIso)
        .order('travel_date_start', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastQuote) {
        contactCtx.last_trip = {
          destination: lastQuote.destination || lastQuote.title || 'destino anterior',
          date: lastQuote.travel_date_start,
        }
      }
    }
  }

  // Call AI to converse and extract structured data
  const ai = await callLeadCaptureAI(lovableApiKey, sessionState, leadRow, senderName, contactCtx)

  // Apply extracted updates to the lead row
  const updates = buildLeadUpdates(ai.extracted, leadRow)
  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (updErr) console.error('Lead update error:', updErr)
  }

  sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: ai.reply }]

  await supabase.from('whatsapp_sessions').update({
    state: sessionState,
    lead_id: leadId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', leadSession!.id)

  await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, ai.reply)

  return { status: 'lead_capture_processed', lead_id: leadId }
}

function buildLeadUpdates(extracted: any, current: any): Record<string, any> {
  if (!extracted || typeof extracted !== 'object') return {}
  const updates: Record<string, any> = {}
  const setIfNew = (field: string, value: any) => {
    if (value === undefined || value === null || value === '') return
    if (current?.[field] && String(current[field]).trim()) return // don't overwrite
    updates[field] = value
  }

  // Nome: regras especiais. NUNCA permitir que o nome seja igual ao destino.
  // Se o nome atual é apenas o placeholder (telefone formatado), aceitamos
  // substituir por um nome humano extraído pela IA.
  const extractedName = typeof extracted.full_name === 'string' ? extracted.full_name.trim() : ''
  const extractedDest = typeof extracted.destination === 'string' ? extracted.destination.trim() : ''
  const currentName = (current?.full_name || '').trim()
  const looksLikeHumanName = (s: string) =>
    !!s && !/\d/.test(s) && s.split(/\s+/).filter((w) => w.length > 1).length >= 2
  const isPlaceholderName = (s: string) =>
    !!s && (/^\+?\d/.test(s) || /^Contato\s+\d{2,}$/i.test(s))

  if (
    extractedName &&
    looksLikeHumanName(extractedName) &&
    extractedName.toLowerCase() !== extractedDest.toLowerCase() &&
    extractedName.toLowerCase() !== (current?.destination || '').toLowerCase() &&
    (!currentName || isPlaceholderName(currentName))
  ) {
    updates.full_name = extractedName
  }

  setIfNew('email', extracted.email)
  setIfNew('destination', extracted.destination)
  setIfNew('travel_date_start', extracted.travel_date_start)
  setIfNew('travel_date_end', extracted.travel_date_end)
  if (extracted.flexible_dates === true && current?.flexible_dates !== true) {
    updates.flexible_dates = true
  }
  setIfNew('flexible_dates_description', extracted.flexible_dates_description)
  if (typeof extracted.travelers_count === 'number' && !current?.travelers_count) {
    updates.travelers_count = extracted.travelers_count
  }
  if (typeof extracted.budget_estimate === 'number' && !current?.budget_estimate) {
    updates.budget_estimate = extracted.budget_estimate
  }
  // Append preferences instead of overwriting
  if (extracted.preferences && typeof extracted.preferences === 'string') {
    const merged = current?.preferences
      ? `${current.preferences}\n${extracted.preferences}`.slice(0, 2000)
      : extracted.preferences
    updates.preferences = merged
  }
  if (extracted.ai_summary && typeof extracted.ai_summary === 'string') {
    updates.ai_summary = extracted.ai_summary.slice(0, 500)
  }
  // Merge ai_collected_data
  if (extracted.extras && typeof extracted.extras === 'object') {
    updates.ai_collected_data = {
      ...(current?.ai_collected_data || {}),
      ...extracted.extras,
    }
  }
  return updates
}

async function callLeadCaptureAI(
  apiKey: string,
  sessionState: any,
  currentLead: any,
  senderName: string,
  contactCtx: any = null,
) {
  const today = new Date().toISOString().split('T')[0]
  const knownData = {
    full_name: currentLead?.full_name || senderName || null,
    destination: currentLead?.destination || null,
    travel_date_start: currentLead?.travel_date_start || null,
    travel_date_end: currentLead?.travel_date_end || null,
    flexible_dates: currentLead?.flexible_dates || false,
    flexible_dates_description: currentLead?.flexible_dates_description || null,
    travelers_count: currentLead?.travelers_count || null,
    budget_estimate: currentLead?.budget_estimate || null,
    preferences: currentLead?.preferences || null,
  }

  const isExistingClient = contactCtx?.level === 'cliente'
  const clientFirstName = (contactCtx?.full_name || '').split(' ')[0] || ''
  const lastTripBlock = contactCtx?.last_trip
    ? `Última viagem realizada com a Altivus: ${contactCtx.last_trip.destination} em ${contactCtx.last_trip.date}.`
    : 'Sem viagens anteriores registradas.'

  const clientPrompt = `Você é um(a) consultor(a) de viagens da **Altivus Turismo** atendendo um(a) CLIENTE JÁ EXISTENTE pelo WhatsApp.

Nome do cliente: ${contactCtx?.full_name || senderName}
${lastTripBlock}

Regras OBRIGATÓRIAS:
1. Cumprimente o cliente PELO PRIMEIRO NOME ("${clientFirstName}") de forma calorosa e personalizada.
2. NÃO faça perguntas de qualificação (não pergunte destino, datas, viajantes ou orçamento de forma genérica).
3. Pergunte diretamente "Como posso te ajudar hoje?" — pode ser uma nova viagem, dúvida sobre uma viagem em andamento, ou outro suporte.
4. Se houver última viagem registrada, pode mencionar de leve ("espero que tenha sido incrível!") sem ser invasivo.
5. Use português brasileiro, tom premium e próximo. Emojis com moderação.
6. Mantenha a resposta curta (máx 3 linhas).

Hoje é ${today}.

**FORMATO DE RESPOSTA OBRIGATÓRIO**:
Responda primeiro a mensagem em texto natural. Depois, em uma linha separada no FINAL, retorne EXATAMENTE este bloco JSON (use null para campos não mencionados nesta mensagem):

###JSON###{"full_name":null,"email":null,"destination":null,"travel_date_start":null,"travel_date_end":null,"flexible_dates":null,"flexible_dates_description":null,"travelers_count":null,"budget_estimate":null,"preferences":null,"ai_summary":null,"extras":{}}`

  const leadPrompt = `Você é um(a) consultor(a) de viagens da **Altivus Turismo** atendendo um novo contato pelo WhatsApp.

Seu papel:
1. Conversar de forma calorosa, profissional e em **português brasileiro**
2. Coletar gradualmente as informações da viagem desejada
3. Não peça tudo de uma vez — pergunte 1 ou 2 coisas por mensagem, conforme a conversa flui
4. Se a pessoa já forneceu uma informação, NÃO peça de novo
5. Use emojis com moderação (✈️ 🏝️ 🗺️)
6. Mantenha as respostas curtas (máximo 3-4 linhas)
7. Quando tiver dados suficientes (destino + datas + viajantes), avise que um consultor humano dará continuidade com uma cotação personalizada

Informações que você precisa coletar:
- Nome completo (se diferente do que veio no WhatsApp)
- Destino desejado (cidade/país)
- Datas da viagem (início e fim, ou "flexível")
- Quantidade de viajantes (adultos e crianças se houver)
- Orçamento aproximado (opcional, se a pessoa mencionar)
- Preferências (tipo de hotel, classe do voo, interesses, motivo da viagem)

Hoje é ${today}.

Dados já conhecidos sobre este lead:
${JSON.stringify(knownData, null, 2)}

**FORMATO DE RESPOSTA OBRIGATÓRIO**:
Responda primeiro a mensagem em texto natural para o usuário.
Depois, em uma linha separada no FINAL, retorne EXATAMENTE este bloco JSON com os dados extraídos APENAS desta última mensagem do usuário (use null para campos não mencionados):

###JSON###{"full_name":null,"email":null,"destination":null,"travel_date_start":null,"travel_date_end":null,"flexible_dates":null,"flexible_dates_description":null,"travelers_count":null,"budget_estimate":null,"preferences":null,"ai_summary":null,"extras":{}}

Regras do JSON:
- "travel_date_start" e "travel_date_end" devem ser strings no formato "YYYY-MM-DD" ou null
- "flexible_dates" é true só se a pessoa disser que as datas são flexíveis
- "travelers_count" é o total de viajantes (número inteiro)
- "budget_estimate" é um número em reais (sem símbolo) ou null
- "preferences" é um texto curto resumindo preferências mencionadas NESTA mensagem (não repita o que já foi coletado)
- "ai_summary" é um resumo geral atualizado da viagem (1-2 frases) — só preencha quando tiver mudanças significativas
- "extras" pode conter qualquer dado extra estruturado relevante (ex: {"motivo":"lua de mel","com_criancas":true})
- O JSON deve ser válido e na ÚLTIMA linha da resposta`

  const systemPrompt = isExistingClient ? clientPrompt : leadPrompt

  const aiMessages: any[] = [{ role: 'system', content: systemPrompt }]
  for (const msg of (sessionState.messages || [])) {
    aiMessages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content })
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: aiMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Lead AI error:', response.status, errText)
      return { reply: 'Olá! Sou a assistente da Altivus Turismo ✈️ Em que destino você está pensando para a sua próxima viagem?', extracted: null }
    }

    const data = await response.json()
    let reply = data.choices?.[0]?.message?.content || 'Pode me contar mais sobre a viagem dos seus sonhos?'

    let extracted: any = null
    const jsonMatch = reply.match(/###JSON###([\s\S]+)$/)
    if (jsonMatch) {
      try {
        extracted = JSON.parse(jsonMatch[1].trim())
        reply = reply.replace(/###JSON###[\s\S]+$/, '').trim()
      } catch (e) {
        console.error('Failed to parse lead AI JSON:', e)
      }
    }

    return { reply, extracted }
  } catch (e) {
    console.error('Lead AI call error:', e)
    return { reply: 'Tive um probleminha técnico aqui. Pode repetir? 😊', extracted: null }
  }
}
