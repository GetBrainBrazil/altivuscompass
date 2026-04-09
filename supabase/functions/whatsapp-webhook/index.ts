import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZAPI_BASE_URL = 'https://api.z-api.io'

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
    const senderName = body.senderName || body.chatName || ''

    const messageText = body.text?.message || ''
    const imageUrl = body.image?.imageUrl || body.image?.url || ''
    const documentUrl = body.document?.documentUrl || body.document?.url || ''
    const documentMimeType = body.document?.mimeType || ''

    if (!phone) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for #pago command
    const isPagoCommand = isTextMsg && messageText.trim().toLowerCase() === '#pago'
    const isCancelarCommand = isTextMsg && ['#cancelar', '#cancela', '#sair'].includes(messageText.trim().toLowerCase())

    // Find active session for this phone
    const { data: existingSession } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone', phone)
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

    // If no active session, ignore the message
    if (!existingSession) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'no active session' }), {
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
