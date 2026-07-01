import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZAPI_BASE_URL = 'https://api.z-api.io'

let notifySentByMeEnsuredAt = 0
const NOTIFY_SENT_BY_ME_REFRESH_MS = 6 * 60 * 60 * 1000

async function ensureNotifySentByMe(instanceId: string, token: string, clientToken: string) {
  const now = Date.now()
  if (now - notifySentByMeEnsuredAt < NOTIFY_SENT_BY_ME_REFRESH_MS) return
  notifySentByMeEnsuredAt = now

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)
  let confirmed = false
  try {
    const res = await fetch(`${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/update-notify-sent-by-me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({ notifySentByMe: true }),
      signal: controller.signal,
    })
    const txt = await res.text().catch(() => '')
    if (!res.ok) {
      console.warn('[whatsapp-webhook] Falha ao garantir notifySentByMe:', res.status, txt.slice(0, 300))
    } else {
      confirmed = true
      console.log('[whatsapp-webhook] notifySentByMe confirmado na Z-API')
    }
  } catch (err) {
    console.warn('[whatsapp-webhook] Não foi possível confirmar notifySentByMe:', err instanceof Error ? err.message : err)
  } finally {
    if (!confirmed) notifySentByMeEnsuredAt = 0
    clearTimeout(timeout)
  }
}

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

// O senderName do Z-API pode vir como o nome da AGÊNCIA (push name da própria
// instância do WhatsApp), especialmente em mensagens fromMe. Nesses casos NÃO
// devemos usar como "nome do cliente" — preferimos o telefone até a pessoa
// se identificar.
const AGENCY_NAME_RES = [/altivus/i, /turismo$/i]
function isAgencyName(name: string | null | undefined): boolean {
  const n = (name || '').trim()
  if (!n) return false
  return AGENCY_NAME_RES.some((re) => re.test(n))
}

function extractVcardName(vcard: string): string | null {
  const fn = vcard.match(/^FN:(.+)$/im)?.[1]?.trim()
  if (fn) return fn
  const n = vcard.match(/^N:([^;\n]+)/im)?.[1]?.trim()
  return n || null
}

function extractVcardPhones(vcard: string): string[] {
  const phones = new Set<string>()
  for (const match of vcard.matchAll(/waid=(\d+)/gi)) phones.add(match[1])
  for (const match of vcard.matchAll(/^TEL[^:\n]*:(.+)$/gim)) {
    const digits = String(match[1] || '').replace(/\D/g, '')
    if (digits) phones.add(digits)
  }
  return Array.from(phones)
}

function contactPayloads(body: any): any[] {
  const payloads: any[] = []
  const seen = new WeakSet<object>()

  const push = (value: any) => {
    if (!value) return
    if (Array.isArray(value)) return value.forEach(push)
    payloads.push(value)
  }

  const hasVcard = (value: any): boolean => {
    if (typeof value === 'string') return /BEGIN:VCARD|\bVCARD\b|^FN:|\nFN:|\nTEL/i.test(value)
    if (!value || typeof value !== 'object') return false
    return !!(value.vCard || value.vcard || value.vCardString || value.vcardString || value.contactVcard || value.vcardStringRaw)
  }

  const isContactLikeObject = (value: any): boolean => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const keys = Object.keys(value)
    const keyText = keys.join('|')
    const hasName = !!(value.displayName || value.name || value.fullName || value.formattedName || value.notifyName || value.verifiedName)
    const hasPhone = !!(value.phone || value.number || value.phoneNumber || value.phoneNumbers || value.phones || value.waid || value.id)
    return hasVcard(value) || (/contact|vcard|contactsArrayMessage|contactMessage/i.test(keyText) && (hasName || hasPhone || hasVcard(value))) || (hasName && hasPhone)
  }

  const visit = (value: any, keyHint = '') => {
    if (!value) return
    if (typeof value === 'string') {
      if (/vcard/i.test(keyHint) || hasVcard(value)) push(value)
      return
    }
    if (Array.isArray(value)) return value.forEach((item) => visit(item, keyHint))
    if (typeof value !== 'object') return
    if (seen.has(value)) return
    seen.add(value)

    if (isContactLikeObject(value) && /contact|vcard/i.test(keyHint)) push(value)

    for (const [key, child] of Object.entries(value)) {
      if (/^(contact|contacts|contactMessage|contactsArrayMessage|vCard|vcard|vCardString|vcardString|contactVcard|contactArray|contactsArray|sharedContact|sharedContacts|contactCard|contactCards)$/i.test(key)) {
        if (child && typeof child === 'object' && !Array.isArray(child) && 'contacts' in (child as any)) {
          push((child as any).contacts)
        } else {
          push(child)
        }
      }
      visit(child, key)
    }
  }

  visit(body)

  // Remove duplicados por conteúdo para evitar renderizar o mesmo vCard duas vezes.
  const unique = new Map<string, any>()
  for (const p of payloads.filter(Boolean)) {
    const key = typeof p === 'string' ? p : JSON.stringify(p)
    unique.set(key, p)
  }
  return Array.from(unique.values())
}

function normalizeContactPayload(payload: any): { name: string | null; phones: string[]; vcard: string | null } | null {
  if (!payload) return null
  const vcard = typeof payload === 'string'
    ? payload
    : (payload.vCard || payload.vcard || payload.vCardString || payload.vcardString || payload.contactVcard || null)

  const phones = new Set<string>()
  const addPhone = (value: any) => {
    if (!value) return
    if (Array.isArray(value)) return value.forEach(addPhone)
    if (typeof value === 'object') {
      addPhone(value.phone || value.number || value.waid || value.id || value.value)
      return
    }
    const digits = String(value).replace(/\D/g, '')
    if (digits) phones.add(digits)
  }

  if (typeof payload === 'object') {
    addPhone(payload.phones)
    addPhone(payload.phoneNumbers)
    addPhone(payload.phoneNumber)
    addPhone(payload.phone)
    addPhone(payload.number)
    addPhone(payload.waid)
  }
  if (vcard) extractVcardPhones(String(vcard)).forEach((p) => phones.add(p))

  const name = typeof payload === 'object'
    ? (payload.displayName || payload.name || payload.fullName || payload.formattedName || payload.notifyName || payload.verifiedName || extractVcardName(String(vcard || '')) || null)
    : extractVcardName(String(vcard || ''))

  if (!name && phones.size === 0 && !vcard) return null
  return { name: name ? String(name).trim() : null, phones: Array.from(phones), vcard: vcard ? String(vcard) : null }
}

function isOfficialZapiContact(body: any): boolean {
  return !!(
    body?.contact?.vCard ||
    body?.contact?.vcard ||
    body?.contact?.displayName ||
    body?.contact?.phones?.length
  )
}

function formatSharedContactContent(body: any): string {
  const normalizedContacts = contactPayloads(body)
    .map(normalizeContactPayload)
    .filter(Boolean) as { name: string | null; phones: string[]; vcard: string | null }[]

  const unique = new Map<string, { name: string | null; phones: string[]; vcard: string | null }>()
  for (const c of normalizedContacts) {
    const phoneKey = c.phones.map((p) => p.replace(/\D/g, '')).filter(Boolean).sort().join(',')
    const key = phoneKey || (c.name || '').toLowerCase() || (c.vcard || '').slice(0, 120)
    if (!key) continue
    const prev = unique.get(key)
    if (!prev) unique.set(key, c)
    else {
      unique.set(key, {
        name: prev.name || c.name,
        phones: Array.from(new Set([...(prev.phones || []), ...(c.phones || [])])),
        vcard: prev.vcard || c.vcard,
      })
    }
  }

  const contacts = Array.from(unique.values())

  if (contacts.length === 0) return 'Contato compartilhado'

  return contacts.map((c, idx) => {
    const title = c.name || (contacts.length > 1 ? `Contato ${idx + 1}` : 'Contato compartilhado')
    const lines = [title, ...c.phones.map((p) => `+${p}`)]
    return lines.join('\n')
  }).join('\n\n')
}

function lidMentionKey(value: any): string | null {
  if (!value) return null
  const raw = String(value)
  if (!/@lid$/i.test(raw) && !/^\d{10,20}$/.test(raw)) return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 20 ? digits : null
}

function cleanMentionPhone(value: any): string | null {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits || digits.length < 10 || digits.length > 15 || digits.startsWith('120363')) return null
  return digits
}

function addMentionMapEntry(map: Map<string, string>, lid: any, phone: any) {
  const key = lidMentionKey(lid)
  const cleanPhone = cleanMentionPhone(phone)
  if (key && cleanPhone) map.set(key, cleanPhone)
}

function collectLidPhoneMappings(value: any, map: Map<string, string>, seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object') return
  if (seen.has(value)) return
  seen.add(value)

  if (Array.isArray(value)) {
    value.forEach((item) => collectLidPhoneMappings(item, map, seen))
    return
  }

  addMentionMapEntry(
    map,
    value.participantLid || value.chatLid || value.lid || value.contactLid || value.mentionedLid || value.id,
    value.participantPhone || value.phoneNumber || value.phone || value.number || value.waid,
  )

  for (const child of Object.values(value)) collectLidPhoneMappings(child, map, seen)
}

async function normalizeGroupMentionText(supabase: any, groupId: string | null, text: string | null, currentPayload?: any): Promise<string | null> {
  if (!text || !/@\d{10,20}\b/.test(text)) return text

  const mentionMap = new Map<string, string>()
  collectLidPhoneMappings(currentPayload, mentionMap)

  try {
    if (groupId) {
      const { data: groupConvo } = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('group_id', groupId)
        .maybeSingle()

      if (groupConvo?.id) {
        const { data: rows } = await supabase
          .from('wa_messages')
          .select('sender_phone, raw')
          .eq('conversation_id', groupConvo.id)
          .order('created_at', { ascending: false })
          .limit(1000)

        for (const row of rows ?? []) {
          addMentionMapEntry(mentionMap, row?.raw?.participantLid, row?.sender_phone || row?.raw?.participantPhone)
          collectLidPhoneMappings(row?.raw, mentionMap)
        }
      }
    }
  } catch (err) {
    console.warn('[whatsapp-webhook] Falha ao resolver menções LID:', err instanceof Error ? err.message : err)
  }

  return text.replace(/@(\d{10,20})(?!\d)/g, (full, lidDigits) => {
    const phone = mentionMap.get(String(lidDigits))
    return phone ? `@${phone}` : full
  })
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
    // Token específico do webhook (separado do Account Security Token usado nas chamadas SAINDO).
    // Configure no painel Z-API o webhook como `?token=<ZAPI_WEBHOOK_TOKEN>`.
    const zapiWebhookToken = Deno.env.get('ZAPI_WEBHOOK_TOKEN') || ''

    // Valida que a requisição realmente veio da Z-API.
    // Aceita o token via header (`Client-Token`) OU query string (`?token=...`).
    // Com ZAPI_WEBHOOK_TOKEN configurado, o token é OBRIGATÓRIO e precisa bater.
    if (zapiWebhookToken) {
      const url = new URL(req.url)
      const headerToken =
        req.headers.get('client-token') ||
        req.headers.get('Client-Token') ||
        req.headers.get('x-client-token') ||
        ''
      const queryToken = url.searchParams.get('token') || url.searchParams.get('secret') || ''
      const provided = headerToken || queryToken
      if (!provided || provided !== zapiWebhookToken) {
        console.warn('Webhook rejected: missing or invalid webhook token')
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Garante automaticamente que mensagens enviadas pelo WhatsApp Web/celular
    // (incluindo contatos compartilhados) sejam disparadas no webhook "Ao receber".
    // Sem essa opção ativa na Z-API, o Compass só vê algumas mensagens fromMe e
    // tipos como contato podem simplesmente não chegar ao webhook.
    const notifySentByMePromise = ensureNotifySentByMe(zapiInstanceId, zapiToken, zapiSecurityToken)
    const edgeRuntime = (globalThis as any).EdgeRuntime
    if (typeof edgeRuntime?.waitUntil === 'function') edgeRuntime.waitUntil(notifySentByMePromise)
    else notifySentByMePromise.catch(() => {})

    const body = await req.json()
    console.log('Webhook payload:', JSON.stringify(body).substring(0, 2000))

    // ===== Z-API MessageStatusCallback / DeliveryCallback / etc. =====
    // Atualiza status das mensagens enviadas (SENT, RECEIVED, READ, PLAYED, FAILED).
    // Aceita type === 'MessageStatusCallback', 'DeliveryCallback', 'ReadReceiptCallback', etc.
    const callbackType: string | undefined = typeof body.type === 'string' ? body.type : undefined
    const isCallbackType = !!callbackType && /Callback$/i.test(callbackType)
    const rawStatus: string | undefined =
      typeof body.status === 'string' ? body.status :
      typeof body.messageStatus === 'string' ? body.messageStatus :
      (callbackType === 'DeliveryCallback' ? 'DELIVERED' :
       callbackType === 'ReadReceiptCallback' ? 'READ' :
       callbackType === 'PlayedCallback' ? 'PLAYED' :
       undefined)
    const contactCandidates = contactPayloads(body)
    const hasContactContent = contactCandidates.length > 0 || isOfficialZapiContact(body)
    const hasMessageContent =
      !!body.text ||
      !!body.image ||
      !!body.audio ||
      !!body.video ||
      !!body.document ||
      !!body.body ||
      !!body.sticker ||
      !!body.location ||
      hasContactContent ||
      !!body.reaction ||
      !!body.message ||
      !!body.extendedTextMessage ||
      !!body.buttonsResponseMessage ||
      !!body.listResponseMessage ||
      !!body.templateButtonReplyMessage
    // ReceivedCallback é o webhook de mensagem propriamente dito. Mesmo quando
    // o tipo ainda não é suportado por nós (ex.: contato/localização/enquete),
    // ele precisa ser espelhado como `other` em vez de ser tratado como callback
    // de status só porque termina com "Callback" e traz status RECEIVED.
    const isReceivedMessageCallback = callbackType === 'ReceivedCallback'
    const looksLikeStatusCallback =
      !isReceivedMessageCallback && (
        (isCallbackType && !hasMessageContent) ||
        (!!rawStatus && !hasMessageContent)
      )

    if (looksLikeStatusCallback) {
      if (rawStatus) {
        const statusMap: Record<string, string> = {
          SENT: 'sent',
          RECEIVED: 'received',
          DELIVERED: 'received',
          READ: 'read',
          PLAYED: 'played',
          FAILED: 'failed',
          ERROR: 'failed',
        }
        const normalized = statusMap[rawStatus.toUpperCase()] ?? rawStatus.toLowerCase()
        const ids: string[] = Array.isArray(body.ids)
          ? body.ids
          : (body.messageId ? [body.messageId] : (body.id ? [body.id] : []))
        if (ids.length > 0) {
          const { error: stErr } = await supabase
            .from('wa_messages')
            .update({ status: normalized })
            .in('zapi_message_id', ids)
          if (stErr) console.error('wa_messages status update error:', stErr.message)
        }
      }
      return new Response(JSON.stringify({ status: 'callback_ignored', type: callbackType ?? null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }



    // Z-API webhook payload structure
    const phone = body.phone || body.from || ''

    // Extract text from many possible Z-API shapes
    const extractedText: string =
      body.text?.message ||
      body.text?.body ||
      body.message?.conversation ||
      body.message?.extendedTextMessage?.text ||
      body.extendedTextMessage?.text ||
      body.buttonsResponseMessage?.selectedDisplayText ||
      body.buttonsResponseMessage?.message ||
      body.listResponseMessage?.title ||
      body.listResponseMessage?.message ||
      body.templateButtonReplyMessage?.selectedDisplayText ||
      body.reaction?.value ||
      body.body ||
      body.caption ||
      ''

    const isTextMsg = !!extractedText
    const isImageMsg = body.image != null
    const isDocumentMsg = body.document != null
    const isAudioMsg = body.audio != null
    const isVideoMsg = body.video != null
    const isStickerMsg = body.sticker != null
    const isLocationMsg = body.location != null
    const isContactMsg = hasContactContent
    if (isContactMsg) {
      console.log('[whatsapp-webhook] Contact payload detected:', JSON.stringify({
        messageId: body.messageId || body.id || null,
        phone: body.phone || body.from || null,
        fromMe: body.fromMe === true,
        keys: Object.keys(body || {}),
        contactKeys: body.contact && typeof body.contact === 'object' ? Object.keys(body.contact) : null,
        candidates: contactCandidates.length,
      }))
    }
    const rawSenderName = body.senderName || body.chatName || ''
    // Em mensagens fromMe o Z-API devolve o nome da própria agência como
    // senderName. Também ignoramos qualquer string que pareça ser o nome da
    // agência para não poluir o nome do cliente no card.
    const senderName = (!rawSenderName || isAgencyName(rawSenderName)) ? '' : rawSenderName

    const messageText = extractedText
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

    // Detect group messages (Z-API marks groups with isGroup=true and/or phone like "120363...@g.us" / "-group")
    const isGroup =
      body.isGroup === true ||
      body.fromGroup === true ||
      /-group$/i.test(phone) ||
      /@g\.us$/i.test(phone) ||
      /^120363\d+/.test(phone.replace(/\D/g, ''))
    const groupId: string | null = isGroup ? (body.groupId || body.chatId || phone) : null
    const groupSubject: string | null = isGroup
      ? (body.chatName || body.groupName || body.subject || null)
      : null
    const participantPhone: string | null = isGroup
      ? (body.participantPhone || body.participant || body.author || null)
      : null
    const isFromMe = body.fromMe === true
    // Foto de perfil do remetente (Z-API envia em senderPhoto/photo)
    const senderPhotoUrl: string | null = (!isFromMe && (body.senderPhoto || body.photo || body.profilePicUrl)) || null

    // ===== Espelha mensagem (recebida OU enviada) na Central de Atendimento =====
    try {
      let messageType: string = 'other'
      let content: string | null = null
      let mediaUrl: string | null = null
      let mediaMime: string | null = null
      let mediaCaption: string | null = null

      if (isTextMsg) { messageType = 'text'; content = messageText }
      else if (isImageMsg) { messageType = 'image'; mediaUrl = imageUrl; mediaCaption = imageCaption }
      else if (isAudioMsg) { messageType = 'audio'; mediaUrl = audioUrl; mediaMime = audioMime }
      else if (isVideoMsg) { messageType = 'video'; mediaUrl = videoUrl; mediaMime = videoMime; mediaCaption = videoCaption }
      else if (isDocumentMsg) { messageType = 'document'; mediaUrl = documentUrl; mediaMime = documentMimeType; mediaCaption = documentCaption }
      else if (isStickerMsg) { messageType = 'sticker'; mediaUrl = stickerUrl }
      else if (isLocationMsg) { messageType = 'location'; content = JSON.stringify(body.location) }
      else if (isContactMsg) {
        messageType = 'contact'
        content = formatSharedContactContent(body)
      }
      else {
        // Unknown type — preserve a readable preview so the UI never shows just "Mensagem"
        messageType = 'other'
        try {
          const safe = { ...body }
          delete (safe as any).senderPhoto
          content = JSON.stringify(safe).slice(0, 500)
        } catch { content = 'Mensagem (formato não reconhecido)' }
      }

      const preview =
        messageType === 'text' ? (content ?? '').slice(0, 200) :
        messageType === 'image' ? '📷 Imagem' :
        messageType === 'audio' ? '🎤 Áudio' :
        messageType === 'video' ? '🎥 Vídeo' :
        messageType === 'document' ? '📄 Documento' :
        messageType === 'sticker' ? '🌟 Figurinha' :
        messageType === 'location' ? '📍 Localização' :
        messageType === 'contact' ? `👤 ${((content ?? '').split('\n')[0] || 'Contato compartilhado').slice(0, 80)}` :
        (content ?? '').slice(0, 200) || 'Mensagem'

      // ====== Garantir contato/lead/cliente ANTES da pausa global ======
      // Mesmo com IA pausada, todo número novo precisa virar Prospect no CRM e
      // todo número conhecido precisa estar vinculado à conversa.
      // Em GRUPOS pulamos toda a lógica de CRM — grupos não viram leads.
      let contactLink: { contact_id?: string; lead_id?: string; client_id?: string } = {}
      let trustedDisplayName: string | null = null
      if (!isFromMe && !isGroup) {
        try {
          const link = await ensureContactForPhone(supabase, phone, senderName)
          contactLink = {
            contact_id: link.contact_id ?? undefined,
            lead_id: link.lead_id ?? undefined,
            client_id: link.client_id ?? undefined,
          }
          const dn = (link.display_name || '').trim()
          const looksReal = !!dn && !/\d/.test(dn) && dn.split(/\s+/).filter((w) => w.length > 1).length >= 2 && !isAgencyName(dn)
          if (looksReal) trustedDisplayName = dn
        } catch (linkErr) {
          console.error('ensureContactForPhone failed:', linkErr)
        }
      }

      const nowIso = new Date().toISOString()
      const baseConvo: Record<string, unknown> = {
        last_message_text: preview,
        last_message_at: nowIso,
        last_message_from: isFromMe ? 'agent' : 'lead',
        updated_at: nowIso,
      }

      let convo: { id: string; unread_count?: number | null } | null = null
      let convoErr: { message: string } | null = null

      if (isGroup && groupId) {
        // Upsert por group_id. Não criamos como contact do CRM.
        const groupConvoPayload: Record<string, unknown> = {
          ...baseConvo,
          phone: groupId, // mantém compat com NOT NULL em phone
          is_group: true,
          group_id: groupId,
          ai_enabled: false, // grupos sem IA por padrão
        }
        if (groupSubject) {
          groupConvoPayload.group_subject = groupSubject
          groupConvoPayload.contact_name = groupSubject
        }
        const { data: existingGroup } = await supabase
          .from('wa_conversations')
          .select('id')
          .eq('group_id', groupId)
          .maybeSingle()
        const query = existingGroup?.id
          ? supabase.from('wa_conversations').update(groupConvoPayload).eq('id', existingGroup.id)
          : supabase.from('wa_conversations').upsert(groupConvoPayload, { onConflict: 'phone' })
        const { data, error } = await query
          .select('id, unread_count')
          .single()
        convo = data as any
        convoErr = error as any
      } else {
        // === LID handling ===
        // Z-API pode entregar `phone` como um identificador @lid (privacidade do
        // WhatsApp). Para não duplicar conversas (real-phone X lid), tentamos
        // resolver para uma conversa já existente antes de fazer upsert por `phone`.
        const chatLidRaw: string | null =
          (body.chatLid && typeof body.chatLid === 'string' ? body.chatLid : null) ||
          (typeof phone === 'string' && /@lid$/i.test(phone) ? phone : null)
        const phoneIsLid = typeof phone === 'string' && /@lid$/i.test(phone)

        let resolvedConvoId: string | null = null

        // 1) Outbound recém-enviado pela Central: a send-whatsapp já gravou a
        //    wa_message com zapi_message_id e a conversation_id correta. Reusar.
        const incomingMsgId = body.messageId || body.id || null
        if (isFromMe && incomingMsgId) {
          const { data: priorMsg } = await supabase
            .from('wa_messages')
            .select('conversation_id')
            .eq('zapi_message_id', incomingMsgId)
            .maybeSingle()
          if (priorMsg?.conversation_id) resolvedConvoId = priorMsg.conversation_id as string
        }

        // 2) Procura conversa existente por chat_lid OU pelo próprio phone==LID.
        //    Cobre: (a) inbound com phone real + body.chatLid encontra conv
        //    antiga criada com phone=@lid; (b) outbound onde Z-API devolve
        //    phone=@lid encontra a conv real cujo chat_lid guarda o mesmo @lid.
        if (!resolvedConvoId && chatLidRaw) {
          const { data: byLid } = await supabase
            .from('wa_conversations')
            .select('id, phone')
            .or(`chat_lid.eq.${chatLidRaw},phone.eq.${chatLidRaw}`)
            .order('phone', { ascending: true }) // dígitos vêm antes de "@lid"
            .limit(1)
            .maybeSingle()
          if (byLid?.id) resolvedConvoId = byLid.id as string
        }

        // 3) Fallback: phone real explícito.
        if (!resolvedConvoId && !phoneIsLid) {
          const { data: byPhone } = await supabase
            .from('wa_conversations')
            .select('id')
            .eq('phone', phone)
            .maybeSingle()
          if (byPhone?.id) resolvedConvoId = byPhone.id as string
        }

        if (resolvedConvoId) {
          const updatePayload: Record<string, unknown> = { ...baseConvo }
          if (chatLidRaw) updatePayload.chat_lid = chatLidRaw
          // Se a conv antiga foi criada com phone=@lid e agora chegou o
          // telefone real, promove para o número real (evita duplicidade).
          if (!phoneIsLid && phone) updatePayload.phone = phone
          if (trustedDisplayName) updatePayload.contact_name = trustedDisplayName
          if (senderPhotoUrl) updatePayload.profile_photo_url = senderPhotoUrl
          const { data, error } = await supabase
            .from('wa_conversations')
            .update(updatePayload)
            .eq('id', resolvedConvoId)
            .select('id, unread_count')
            .single()
          convo = data as any
          convoErr = error as any
        } else {
          const convoUpsert: Record<string, unknown> = {
            ...baseConvo,
            phone,
            ...contactLink,
          }
          if (chatLidRaw) convoUpsert.chat_lid = chatLidRaw
          if (trustedDisplayName) convoUpsert.contact_name = trustedDisplayName
          if (senderPhotoUrl) convoUpsert.profile_photo_url = senderPhotoUrl
          const { data, error } = await supabase
            .from('wa_conversations')
            .upsert(convoUpsert, { onConflict: 'phone' })
            .select('id, unread_count')
            .single()
          convo = data as any
          convoErr = error as any
        }
        // Suppress unused-var warning for phoneIsLid in environments that check it.
        void phoneIsLid
      }

      if (convoErr) {
        console.error('wa_conversations upsert error:', convoErr.message)
      } else if (convo) {
        if (!isFromMe) {
          await supabase
            .from('wa_conversations')
            .update({ unread_count: (convo.unread_count ?? 0) + 1 })
            .eq('id', convo.id)
        }

        // Evita duplicar mensagens enviadas pela Central (já gravadas pela send-whatsapp)
        const zapiMsgId = body.messageId || body.id || null
        let alreadyExists = false
        if (isFromMe && zapiMsgId) {
          const { data: existing } = await supabase
            .from('wa_messages')
            .select('id')
            .eq('zapi_message_id', zapiMsgId)
            .maybeSingle()
          alreadyExists = !!existing
        }

        if (!alreadyExists) {
          const { error: msgErr } = await supabase.from('wa_messages').insert({
            conversation_id: convo.id,
            direction: isFromMe ? 'out' : 'in',
            sender: isFromMe ? 'agent' : 'lead',
            message_type: messageType,
            content,
            media_url: mediaUrl,
            media_mime: mediaMime,
            media_caption: mediaCaption,
            zapi_message_id: zapiMsgId,
            status: isFromMe ? 'sent' : 'received',
            sender_phone: isGroup ? (participantPhone || null) : null,
            // Em grupos: nome do remetente real; fora de grupos, se for fromMe
            // sem casar com nenhuma mensagem enviada pela Central (dedup por
            // zapi_message_id), foi enviada direto pelo WhatsApp Web/celular —
            // marca como "Altivus Turismo" (identidade da agência) em vez do
            // push name do contato salvo no celular do cliente.
            sender_name: isGroup ? (senderName || null) : (isFromMe ? 'Altivus Turismo' : null),
            raw: body,
          })
          if (msgErr) console.error('wa_messages insert error:', msgErr.message)
        }
      }
    } catch (mirrorErr) {
      console.error('Service Center mirror failed:', mirrorErr)
    }

    if (isFromMe) {
      return new Response(JSON.stringify({ status: 'mirrored', reason: 'fromMe' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Grupos: apenas espelhar (sem IA, sem handoff, sem fluxo #pago).
    // O toggle ai_enabled fica salvo para uso futuro, mas no MVP a IA nunca responde em grupos.
    if (isGroup) {
      return new Response(JSON.stringify({ status: 'mirrored', reason: 'group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }




    // ===== Pausa global removida: fonte da verdade agora é ai_agent_status.active =====


    // ===== Se a conversa foi assumida por um humano, NÃO acionar a IA =====
    try {
      const { data: convoStatus } = await supabase
        .from('wa_conversations')
        .select('status')
        .eq('phone', phone)
        .maybeSingle()
      if (convoStatus?.status === 'human') {
        console.log(`[whatsapp-webhook] Conversa ${phone} em modo humano — IA pausada.`)
        return new Response(JSON.stringify({ status: 'human_takeover', reason: 'ai_paused' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (e) {
      console.error('Erro checando status humano:', e)
    }

    // ===== Status operacional do agente IA (toggle Ativo/Inativo) =====
    try {
      const { data: agentStatus } = await supabase
        .from('ai_agent_status')
        .select('active')
        .eq('agent_id', '1')
        .maybeSingle()
      if (agentStatus && agentStatus.active === false) {
        console.log(`[whatsapp-webhook] Agente IA inativo — apenas registrando mensagem de ${phone}.`)
        return new Response(JSON.stringify({ status: 'agent_inactive' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (e) {
      console.error('Erro checando status do agente:', e)
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

async function fetchAgentConfig(supabase: any): Promise<{ config: any } | null> {
  try {
    const { data } = await supabase
      .from('ai_agents')
      .select('config')
      .eq('id', '1')
      .maybeSingle()
    return data || null
  } catch (e) {
    console.error('[fetchAgentConfig] error:', e)
    return null
  }
}

function parseMenuChoice(text: string | null | undefined): number | null {
  if (!text) return null
  const m = String(text).trim().match(/^([1-5])\b/)
  if (m) return Number(m[1])
  const m2 = String(text).match(/\b([1-5])\b/)
  return m2 ? Number(m2[1]) : null
}

async function escalateConversation(
  supabase: any,
  zapiInstanceId: string,
  zapiToken: string,
  zapiSecurityToken: string,
  phone: string,
  leadId: string | null,
  sessionId: string,
  sessionState: any,
  replyMsg: string,
  reason: string,
) {
  try {
    if (leadId) {
      const { data: contactRow } = await supabase
        .from('contacts')
        .select('id, level')
        .or(`lead_id.eq.${leadId},phone.eq.${phone}`)
        .maybeSingle()
      if (contactRow?.id && contactRow.level === 'prospect') {
        await supabase
          .from('contacts')
          .update({ level: 'lead', promoted_to_lead_at: new Date().toISOString() })
          .eq('id', contactRow.id)
      }
    }
    await supabase
      .from('wa_conversations')
      .update({ status: 'human' })
      .eq('phone', phone)
  } catch (e) {
    console.error('[escalateConversation] erro ao escalar:', e)
  }
  await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, replyMsg)
  sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: replyMsg }]
  try {
    await supabase.from('whatsapp_sessions').update({
      state: sessionState,
      lead_id: leadId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', sessionId)
  } catch (e) {
    console.error('[escalateConversation] erro ao salvar sessão:', e)
  }
  console.log(`[handoff] conversa ${phone} escalada. motivo: ${reason}`)
}

async function sendZapiText(instanceId: string, token: string, securityToken: string, phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, '')
  const url = `${ZAPI_BASE_URL}/instances/${instanceId}/token/${token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': securityToken },
    body: JSON.stringify({ phone: cleanPhone, message }),
  })
  let zapiMessageId: string | null = null
  if (!res.ok) {
    console.error('Z-API send error:', res.status, await res.text())
  } else {
    try {
      const data = await res.clone().json()
      zapiMessageId = data?.messageId || data?.id || null
    } catch {}
  }

  // ===== Espelha resposta da IA na Central de Atendimento =====
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const preview = (message ?? '').slice(0, 200)
    const { data: convo } = await supabase
      .from('wa_conversations')
      .upsert(
        {
          phone: cleanPhone,
          last_message_text: preview,
          last_message_at: new Date().toISOString(),
          last_message_from: 'ai',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone' }
      )
      .select('id')
      .single()

    if (convo) {
      await supabase.from('wa_messages').insert({
        conversation_id: convo.id,
        direction: 'out',
        sender: 'ai',
        message_type: 'text',
        content: message,
        zapi_message_id: zapiMessageId,
      })
    }
  } catch (mirrorErr) {
    console.error('sendZapiText mirror failed:', mirrorErr)
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

  // 1) Lookup contact by phone — prioriza client_phones (DDD+número),
  //    senão cai no match clássico por sufixo em contacts.phone.
  const phoneDigits = phone.replace(/\D/g, '')
  let matchedContact: any = null
  if (phoneDigits) {
    matchedContact = await matchContactByClientPhones(supabase, phone)
    if (!matchedContact) {
      const { data: candidates } = await supabase
        .from('contacts')
        .select('id, full_name, phone, level, client_id, lead_id')
        .ilike('phone', `%${phoneDigits.slice(-9)}%`)
        .limit(10)
      matchedContact = (candidates || []).find((c: any) =>
        (c.phone || '').replace(/\D/g, '').endsWith(phoneDigits.slice(-9)),
      ) || null
    }
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

  // ===== Carrega config do agente (Detecção de Fluxo + palavras-chave de urgência) =====
  const agentConfig = await fetchAgentConfig(supabase)
  const fluxos: any = agentConfig?.config?.fluxos || {}
  const detectionMode: 'ai' | 'ask' | 'menu' = fluxos.detection || 'ai'
  const urgencyKeywords: string[] = Array.isArray(fluxos.keywords) ? fluxos.keywords : []

  // Append user message to history
  if (isTextMsg && messageText) {
    sessionState.messages = [...(sessionState.messages || []), { role: 'user', content: messageText }]
  } else {
    // Non-text messages (áudio/imagem/doc/sticker/etc.):
    // - Em modo menu: NÃO enviar nada (apenas registra) — evita spam de "Recebi seu arquivo".
    // - Em outros modos: envia o aviso UMA única vez por sessão (debounce via flag).
    const inMenuMode = detectionMode === 'menu'
    const alreadyAcked = !!sessionState.attachment_acked
    if (!inMenuMode && !alreadyAcked) {
      await sendZapiText(
        zapiInstanceId, zapiToken, zapiSecurityToken, phone,
        'Recebi seu arquivo! Pode me contar em texto também o que você está procurando? (destino, datas, quantas pessoas)',
      )
      sessionState.attachment_acked = true
    }
    sessionState.messages = [...(sessionState.messages || []), { role: 'user', content: '[anexo recebido]' }]
    await supabase.from('whatsapp_sessions').update({
      state: sessionState,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', leadSession!.id)
    return { status: 'lead_capture_attachment', lead_id: leadId, acked: !inMenuMode && !alreadyAcked }
  }

  // ===== Palavras-chave de urgência → handoff imediato =====
  if (urgencyKeywords.length > 0 && messageText) {
    const lowMsg = messageText.toLowerCase()
    const matched = urgencyKeywords.find((k) => k && lowMsg.includes(String(k).toLowerCase()))
    if (matched) {
      await escalateConversation(
        supabase, zapiInstanceId, zapiToken, zapiSecurityToken,
        phone, leadId, leadSession!.id, sessionState,
        `Detectei que você precisa de ajuda urgente. Vou te transferir agora para um(a) consultor(a) — em instantes alguém te atende. 🙏`,
        `palavra-chave de urgência: ${matched}`,
      )
      return { status: 'lead_capture_handoff', lead_id: leadId }
    }
  }

  // ===== Se o agente já iniciou a conversa manualmente, pular menu/ask inicial =====
  // Detecta se já existem mensagens outbound (agente) anteriores nesta conversa.
  // Nesse caso, o cliente está apenas respondendo a um contato prévio — não faz
  // sentido enviar o menu de boas-vindas/classificação. A IA deve responder no fluxo natural.
  let agentInitiated = false
  if (!sessionState.menu_sent && !sessionState.classification_asked) {
    try {
      const { data: convoRow } = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()
      if (convoRow?.id) {
        const { count } = await supabase
          .from('wa_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convoRow.id)
          .eq('direction', 'out')
        if ((count ?? 0) > 0) {
          agentInitiated = true
          sessionState.menu_sent = true
          sessionState.awaiting_menu_choice = false
          sessionState.classification_asked = true
          await supabase.from('whatsapp_sessions').update({
            state: sessionState,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }).eq('id', leadSession!.id)
          console.log(`[whatsapp-webhook] Agente já iniciou conversa com ${phone} — pulando menu/ask.`)
        }
      }
    } catch (e) {
      console.warn('Erro ao verificar histórico outbound:', (e as Error)?.message)
    }
  }

  // ===== Detecção: Menu numerado de opções =====
  if (detectionMode === 'menu' && !agentInitiated) {
    const MENU_TEXT =
      'Olá! 👋 Para te direcionar mais rápido, escolha uma opção respondendo apenas com o número:\n\n' +
      '1 - Nova Cotação\n' +
      '2 - Preciso de informações da minha viagem já contratada\n' +
      '3 - Estou em viagem e preciso de suporte\n' +
      '4 - Solicitações e informações de pós venda\n' +
      '5 - Falar com um Atendente'

    if (!sessionState.menu_sent) {
      await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, MENU_TEXT)
      sessionState.menu_sent = true
      sessionState.awaiting_menu_choice = true
      sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: MENU_TEXT }]
      await supabase.from('whatsapp_sessions').update({
        state: sessionState,
        lead_id: leadId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', leadSession!.id)
      return { status: 'menu_sent', lead_id: leadId }
    }

    if (sessionState.awaiting_menu_choice) {
      const choice = parseMenuChoice(messageText)
      if (!choice) {
        // Reprompt curto — não reenviar o menu inteiro a cada mensagem
        const repromptCount = (sessionState.menu_reprompt_count ?? 0) + 1
        const reprompt = repromptCount >= 3
          ? 'Não consegui entender. Vou te transferir para um(a) atendente humano(a). 🙌'
          : 'Por favor, responda apenas com o número da opção (1 a 5).'
        await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, reprompt)
        sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: reprompt }]
        sessionState.menu_reprompt_count = repromptCount
        if (repromptCount >= 3) {
          await escalateConversation(
            supabase, zapiInstanceId, zapiToken, zapiSecurityToken,
            phone, leadId, leadSession!.id, sessionState, '', 'menu: 3 tentativas inválidas — handoff automático',
          )
          return { status: 'lead_capture_handoff', lead_id: leadId }
        }
        await supabase.from('whatsapp_sessions').update({
          state: sessionState,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', leadSession!.id)
        return { status: 'menu_invalid', lead_id: leadId }
      }
      sessionState.menu_choice = choice
      sessionState.awaiting_menu_choice = false

      if (choice !== 1) {
        const reasonMap: Record<number, { msg: string; reason: string }> = {
          2: { msg: 'Perfeito! Vou te conectar com um(a) consultor(a) que tem o histórico da sua viagem para te passar todas as informações. Já já te chamam por aqui. ✈️', reason: 'menu opção 2: informações de viagem contratada' },
          3: { msg: 'Entendi, suporte em viagem é prioridade. Estou chamando um(a) consultor(a) AGORA para te ajudar. Aguarde só um instante. 🙏', reason: 'menu opção 3: suporte em viagem (prioridade)' },
          4: { msg: 'Combinado! Encaminhando para o time de pós-venda. Em instantes alguém te responde por aqui. 💙', reason: 'menu opção 4: solicitações pós-venda' },
          5: { msg: 'Claro! Já estou chamando um(a) atendente humano(a). Aguarde só um momento. 🙌', reason: 'menu opção 5: pediu atendente humano' },
        }
        const r = reasonMap[choice]
        await escalateConversation(
          supabase, zapiInstanceId, zapiToken, zapiSecurityToken,
          phone, leadId, leadSession!.id, sessionState, r.msg, r.reason,
        )
        return { status: 'lead_capture_handoff', lead_id: leadId }
      }

      // Opção 1: Nova Cotação → segue no fluxo de IA com mensagem de transição
      const ack = 'Que ótimo! 🎉 Vou te ajudar com uma nova cotação. Me conta um pouquinho — qual destino você está pensando e quando seria a viagem?'
      await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, ack)
      sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: ack }]
      await supabase.from('whatsapp_sessions').update({
        state: sessionState,
        lead_id: leadId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', leadSession!.id)
      return { status: 'menu_choice_quote', lead_id: leadId }
    }
  }

  // ===== Detecção: Perguntar ao cliente no início =====
  if (
    detectionMode === 'ask' &&
    !agentInitiated &&
    !sessionState.classification_asked &&
    (sessionState.messages?.length ?? 0) <= 1
  ) {
    const ASK_TEXT =
      'Olá! 👋 Para te ajudar melhor, você está buscando:\n\n' +
      '• Uma *nova cotação* de viagem;\n' +
      '• *Suporte* para uma viagem já contratada;\n' +
      '• Ou ainda *explorando* possibilidades?\n\n' +
      'Me conta com suas palavras o que precisa! 😊'
    await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, ASK_TEXT)
    sessionState.classification_asked = true
    sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: ASK_TEXT }]
    await supabase.from('whatsapp_sessions').update({
      state: sessionState,
      lead_id: leadId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', leadSession!.id)
    return { status: 'ask_sent', lead_id: leadId }
  }

  // Build full client context (CRM + previous conversations + quotations)
  const clientContext = await buildClientContext(supabase, {
    phone,
    matchedContact,
    leadRow,
  })

  // Resume / track conversation continuity on wa_conversations
  await trackConversationResumption(supabase, phone, clientContext)

  // Call AI to converse and extract structured data
  const ai = await callLeadCaptureAI(lovableApiKey, sessionState, leadRow, senderName, clientContext)

  // Apply extracted updates to the lead row
  const updates = buildLeadUpdates(ai.extracted, leadRow)
  if (Object.keys(updates).length > 0) {
    const { error: updErr } = await supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (updErr) console.error('Lead update error:', updErr)
  }

  // Persist newly collected structured data on the wa_conversation for memory
  try {
    const newCollected: Record<string, any> = {}
    const fields = ['destination', 'travel_date_start', 'travel_date_end', 'travelers_count', 'budget_estimate', 'preferences', 'email', 'full_name']
    for (const f of fields) {
      const v = ai.extracted?.[f]
      if (v !== null && v !== undefined && v !== '') newCollected[f] = v
    }
    if (ai.extracted?.extras && typeof ai.extracted.extras === 'object') {
      Object.assign(newCollected, ai.extracted.extras)
    }
    if (Object.keys(newCollected).length > 0) {
      const { data: convoRow } = await supabase
        .from('wa_conversations')
        .select('id, collected_data')
        .eq('phone', phone)
        .maybeSingle()
      if (convoRow?.id) {
        await supabase
          .from('wa_conversations')
          .update({
            collected_data: { ...(convoRow.collected_data || {}), ...newCollected },
          })
          .eq('id', convoRow.id)
      }
    }
  } catch (e) {
    console.error('[collected_data persist] error:', e)
  }

  // ===== DENY_IDENTITY: o usuário disse que não é o cliente associado ao número =====
  // Política: NUNCA alteramos client_phones automaticamente. Apenas:
  //  1) Desvinculamos a conversa atual do cliente
  //  2) Criamos um novo Lead (prospect) para esse número
  //  3) Notificamos admins/managers para revisarem o telefone na ficha do cliente
  if (ai.extracted?.deny_identity === true && matchedContact?.client_id) {
    try {
      const clientId = matchedContact.client_id
      const previousName = matchedContact.full_name || 'o cliente'
      const nowIso = new Date().toISOString()

      // 1) Cria novo Lead/Prospect para o número (sem vínculo com o cliente)
      const cleanName = formatPhonePlaceholder(phone)
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          full_name: cleanName,
          phone,
          source: 'whatsapp_ai',
          status: 'new',
          ai_collected_data: { whatsapp_sender_name: senderName || null, deny_identity_from_client_id: clientId },
        })
        .select('id, full_name')
        .single()

      const newLeadId = newLead?.id ?? null

      // 2) Encontra o novo contact criado pelo trigger e desvincula a conversa do cliente
      let newContactId: string | null = null
      if (newLeadId) {
        const { data: newContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('lead_id', newLeadId)
          .maybeSingle()
        newContactId = newContact?.id ?? null
      }

      const { data: convoRow } = await supabase
        .from('wa_conversations')
        .update({
          client_id: null,
          contact_id: newContactId,
          lead_id: newLeadId,
          contact_name: cleanName,
          status: 'ai',
          updated_at: nowIso,
        })
        .eq('phone', phone)
        .select('id')
        .maybeSingle()

      // 3) Notifica admins/managers (sem botão de atalho — operador edita na ficha)
      const { data: staff } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'manager'])
      const recipients = Array.from(new Set((staff || []).map((s: any) => s.user_id)))
      if (recipients.length > 0) {
        const convoLink = convoRow?.id ? `/whatsapp?conversation=${convoRow.id}` : '/whatsapp'
        const notifRows = recipients.map((uid) => ({
          user_id: uid,
          type: 'phone_identity_change',
          title: 'Telefone de cliente pode estar desatualizado',
          message: `${previousName} aparentemente não usa mais o número ${formatPhonePlaceholder(phone)}, conforme conversa no WhatsApp. Revise os telefones na ficha do cliente.`,
          link: `/clients?id=${clientId}`,
          metadata: {
            client_id: clientId,
            phone,
            conversation_id: convoRow?.id || null,
            conversation_link: convoLink,
            new_lead_id: newLeadId,
          },
        }))
        await supabase.from('notifications').insert(notifRows)
      }

      console.log(`[deny_identity] número ${phone} desvinculado do cliente ${clientId}; novo lead ${newLeadId}`)

      // Reseta a sessão para um novo lead capture limpo
      sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: ai.reply }]
      await supabase.from('whatsapp_sessions').update({
        state: { messages: [], sender_name: senderName },
        lead_id: newLeadId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', leadSession!.id)

      await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, ai.reply)
      return { status: 'identity_denied', lead_id: newLeadId }
    } catch (e) {
      console.error('[deny_identity] erro:', e)
    }
  }

  // Safety net: se a IA prometeu que um humano entrará em contato (sem marcar
  // escalate_to_human), forçamos o handoff para que admins/managers sejam
  // notificados — caso contrário o cliente fica esperando ninguém.
  const replyText = String(ai.reply || '').toLowerCase()
  const handoffPromiseRe = /(consultor|atendente|equipe|algu[ée]m|um\s+human[oa])[^.!?\n]{0,80}(entrar[áa]|entrar[ãa]o|vai\s+entrar|v[ãa]o\s+entrar|chamar[áa]|chamando|te\s+chamam|te\s+atende|dar[áa]\s+continuidade|assumir[áa]|assumindo|retornar[áa]|retorno\s+em\s+breve)|em\s+breve.{0,40}(entrar[áa]|contato|atende)|transferir.{0,30}(consultor|atendente|humano)/i
  const promisedHumanFollowUp = handoffPromiseRe.test(ai.reply || '')
  const shouldEscalate = ai.extracted?.escalate_to_human === true || promisedHumanFollowUp
  if (shouldEscalate) {
    if (!ai.extracted?.escalate_to_human && promisedHumanFollowUp) {
      console.log(`[handoff] safety-net: IA prometeu contato humano sem marcar escalate_to_human. Forçando handoff.`)
    }
    const reason = (ai.extracted?.escalation_reason || (promisedHumanFollowUp ? 'IA prometeu retorno humano ao cliente' : 'sinal de handoff detectado pela IA')).toString().slice(0, 200)
    try {
      // 1) Garantir que o contato esteja como 'lead' (ou superior). Trigger anti-regressão protege 'cliente'.
      const { data: contactRow } = await supabase
        .from('contacts')
        .select('id, level')
        .or(`lead_id.eq.${leadId},phone.eq.${phone}`)
        .maybeSingle()
      if (contactRow?.id && contactRow.level === 'prospect') {
        await supabase
          .from('contacts')
          .update({ level: 'lead', promoted_to_lead_at: new Date().toISOString() })
          .eq('id', contactRow.id)
        console.log(`[handoff] contato ${contactRow.id} promovido prospect→lead. motivo: ${reason}`)
      }

      // 2) Mudar wa_conversations.status para 'human' (o trigger DB notifica admins/managers)
      const { data: convoRow } = await supabase
        .from('wa_conversations')
        .update({ status: 'human' })
        .eq('phone', phone)
        .select('id')
        .maybeSingle()

      console.log(`[handoff] conversa ${phone} escalada para humano. motivo: ${reason}`)

      // 3) Gera resumo interno via IA e posta como NOTA INTERNA na Central
      //    (is_internal=true → não é enviada ao cliente; renderizada como aviso
      //    amarelo para o atendente humano com contexto da conversa).
      if (convoRow?.id) {
        try {
          const transcript = (sessionState.messages || [])
            .slice(-30)
            .map((m: any) => `${m.role === 'user' ? 'Cliente' : 'IA'}: ${String(m.content || '').slice(0, 500)}`)
            .join('\n')
          const knownJson = JSON.stringify({
            nome: leadRow?.full_name || matchedContact?.full_name || senderName,
            telefone: phone,
            destino: leadRow?.destination,
            data_ini: leadRow?.travel_date_start,
            data_fim: leadRow?.travel_date_end,
            datas_flexiveis: leadRow?.flexible_dates,
            viajantes: leadRow?.travelers_count,
            orcamento: leadRow?.budget_estimate,
            preferencias: leadRow?.preferences,
            email: leadRow?.email,
          }, null, 2)

          const sumPrompt = `Você é um assistente que prepara um BRIEFING INTERNO curto para um(a) consultor(a) humano(a) que vai assumir um atendimento WhatsApp.

NUNCA cumprimente, NUNCA fale com o cliente — esta nota é só para a equipe ler.

Motivo do handoff: ${reason}

Dados coletados:
${knownJson}

Últimas mensagens da conversa:
${transcript}

Responda em PT-BR usando exatamente este formato em markdown (≤120 palavras):

**📋 Resumo do atendimento**
- **Cliente:** <nome ou "não informado">
- **Quer:** <intenção principal em 1 linha>
- **Status:** <o que já foi coletado / o que falta>

**🎯 Próximo passo sugerido**
<1-2 frases objetivas do que fazer agora ao assumir>`

          const sumRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{ role: 'user', content: sumPrompt }],
            }),
          })
          let summaryText = ''
          if (sumRes.ok) {
            const sumData = await sumRes.json()
            summaryText = String(sumData?.choices?.[0]?.message?.content || '').trim()
          }
          if (!summaryText) {
            summaryText = `**📋 Resumo do atendimento**\n- **Motivo do handoff:** ${reason}\n- **Telefone:** ${phone}\n\n**🎯 Próximo passo sugerido**\nAssuma a conversa e revise o histórico acima para dar continuidade.`
          }

          const finalNote = `🤝 *Handoff para atendente humano*\n_Motivo: ${reason}_\n\n${summaryText}`

          await supabase.from('wa_messages').insert({
            conversation_id: convoRow.id,
            direction: 'internal',
            sender: 'system',
            message_type: 'text',
            content: finalNote,
            is_internal: true,
            status: 'sent',
            raw: { kind: 'handoff_summary', reason },
          })
          console.log(`[handoff] nota interna de resumo inserida na conversa ${convoRow.id}`)
        } catch (sumErr) {
          console.error('[handoff] falha ao gerar/inserir resumo interno:', sumErr)
        }
      }
    } catch (e) {
      console.error('[handoff] erro ao escalar:', e)
    }
  }

  sessionState.messages = [...(sessionState.messages || []), { role: 'assistant', content: ai.reply }]

  await supabase.from('whatsapp_sessions').update({
    state: sessionState,
    lead_id: leadId,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).eq('id', leadSession!.id)

  await sendZapiText(zapiInstanceId, zapiToken, zapiSecurityToken, phone, ai.reply)

  return { status: shouldEscalate ? 'lead_capture_handoff' : 'lead_capture_processed', lead_id: leadId }
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
  clientContext: any = null,
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

  const isExistingClient = clientContext?.client_type === 'cliente'
  const clientFirstName = (clientContext?.name || '').split(' ')[0] || ''
  const contextBlock = buildClientContextBlock(clientContext)

  const clientPrompt = `Você é um(a) consultor(a) de viagens da **Altivus Turismo** atendendo um(a) CLIENTE JÁ EXISTENTE pelo WhatsApp.

Nome do cliente: ${clientContext?.name || senderName}
Primeiro nome: ${clientFirstName || '—'}

${contextBlock}

Regras OBRIGATÓRIAS:
1. Cumprimente o cliente PELO PRIMEIRO NOME ("${clientFirstName}") de forma calorosa e personalizada.
2. NÃO faça perguntas de qualificação (não pergunte destino, datas, viajantes ou orçamento de forma genérica).
3. Pergunte diretamente "Como posso te ajudar hoje?" — pode ser uma nova viagem, dúvida sobre uma viagem em andamento, ou outro suporte.
4. Se houver última viagem registrada, pode mencionar de leve ("espero que tenha sido incrível!") sem ser invasivo.
5. Use português brasileiro, tom premium e próximo. Emojis com moderação.
6. Mantenha a resposta curta (máx 3 linhas).
7. **IMPORTANTE — IDENTIDADE**: SEMPRE, ao final da PRIMEIRA mensagem desta conversa (e em qualquer menu numerado que você ofereça), inclua de forma discreta a opção: *"Caso você não seja o(a) ${clientFirstName}, responda 'não sou ${clientFirstName}'."* — assim contatos novos que herdaram o número conseguem se identificar.
8. **DENY_IDENTITY**: se o usuário responder de forma clara que NÃO é o(a) ${clientFirstName} (ex.: "não sou ${clientFirstName}", "esse número é meu agora", "${clientFirstName} não está mais nesse número", "sou outra pessoa"), defina **deny_identity=true** no JSON. Sua resposta deve então se desculpar brevemente, dar boas-vindas e pedir o nome — você passará a tratá-lo(a) como novo contato.

Hoje é ${today}.

**FORMATO DE RESPOSTA OBRIGATÓRIO**:
Responda primeiro a mensagem em texto natural. Depois, em uma linha separada no FINAL, retorne EXATAMENTE este bloco JSON (use null para campos não mencionados nesta mensagem):

###JSON###{"full_name":null,"email":null,"destination":null,"travel_date_start":null,"travel_date_end":null,"flexible_dates":null,"flexible_dates_description":null,"travelers_count":null,"budget_estimate":null,"preferences":null,"ai_summary":null,"extras":{},"escalate_to_human":false,"escalation_reason":null,"deny_identity":false}`

  const leadPrompt = `Você é um(a) consultor(a) de viagens da **Altivus Turismo** atendendo um contato pelo WhatsApp.

${contextBlock}


Seu papel:
1. Conversar de forma calorosa, profissional e em **português brasileiro**
2. Coletar gradualmente as informações da viagem desejada
3. Não peça tudo de uma vez — pergunte 1 ou 2 coisas por mensagem, conforme a conversa flui
4. Se a pessoa já forneceu uma informação, NÃO peça de novo
5. Use emojis com moderação (✈️ 🏝️ 🗺️)
6. Mantenha as respostas curtas (máximo 3-4 linhas)
7. Quando tiver dados suficientes (destino + datas + viajantes), avise que um consultor humano dará continuidade com uma cotação personalizada — **e nesse caso defina escalate_to_human=true** (qualquer promessa de retorno humano OBRIGA escalate_to_human=true; nunca prometa contato humano sem escalar)
8. **HANDOFF (escalate_to_human=true)**: defina como true SEMPRE que detectar que o contato precisa de atendimento humano AGORA — mesmo que ainda não tenha coletado todos os dados. Sinais claros:
   - Pedido explícito ("quero falar com atendente", "consultor humano", "alguém pode me ajudar")
   - Reclamações, urgência, problema com viagem em andamento, suporte pós-venda
   - Pergunta complexa fora do escopo de qualificação inicial (visto, documentação específica, problema com fornecedor)
   - Demonstração clara de intenção de compra com pelo menos destino definido (ex: "quero fechar agora", "manda a proposta")
   - Frustração ou repetição (a IA não conseguiu avançar em 2-3 tentativas)
   Quando escalate_to_human=true, sua mensagem deve ser curta tranquilizando o cliente que um consultor humano dará continuidade em instantes. Preencha "escalation_reason" com 1 frase curta explicando o motivo (ex: "pediu atendente", "intenção clara de compra", "suporte pós-venda").

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

###JSON###{"full_name":null,"email":null,"destination":null,"travel_date_start":null,"travel_date_end":null,"flexible_dates":null,"flexible_dates_description":null,"travelers_count":null,"budget_estimate":null,"preferences":null,"ai_summary":null,"extras":{},"escalate_to_human":false,"escalation_reason":null}

Regras do JSON:
- "travel_date_start" e "travel_date_end" devem ser strings no formato "YYYY-MM-DD" ou null
- "flexible_dates" é true só se a pessoa disser que as datas são flexíveis
- "travelers_count" é o total de viajantes (número inteiro)
- "budget_estimate" é um número em reais (sem símbolo) ou null
- "preferences" é um texto curto resumindo preferências mencionadas NESTA mensagem (não repita o que já foi coletado)
- "ai_summary" é um resumo geral atualizado da viagem (1-2 frases) — só preencha quando tiver mudanças significativas
- "extras" pode conter qualquer dado extra estruturado relevante (ex: {"motivo":"lua de mel","com_criancas":true})
- "escalate_to_human" é true APENAS quando há sinal claro de necessidade de handoff (veja regra 8)
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

/**
 * Garante que existe um Contact (e Lead, quando aplicável) para o número do WhatsApp.
 *
 * Comportamento:
 *  - Se já existe contact (prospect/lead/cliente) → reutiliza, retorna ids para vincular à conversa.
 *  - Se não existe → cria um Lead com source='whatsapp' (status='new'), o que via trigger
 *    `sync_contact_from_lead` cria automaticamente o Contact com level='prospect'.
 *  - Funciona mesmo quando a IA está globalmente pausada (modo dev).
 *
 * Roda ANTES das checagens de pausa/humano para garantir que cada número que chega
 * vire registro no CRM e apareça nos kanbans corretos.
 */
/**
 * Procura o telefone em client_phones por DDD+número (últimos 11 dígitos)
 * e retorna o contact vinculado ao cliente. Tem prioridade absoluta sobre
 * qualquer match em contacts.phone — client_phones é a fonte de verdade dos
 * telefones do cliente, gerenciada manualmente na ficha.
 */
async function matchContactByClientPhones(
  supabase: any,
  phone: string,
): Promise<any | null> {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const tail11 = digits.slice(-11)
  const tail10 = digits.slice(-10)
  const { data: phones } = await supabase
    .from('client_phones')
    .select('client_id, phone')
    .or(`phone.ilike.%${tail11}%,phone.ilike.%${tail10}%`)
    .limit(50)
  const hit = (phones || []).find((p: any) => {
    const d = (p.phone || '').replace(/\D/g, '')
    return d.endsWith(tail11) || d.endsWith(tail10)
  })
  if (!hit) return null
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, full_name, phone, level, client_id, lead_id')
    .eq('client_id', hit.client_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return contact || null
}

async function ensureContactForPhone(
  supabase: any,
  phone: string,
  senderName: string,
): Promise<{
  contact_id: string | null
  lead_id: string | null
  client_id: string | null
  display_name: string | null
}> {
  const phoneDigits = (phone || '').replace(/\D/g, '')
  if (!phoneDigits) {
    return { contact_id: null, lead_id: null, client_id: null, display_name: null }
  }

  const tail = phoneDigits.slice(-9)

  // 0) Match prioritário em client_phones (fonte de verdade do CRM)
  const clientMatch = await matchContactByClientPhones(supabase, phone)

  // 1) Procura contact existente pelo final do telefone (ignora formatação)
  const { data: candidates } = await supabase
    .from('contacts')
    .select('id, full_name, phone, level, client_id, lead_id')
    .ilike('phone', `%${tail}%`)
    .limit(10)

  const matched = clientMatch || (candidates || []).find((c: any) =>
    (c.phone || '').replace(/\D/g, '').endsWith(tail),
  )

  if (matched) {
    // Atualiza last_contact_at e detecta retorno (>30 dias sem contato)
    const nowIso = new Date().toISOString()
    const { data: full } = await supabase
      .from('contacts')
      .select('first_contact_at, last_contact_at, level')
      .eq('id', matched.id)
      .maybeSingle()

    const lastAt = full?.last_contact_at ? new Date(full.last_contact_at).getTime() : null
    const daysSince = lastAt ? (Date.now() - lastAt) / (1000 * 60 * 60 * 24) : null
    const isReactivating = daysSince !== null && daysSince > 30 && full?.level !== 'cliente'

    const updates: Record<string, unknown> = {
      last_contact_at: nowIso,
      first_contact_at: full?.first_contact_at ?? nowIso,
    }
    if (isReactivating) {
      updates.is_returning = true
      updates.returned_at = nowIso
    }
    await supabase.from('contacts').update(updates).eq('id', matched.id)

    if (matched.lead_id && isReactivating) {
      await supabase
        .from('leads')
        .update({ is_returning: true, returned_at: nowIso, last_contact_at: nowIso })
        .eq('id', matched.lead_id)
    } else if (matched.lead_id) {
      await supabase
        .from('leads')
        .update({ last_contact_at: nowIso })
        .eq('id', matched.lead_id)
    }

    console.log(`[ensureContactForPhone] Contact existente (level=${matched.level}) para ${phone}${isReactivating ? ' [REATIVADO]' : ''}`)
    return {
      contact_id: matched.id,
      lead_id: matched.lead_id ?? null,
      client_id: matched.client_id ?? null,
      display_name: matched.full_name || null,
    }
  }

  // 2) Sem contact: confere se já existe um lead pelo telefone (evita race em rajadas de mensagens)
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, full_name, phone')
    .ilike('phone', `%${tail}%`)
    .order('created_at', { ascending: false })
    .limit(5)

  let leadId: string | null =
    (existingLeads || []).find((l: any) =>
      (l.phone || '').replace(/\D/g, '').endsWith(tail),
    )?.id ?? null

  let createdName: string | null = null

  // 3) Sem lead: cria um novo. O trigger sync_contact_from_lead cria o contact como prospect.
  if (!leadId) {
    const waSenderName = (senderName || '').trim()
    const looksLikeHumanName = (s: string) =>
      !!s && !/\d/.test(s) && s.split(/\s+/).filter((w) => w.length > 1).length >= 2
    const cleanName = looksLikeHumanName(waSenderName)
      ? waSenderName
      : formatPhonePlaceholder(phone)
    createdName = cleanName

    const { data: newLead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        full_name: cleanName,
        phone,
        source: 'whatsapp',
        status: 'new',
        ai_collected_data: { whatsapp_sender_name: senderName || null },
      })
      .select('id, full_name')
      .single()

    if (leadErr) {
      console.error('[ensureContactForPhone] Lead insert error:', leadErr.message)
      return { contact_id: null, lead_id: null, client_id: null, display_name: createdName }
    }
    leadId = newLead.id
    createdName = newLead.full_name
    console.log(`[ensureContactForPhone] Novo Prospect criado para ${phone} (lead_id=${leadId})`)
  }

  // 4) Busca contact_id (criado pelo trigger) para vincular na conversa
  const { data: contactRow } = await supabase
    .from('contacts')
    .select('id, full_name, level, client_id')
    .eq('lead_id', leadId)
    .maybeSingle()

  // Marca first_contact_at/last_contact_at no contato recém-criado
  if (contactRow?.id) {
    const nowIso = new Date().toISOString()
    await supabase
      .from('contacts')
      .update({ first_contact_at: nowIso, last_contact_at: nowIso })
      .eq('id', contactRow.id)
    if (leadId) {
      await supabase.from('leads').update({ last_contact_at: nowIso }).eq('id', leadId)
    }
  }

  return {
    contact_id: contactRow?.id ?? null,
    lead_id: leadId,
    client_id: contactRow?.client_id ?? null,
    display_name: contactRow?.full_name || createdName,
  }
}

/**
 * Builds a CLIENT CONTEXT object aggregating CRM, conversations and quotations
 * for the phone number, used to inject continuity into the AI system prompt.
 */
async function buildClientContext(
  supabase: any,
  args: { phone: string; matchedContact: any; leadRow: any },
): Promise<any> {
  const { phone, matchedContact, leadRow } = args
  const phoneDigits = (phone || '').replace(/\D/g, '')
  const tail = phoneDigits.slice(-9)

  const ctx: any = {
    is_known: !!matchedContact,
    client_type: matchedContact?.level || (leadRow ? 'lead' : 'unknown'),
    name: matchedContact?.full_name || leadRow?.full_name || null,
    phone,
    email: leadRow?.email || null,
    crm_stage: leadRow?.status || null,
    tags: [],
    previous_conversations: [],
    quotations: [],
    active_trips: [],
    support_history: [],
    collected_data: {},
    last_interaction: null,
    days_since_last_contact: null,
  }

  // Previous wa_conversations (excluding current)
  try {
    const { data: prevConvos } = await supabase
      .from('wa_conversations')
      .select('id, status, summary, collected_data, last_message_at, last_message_text, updated_at')
      .eq('phone', phone)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(5)
    if (prevConvos && prevConvos.length > 0) {
      ctx.previous_conversations = prevConvos.map((c: any) => ({
        date: c.last_message_at,
        status: c.status,
        summary: c.summary || c.last_message_text || null,
      }))
      // Merge collected_data from the most recent prior conversation
      const merged: Record<string, any> = {}
      for (const c of [...prevConvos].reverse()) {
        if (c.collected_data && typeof c.collected_data === 'object') {
          Object.assign(merged, c.collected_data)
        }
      }
      ctx.collected_data = merged
      ctx.last_interaction = prevConvos[0].last_message_at
      if (prevConvos[0].last_message_at) {
        const diffMs = Date.now() - new Date(prevConvos[0].last_message_at).getTime()
        ctx.days_since_last_contact = Math.max(0, Math.floor(diffMs / 86400000))
      }
    }
  } catch (e) {
    console.error('[buildClientContext] previous conversations error:', e)
  }

  // Quotations (lead_id and/or client_id)
  try {
    const orFilters: string[] = []
    if (matchedContact?.lead_id) orFilters.push(`lead_id.eq.${matchedContact.lead_id}`)
    if (matchedContact?.client_id) orFilters.push(`client_id.eq.${matchedContact.client_id}`)
    if (leadRow?.id) orFilters.push(`lead_id.eq.${leadRow.id}`)
    if (orFilters.length > 0) {
      const { data: quotes } = await supabase
        .from('quotes')
        .select('id, title, destination, stage, conclusion_type, total_value, currency, travel_date_start, travel_date_end, created_at')
        .or(orFilters.join(','))
        .order('created_at', { ascending: false })
        .limit(5)
      if (quotes && quotes.length > 0) {
        ctx.quotations = quotes.map((q: any) => ({
          id: q.id,
          title: q.title,
          destination: q.destination,
          status: q.conclusion_type || q.stage,
          value: q.total_value,
          currency: q.currency,
          travel_start: q.travel_date_start,
          travel_end: q.travel_date_end,
          created_at: q.created_at,
        }))
        // Active trip = quote with travel dates surrounding today and stage confirmed/won
        const todayIso = new Date().toISOString().split('T')[0]
        ctx.active_trips = quotes
          .filter((q: any) =>
            q.stage === 'confirmed' &&
            q.travel_date_start && q.travel_date_end &&
            q.travel_date_start <= todayIso && q.travel_date_end >= todayIso
          )
          .map((q: any) => ({
            destination: q.destination || q.title,
            start_date: q.travel_date_start,
            end_date: q.travel_date_end,
            status: 'em_andamento',
          }))
      }
    }
  } catch (e) {
    console.error('[buildClientContext] quotes error:', e)
  }

  return ctx
}

function buildClientContextBlock(ctx: any): string {
  if (!ctx) return ''
  if (!ctx.is_known) {
    return `## CONTEXTO DO CLIENTE
Este é um contato NOVO. Nunca conversou com a Altivus antes.
Siga o fluxo padrão de identificação e coleta de dados.`
  }

  const lines: string[] = ['## CONTEXTO DO CLIENTE',
    'Este é um contato CONHECIDO. Trate-o pelo nome e demonstre continuidade.',
    `- Nome: ${ctx.name || '—'}`,
    `- Tipo: ${ctx.client_type || 'desconhecido'}`,
  ]
  if (ctx.crm_stage) lines.push(`- Etapa no CRM: ${ctx.crm_stage}`)
  if (ctx.email) lines.push(`- E-mail: ${ctx.email}`)
  if (ctx.days_since_last_contact !== null) {
    lines.push(`- Última interação: há ${ctx.days_since_last_contact} dia(s)`)
  }

  if (ctx.previous_conversations?.length > 0) {
    lines.push('', '### Conversas anteriores')
    for (const c of ctx.previous_conversations.slice(0, 3)) {
      const d = c.date ? new Date(c.date).toISOString().split('T')[0] : '—'
      lines.push(`- ${d} — status: ${c.status || '—'}${c.summary ? ` — ${String(c.summary).slice(0, 220)}` : ''}`)
    }
  }

  if (ctx.quotations?.length > 0) {
    lines.push('', '### Cotações')
    for (const q of ctx.quotations.slice(0, 5)) {
      const val = q.value ? `${q.currency || 'BRL'} ${q.value}` : ''
      lines.push(`- ${q.destination || q.title || '—'} — ${q.status || '—'}${val ? ` — ${val}` : ''}`)
    }
  } else {
    lines.push('', '### Cotações', 'Nenhuma cotação registrada.')
  }

  if (ctx.collected_data && Object.keys(ctx.collected_data).length > 0) {
    lines.push('', '### Dados já coletados anteriormente')
    for (const [k, v] of Object.entries(ctx.collected_data)) {
      if (v === null || v === undefined || v === '') continue
      lines.push(`- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    }
  }

  if (ctx.active_trips?.length > 0) {
    lines.push('', '### Viagens ativas')
    for (const t of ctx.active_trips) {
      lines.push(`- ${t.destination}: ${t.start_date} a ${t.end_date} — ${t.status}`)
    }
  }

  lines.push(
    '',
    '### INSTRUÇÕES IMPORTANTES',
    '- NÃO peça informações que você já tem (nome, destino, período, etc.)',
    '- Se o cliente retorna após uma conversa abandonada, mencione naturalmente que vocês já conversaram',
    '- Se há cotação pendente, pergunte se quer dar continuidade',
    '- Se há viagem ativa, priorize verificar se precisa de suporte',
    '- Adapte o tom: cliente que já comprou ≠ prospect novo',
  )
  return lines.join('\n')
}

