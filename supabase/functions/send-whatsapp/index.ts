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
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')
    const ZAPI_SECURITY_TOKEN = Deno.env.get('ZAPI_SECURITY_TOKEN')

    if (!ZAPI_INSTANCE_ID) throw new Error('ZAPI_INSTANCE_ID não configurado')
    if (!ZAPI_TOKEN) throw new Error('ZAPI_TOKEN não configurado')
    if (!ZAPI_SECURITY_TOKEN) throw new Error('ZAPI_SECURITY_TOKEN não configurado')

    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action, phone, message, quote_id, image_url, document_url, document_name, contact_name, audio_url, is_group, group_id } = body
    const isGroupSend = is_group === true || !!group_id

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Telefone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve agent display label (nickname → full_name → "Atendente").
    // Embedded into outgoing text so the historic record never changes
    // even if the user later updates their nickname.
    let agentLabel = 'Atendente'
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, full_name')
        .eq('user_id', user.id)
        .maybeSingle()
      const p = profile as { nickname?: string | null; full_name?: string | null } | null
      const candidate = (p?.nickname?.trim() || p?.full_name?.trim() || '').trim()
      if (candidate) agentLabel = candidate
    } catch (_) { /* ignore — fallback to "Atendente" */ }

    const prefixWithAgent = (txt?: string | null) => {
      const t = (txt ?? '').toString()
      return t ? `*${agentLabel}*\n${t}` : `*${agentLabel}*`
    }

    const textWithAgent = prefixWithAgent(message)
    const captionWithAgent = (image_url || document_url) ? prefixWithAgent(message) : message

    // Clean phone number - remove non-digits
    const cleanPhone = phone.replace(/\D/g, '')

    const zapiHeaders = {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_SECURITY_TOKEN,
    }

    const baseUrl = `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`

    let response: Response
    let result: any

    switch (action) {
      case 'send-text': {
        if (!message) {
          return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        response = await fetch(`${baseUrl}/send-text`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            message: textWithAgent,
          }),
        })
        result = await response.json()
        break
      }

      case 'send-image': {
        if (!image_url) {
          return new Response(JSON.stringify({ error: 'URL da imagem é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        response = await fetch(`${baseUrl}/send-image`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            image: image_url,
            caption: captionWithAgent || '',
          }),
        })
        result = await response.json()
        break
      }

      case 'send-document': {
        if (!document_url) {
          return new Response(JSON.stringify({ error: 'URL do documento é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        response = await fetch(`${baseUrl}/send-document/pdf`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            document: document_url,
            fileName: document_name || 'documento.pdf',
            caption: captionWithAgent || '',
          }),
        })
        result = await response.json()
        break
      }

      case 'send-audio': {
        if (!audio_url) {
          return new Response(JSON.stringify({ error: 'URL do áudio é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        response = await fetch(`${baseUrl}/send-audio`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            audio: audio_url,
            viewOnce: false,
            waveform: true,
          }),
        })
        result = await response.json()
        break
      }


      case 'send-link': {
        if (!message) {
          return new Response(JSON.stringify({ error: 'Mensagem é obrigatória' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        response = await fetch(`${baseUrl}/send-link`, {
          method: 'POST',
          headers: zapiHeaders,
          body: JSON.stringify({
            phone: cleanPhone,
            message: textWithAgent,
            image: image_url || '',
            linkUrl: body.link_url || '',
            title: body.link_title || '',
            linkDescription: body.link_description || '',
          }),
        })
        result = await response.json()
        break
      }

      case 'check-number': {
        response = await fetch(`${baseUrl}/phone-exists/${cleanPhone}`, {
          method: 'GET',
          headers: zapiHeaders,
        })
        result = await response.json()
        break
      }

      case 'get-status': {
        response = await fetch(`${baseUrl}/status`, {
          method: 'GET',
          headers: zapiHeaders,
        })
        result = await response.json()
        break
      }

      default:
        return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    // Log the action if quote_id is provided
    if (quote_id && (action === 'send-text' || action === 'send-link' || action === 'send-image')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single()

      await supabase.from('quote_history').insert({
        quote_id,
        user_id: user.id,
        user_name: profile?.full_name || user.email,
        action: 'whatsapp_sent',
        description: `Mensagem WhatsApp enviada para ${phone}`,
      })
    }

    // ===== Espelha mensagem enviada na Central de Atendimento =====
    try {
      const sendableActions = ['send-text', 'send-image', 'send-document', 'send-link', 'send-audio']
      if (sendableActions.includes(action)) {
        const serviceClient = createClient(
          supabaseUrl,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        let messageType = 'text'
        let content: string | null = textWithAgent ?? null
        let mediaUrl: string | null = null
        let mediaCaption: string | null = null
        if (action === 'send-image') {
          messageType = 'image'; mediaUrl = image_url ?? null; mediaCaption = captionWithAgent ?? null; content = null
        } else if (action === 'send-document') {
          messageType = 'document'; mediaUrl = document_url ?? null; mediaCaption = captionWithAgent ?? null; content = null
        } else if (action === 'send-audio') {
          messageType = 'audio'; mediaUrl = audio_url ?? null; content = null
        } else if (action === 'send-link') {
          messageType = 'text'; content = `${textWithAgent ?? ''}\n${body.link_url ?? ''}`.trim()
        }

        const preview =
          messageType === 'text' ? (content ?? '').slice(0, 200) :
          messageType === 'image' ? '📷 Imagem' :
          messageType === 'audio' ? '🎤 Áudio' :
          messageType === 'document' ? '📄 Documento' : 'Mensagem'

        // Se o usuário não informou um nome, tenta buscar o nome do contato no WhatsApp via Z-API
        // (skip para grupos — group name vem do webhook)
        let resolvedName: string | null = contact_name && String(contact_name).trim() ? String(contact_name).trim() : null
        if (!resolvedName && !isGroupSend) {
          try {
            const contactRes = await fetch(`${baseUrl}/contacts/${cleanPhone}`, {
              method: 'GET',
              headers: zapiHeaders,
            })
            if (contactRes.ok) {
              const contactData: any = await contactRes.json()
              const entry = Array.isArray(contactData) ? contactData[0] : contactData
              const candidate =
                entry?.name || entry?.vname || entry?.short || entry?.notify || entry?.pushname || null
              if (candidate && String(candidate).trim() && !/^\+?\d/.test(String(candidate).trim())) {
                resolvedName = String(candidate).trim()
              }
            }
          } catch (e) {
            console.warn('Z-API contact lookup failed:', (e as Error)?.message)
          }
        }

        const nowIso = new Date().toISOString()
        let convo: { id: string } | null = null

        if (isGroupSend) {
          const gid = (group_id || cleanPhone) as string
          const groupPayload: Record<string, unknown> = {
            phone: gid,
            group_id: gid,
            is_group: true,
            last_message_text: preview,
            last_message_at: nowIso,
            last_message_from: 'agent',
            updated_at: nowIso,
          }
          if (resolvedName) {
            groupPayload.group_subject = resolvedName
            groupPayload.contact_name = resolvedName
          }
          const { data } = await serviceClient
            .from('wa_conversations')
            .upsert(groupPayload, { onConflict: 'group_id' })
            .select('id')
            .single()
          convo = data as any
        } else {
          const convoPayload: Record<string, unknown> = {
            phone: cleanPhone,
            last_message_text: preview,
            last_message_at: nowIso,
            last_message_from: 'agent',
            updated_at: nowIso,
          }
          if (resolvedName) convoPayload.contact_name = resolvedName
          const { data } = await serviceClient
            .from('wa_conversations')
            .upsert(convoPayload, { onConflict: 'phone' })
            .select('id')
            .single()
          convo = data as any
        }


        if (convo) {
          await serviceClient.from('wa_messages').insert({
            conversation_id: convo.id,
            direction: 'out',
            sender: 'agent',
            message_type: messageType,
            content,
            media_url: mediaUrl,
            media_caption: mediaCaption,
            zapi_message_id: result?.messageId || result?.id || null,
            status: 'sent',
            raw: { action, payload: body, response: result },
          })

        }
      }
    } catch (mirrorErr) {
      console.error('Service Center mirror (out) failed:', mirrorErr)
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Erro Z-API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