/**
 * Tracks conversation resumption on wa_conversations: marks last_resumed_at,
 * resumed_from_status and days_inactive_on_resume when a contact returns
 * after an abandoned/resolved status. Also stores the client_context_snapshot.
 */
async function trackConversationResumption(
  supabase: any,
  phone: string,
  clientContext: any,
): Promise<void> {
  try {
    const { data: convo } = await supabase
      .from('wa_conversations')
      .select('id, status, last_message_at, client_context_snapshot')
      .eq('phone', phone)
      .maybeSingle()
    if (!convo) return

    const updates: Record<string, any> = {}

    // Snapshot the client context only on first message of a fresh conversation
    if (!convo.client_context_snapshot) {
      updates.client_context_snapshot = clientContext
    }

    // If previous status was abandoned/resolved, mark a resumption
    if (convo.status === 'abandoned' || convo.status === 'resolved') {
      updates.status = 'ai'
      updates.last_resumed_at = new Date().toISOString()
      updates.resumed_from_status = convo.status
      if (convo.last_message_at) {
        const days = Math.floor(
          (Date.now() - new Date(convo.last_message_at).getTime()) / 86400000,
        )
        updates.days_inactive_on_resume = days
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('wa_conversations').update(updates).eq('id', convo.id)
    }
  } catch (e) {
    console.error('[trackConversationResumption] error:', e)
  }
}
