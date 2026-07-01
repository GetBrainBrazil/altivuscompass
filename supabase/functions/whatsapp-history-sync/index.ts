import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ZAPI_BASE_URL = 'https://api.z-api.io'
const DEFAULT_CHAT_PAGE_SIZE = 50
const DEFAULT_MESSAGE_BATCH_SIZE = 20
const DEFAULT_MAX_CHATS = 250
const DEFAULT_MAX_MESSAGES_PER_CHAT = 250
const HARD_MAX_CHATS = 1000
const HARD_MAX_MESSAGES_PER_CHAT = 1000
const MULTI_DEVICE_HISTORY_UNAVAILABLE = 'A Z-API não disponibiliza histórico antigo por API em instâncias Multi Device. O Compass só consegue registrar mensagens recebidas pelo webhook após a configuração.'

type ZapiChat = {
  phone?: string
  name?: string
  vname?: string
  short?: string
  lastMessageTime?: string | number
  isGroup?: boolean | string
  profileThumbnail?: string
}

type SyncTarget = {
  phone: string
  name?: string | null
  isGroup: boolean
  groupId?: string | null
  conversationId?: string | null
  profilePhotoUrl?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID')
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN')
    const ZAPI_SECURITY_TOKEN = Deno.env.get('ZAPI_SECURITY_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_SECURITY_TOKEN || !supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Credenciais de sincronização não configuradas' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return json({ error: 'Sessão inválida' }, 401)

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await req.json().catch(() => ({}))
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null
    const explicitPhone = typeof body?.phone === 'string' ? body.phone : null
    const maxChats = clampInt(body?.maxChats, 1, HARD_MAX_CHATS, DEFAULT_MAX_CHATS)
    const maxMessagesPerChat = clampInt(body?.maxMessagesPerChat, 1, HARD_MAX_MESSAGES_PER_CHAT, DEFAULT_MAX_MESSAGES_PER_CHAT)
    const messageBatchSize = clampInt(body?.amount ?? body?.messageBatchSize, 1, 50, DEFAULT_MESSAGE_BATCH_SIZE)

    const zapiHeaders = {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_SECURITY_TOKEN,
    }
    const baseUrl = `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`

    let targets: SyncTarget[] = []
    if (conversationId) {
      const { data: convo, error } = await supabase
        .from('wa_conversations')
        .select('id, phone, contact_name, is_group, group_id, group_subject, profile_photo_url')
        .eq('id', conversationId)
        .maybeSingle()
      if (error) throw error
      if (!convo?.phone) return json({ error: 'Conversa não encontrada' }, 404)
      targets = [{
        phone: String(convo.group_id || convo.phone),
        name: (convo.group_subject || convo.contact_name || null) as string | null,
        isGroup: !!convo.is_group,
        groupId: (convo.group_id || (convo.is_group ? convo.phone : null)) as string | null,
        conversationId: convo.id as string,
        profilePhotoUrl: (convo.profile_photo_url || null) as string | null,
      }]
    } else if (explicitPhone) {
      const clean = explicitPhone.trim()
      targets = [{ phone: clean, isGroup: isGroupPhone(clean), groupId: isGroupPhone(clean) ? clean : null }]
    } else {
      targets = await fetchAllTargets(baseUrl, zapiHeaders, maxChats)
    }

    const uniqueTargets = dedupeTargets(targets).slice(0, maxChats)
    let importedMessages = 0
    let skippedMessages = 0
    let syncedChats = 0
    const failures: Array<{ phone: string; error: string }> = []
    let multiDeviceHistoryUnavailable = false

    for (const target of uniqueTargets) {
      try {
        if (!target.phone || (isLidIdentifier(target.phone) && !target.isGroup)) continue
        const result = await syncTargetMessages({
          supabase,
          baseUrl,
          zapiHeaders,
          target,
          maxMessagesPerChat,
          messageBatchSize,
        })
        importedMessages += result.imported
        skippedMessages += result.skipped
        syncedChats += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (/multi device|does not work in multi device|histórico antigo por API/i.test(message)) {
          multiDeviceHistoryUnavailable = true
        }
        failures.push({
          phone: target.phone,
          error: message,
        })
      }
    }

    return json({
      success: true,
      syncedChats,
      importedMessages,
      skippedMessages,
      multiDeviceHistoryUnavailable,
      failures: failures.slice(0, 15),
      failureCount: failures.length,
      note: multiDeviceHistoryUnavailable
        ? MULTI_DEVICE_HISTORY_UNAVAILABLE
        : 'A Z-API só devolve histórico que ainda está disponível na instância.',
    })
  } catch (err) {
    console.error('[whatsapp-history-sync] error', err)
    return json({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500)
  }
})

async function fetchAllTargets(baseUrl: string, headers: Record<string, string>, maxChats: number): Promise<SyncTarget[]> {
  const targets: SyncTarget[] = []
  const pageSize = DEFAULT_CHAT_PAGE_SIZE

  // Prioriza grupos porque é neles que a Z-API costuma deixar lacunas maiores
  // quando o webhook não espelhou mensagens antigas.
  for (let page = 1; targets.length < maxChats; page++) {
    const groups = await zapiGetArray(`${baseUrl}/groups?page=${page}&pageSize=${pageSize}`, headers).catch(() => [])
    if (groups.length === 0) break
    for (const group of groups as ZapiChat[]) {
      const phone = normalizeChatPhone(group?.phone)
      if (!phone) continue
      targets.push({
        phone,
        name: group?.name ?? null,
        isGroup: true,
        groupId: phone,
        profilePhotoUrl: group?.profileThumbnail ?? null,
      })
      if (targets.length >= maxChats) break
    }
    if (groups.length < pageSize) break
  }

  // Em instâncias Multi Device o /chats pode retornar apenas LID; /contacts
  // traz o número real ativo e ajuda a evitar conversas duplicadas por @lid.
  for (let page = 1; targets.length < maxChats; page++) {
    const contacts = await zapiGetArray(`${baseUrl}/contacts?page=${page}&pageSize=${pageSize}`, headers).catch(() => [])
    if (contacts.length === 0) break
    for (const contact of contacts as ZapiChat[]) {
      const phone = normalizeChatPhone(contact?.phone)
      if (!phone || isLidIdentifier(phone)) continue
      targets.push({
        phone,
        name: contact?.name || contact?.vname || contact?.short || null,
        isGroup: false,
        groupId: null,
        profilePhotoUrl: contact?.profileThumbnail ?? null,
      })
      if (targets.length >= maxChats) break
    }
    if (contacts.length < pageSize) break
  }

  for (let page = 1; targets.length < maxChats; page++) {
    const chats = await zapiGetArray(`${baseUrl}/chats?page=${page}&pageSize=${pageSize}`, headers)
    if (chats.length === 0) break
    for (const chat of chats as ZapiChat[]) {
      const phone = normalizeChatPhone(chat?.phone)
      if (!phone) continue
      const group = boolish(chat?.isGroup) || isGroupPhone(phone)
      targets.push({
        phone,
        name: chat?.name ?? null,
        isGroup: group,
        groupId: group ? phone : null,
        profilePhotoUrl: chat?.profileThumbnail ?? null,
      })
      if (targets.length >= maxChats) break
    }
    if (chats.length < pageSize) break
  }

  return targets
}

async function syncTargetMessages(args: {
  supabase: any
  baseUrl: string
  zapiHeaders: Record<string, string>
  target: SyncTarget
  maxMessagesPerChat: number
  messageBatchSize: number
}) {
  const { supabase, baseUrl, zapiHeaders, target, maxMessagesPerChat, messageBatchSize } = args
  const conversationId = await ensureConversation(supabase, target)
  let imported = 0
  let skipped = 0
  let lastMessageId: string | null = null
  const seenIds = new Set<string>()

  while (imported + skipped < maxMessagesPerChat) {
    const amount = Math.min(messageBatchSize, maxMessagesPerChat - imported - skipped)
    const messages = await fetchChatMessages(baseUrl, zapiHeaders, target.phone, amount, lastMessageId)
    if (messages.length === 0) break

    const normalizedRaw = messages
      .map((msg) => normalizeMessage(msg, target))
      .filter((msg): msg is NormalizedMessage => !!msg && !!msg.zapiMessageId)
    const normalized = Array.from(
      new Map(normalizedRaw.map((msg) => [msg.zapiMessageId, msg])).values(),
    )

    if (normalized.length === 0) break

    const ids = normalized.map((msg) => msg.zapiMessageId)
    const newIds = ids.filter((id) => !seenIds.has(id))
    if (newIds.length === 0) break
    newIds.forEach((id) => seenIds.add(id))

    const existingIds = await getExistingMessageIds(supabase, newIds)
    const rows = normalized
      .filter((msg) => !existingIds.has(msg.zapiMessageId))
      .map((msg) => ({
        conversation_id: conversationId,
        direction: msg.fromMe ? 'out' : 'in',
        sender: msg.fromMe ? 'agent' : 'lead',
        message_type: msg.messageType,
        content: msg.content,
        media_url: msg.mediaUrl,
        media_mime: msg.mediaMime,
        media_caption: msg.mediaCaption,
        zapi_message_id: msg.zapiMessageId,
        status: msg.fromMe ? normalizeStatus(msg.status, 'sent') : normalizeStatus(msg.status, 'received'),
        sender_phone: target.isGroup ? msg.participantPhone : null,
        sender_name: target.isGroup ? (msg.fromMe ? 'Altivus Turismo' : (msg.senderName || null)) : (msg.fromMe ? 'Altivus Turismo' : null),
        raw: msg.raw,
        created_at: msg.createdAt,
      }))

    skipped += existingIds.size
    if (rows.length > 0) {
      const { error } = await supabase.from('wa_messages').insert(rows)
      if (error) throw error
      imported += rows.length
    }

    const last = normalized[normalized.length - 1]
    if (!last?.zapiMessageId || last.zapiMessageId === lastMessageId) break
    lastMessageId = last.zapiMessageId
    if (messages.length < amount) break
  }

  await refreshConversationPreview(supabase, conversationId, target)
  return { imported, skipped }
}

async function ensureConversation(supabase: any, target: SyncTarget): Promise<string> {
  if (target.conversationId) return target.conversationId

  if (target.isGroup) {
    const groupId = target.groupId || target.phone
    const { data: existing } = await supabase
      .from('wa_conversations')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle()
    if (existing?.id) return existing.id as string

    const { data, error } = await supabase
      .from('wa_conversations')
      .upsert({
        phone: groupId,
        is_group: true,
        group_id: groupId,
        group_subject: target.name || 'Grupo',
        contact_name: target.name || 'Grupo',
        ai_enabled: false,
        profile_photo_url: target.profilePhotoUrl || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }

  const { data, error } = await supabase
    .from('wa_conversations')
    .upsert({
      phone: target.phone,
      contact_name: target.name || null,
      profile_photo_url: target.profilePhotoUrl || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'phone' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

async function refreshConversationPreview(supabase: any, conversationId: string, target: SyncTarget) {
  const { data: latest } = await supabase
    .from('wa_messages')
    .select('message_type, content, media_caption, sender, created_at')
    .eq('conversation_id', conversationId)
    .eq('is_internal', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (target.name) {
    if (target.isGroup) payload.group_subject = target.name
    payload.contact_name = target.name
  }
  if (target.profilePhotoUrl) payload.profile_photo_url = target.profilePhotoUrl
  if (latest) {
    payload.last_message_text = previewFor(latest.message_type, latest.content, latest.media_caption)
    payload.last_message_at = latest.created_at
    payload.last_message_from = latest.sender === 'lead' ? 'lead' : 'agent'
  }

  await supabase.from('wa_conversations').update(payload).eq('id', conversationId)
}

type NormalizedMessage = {
  zapiMessageId: string
  fromMe: boolean
  status?: string | null
  messageType: string
  content: string | null
  mediaUrl: string | null
  mediaMime: string | null
  mediaCaption: string | null
  participantPhone: string | null
  senderName: string | null
  createdAt: string
  raw: any
}

function normalizeMessage(raw: any, target: SyncTarget): NormalizedMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const zapiMessageId = String(raw.messageId || raw.id || raw.MessageId || raw.ZaapId || raw._id || '').trim()
  if (!zapiMessageId) return null

  const text =
    raw.text?.message ||
    raw.text?.body ||
    raw.message?.conversation ||
    raw.message?.extendedTextMessage?.text ||
    raw.extendedTextMessage?.text ||
    raw.buttonsResponseMessage?.selectedDisplayText ||
    raw.buttonsResponseMessage?.message ||
    raw.listResponseMessage?.title ||
    raw.listResponseMessage?.message ||
    raw.templateButtonReplyMessage?.selectedDisplayText ||
    raw.reaction?.value ||
    raw.body ||
    raw.caption ||
    ''

  const hasContact = contactPayloads(raw).length > 0 || !!raw.contact?.vCard || !!raw.contact?.displayName || !!raw.contact?.phones?.length
  const isText = !!text
  const isImage = raw.image != null
  const isDocument = raw.document != null
  const isAudio = raw.audio != null
  const isVideo = raw.video != null
  const isSticker = raw.sticker != null
  const isLocation = raw.location != null
  const isReaction = !isText && !!raw.reaction
  const isCall = !!raw.callId || raw.type === 'CallReceivedCallback' || raw.type === 'CallCallback'
  const isNotification = !isText && (!!raw.notification || !!raw.notificationParameters)
  if (isNotification) return null

  let messageType = 'other'
  let content: string | null = null
  let mediaUrl: string | null = null
  let mediaMime: string | null = null
  let mediaCaption: string | null = null

  if (isText) { messageType = 'text'; content = String(text) }
  else if (isImage) { messageType = 'image'; mediaUrl = raw.image?.imageUrl || raw.image?.url || raw.image?.thumbnailUrl || null; mediaMime = raw.image?.mimeType || null; mediaCaption = raw.image?.caption || null }
  else if (isAudio) { messageType = 'audio'; mediaUrl = raw.audio?.audioUrl || raw.audio?.url || null; mediaMime = raw.audio?.mimeType || null }
  else if (isVideo) { messageType = 'video'; mediaUrl = raw.video?.videoUrl || raw.video?.url || null; mediaMime = raw.video?.mimeType || null; mediaCaption = raw.video?.caption || null }
  else if (isDocument) { messageType = 'document'; mediaUrl = raw.document?.documentUrl || raw.document?.url || null; mediaMime = raw.document?.mimeType || null; mediaCaption = raw.document?.caption || raw.document?.fileName || raw.document?.title || null }
  else if (isSticker) { messageType = 'sticker'; mediaUrl = raw.sticker?.stickerUrl || raw.sticker?.url || null }
  else if (isLocation) { messageType = 'location'; content = JSON.stringify(raw.location) }
  else if (hasContact) { messageType = 'contact'; content = formatSharedContactContent(raw) }
  else if (isCall) { messageType = 'call'; content = '📞 Chamada de voz/vídeo' }
  else if (isReaction) { messageType = 'reaction'; content = `${raw.reaction?.value || '❤️'} (reação)` }
  else content = 'Mensagem não suportada'

  const rawSenderName = raw.senderName || raw.pushName || raw.notifyName || (!target.isGroup ? raw.chatName : '')
  const senderName = isAgencyName(rawSenderName) ? '' : String(rawSenderName || '')

  return {
    zapiMessageId,
    fromMe: raw.fromMe === true || raw.fromMe === 'true',
    status: raw.status || raw.messageStatus || null,
    messageType,
    content,
    mediaUrl,
    mediaMime,
    mediaCaption,
    participantPhone: target.isGroup ? String(raw.participantPhone || raw.participant || raw.author || '') || null : null,
    senderName: senderName || null,
    createdAt: parseMessageDate(raw),
    raw,
  }
}

async function fetchChatMessages(baseUrl: string, headers: Record<string, string>, phone: string, amount: number, lastMessageId: string | null): Promise<any[]> {
  // Z-API espera o identificador do grupo apenas com dígitos (ex.: 120363...),
  // sem os sufixos internos "-group" ou "@g.us" que usamos no banco/UI.
  const cleaned = sanitizeChatIdForZapi(phone)
  const candidates = new Set<string>([cleaned])
  // Fallback: alguns endpoints aceitam o formato completo @g.us para grupos.
  if (isGroupPhone(phone)) candidates.add(`${cleaned}@g.us`)

  const errors: string[] = []
  for (const candidate of candidates) {
    const qs = new URLSearchParams({ amount: String(amount) })
    if (lastMessageId) qs.set('lastMessageId', lastMessageId)
    const url = `${baseUrl}/chat-messages/${encodeURIComponent(candidate)}?${qs.toString()}`
    const res = await fetch(url, { method: 'GET', headers })
    const text = await res.text().catch(() => '')
    if (res.ok) {
      const data = safeJson(text)
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.messages)) return data.messages
      return []
    }
    const lower = text.toLowerCase()
    // Em grupos a Z-API pode responder "does not work in multi device" para o
    // ID numérico, mas aceitar o mesmo grupo no formato @g.us. Não interrompemos
    // no primeiro erro; testamos todos os formatos antes de classificar como
    // limitação real de Multi Device.
    errors.push(`(${candidate}) ${res.status} ${text.slice(0, 200)}`)
  }
  if (errors.length > 0 && errors.every((entry) => /does not work in multi device/i.test(entry))) {
    throw new Error(MULTI_DEVICE_HISTORY_UNAVAILABLE)
  }
  throw new Error(`Z-API não retornou histórico para ${phone}: ${errors.join(' | ')}`)
}

function sanitizeChatIdForZapi(phone: string): string {
  const trimmed = String(phone || '').trim()
  // Remove sufixos internos e devolve só os dígitos, mantendo compatibilidade
  // tanto para grupos (120363...) quanto para contatos normais.
  const withoutSuffix = trimmed.replace(/-group$/i, '').replace(/@g\.us$/i, '').replace(/@c\.us$/i, '').replace(/@s\.whatsapp\.net$/i, '').replace(/@lid$/i, '')
  const digits = withoutSuffix.replace(/\D/g, '')
  return digits || withoutSuffix
}

async function zapiGetArray(url: string, headers: Record<string, string>): Promise<any[]> {
  const res = await fetch(url, { method: 'GET', headers })
  const text = await res.text().catch(() => '')
  if (!res.ok) throw new Error(`Z-API ${res.status}: ${text.slice(0, 300)}`)
  const data = safeJson(text)
  return Array.isArray(data) ? data : (Array.isArray(data?.chats) ? data.chats : [])
}

async function getExistingMessageIds(supabase: any, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const existing = new Set<string>()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { data, error } = await supabase
      .from('wa_messages')
      .select('zapi_message_id')
      .in('zapi_message_id', chunk)
    if (error) throw error
    for (const row of data ?? []) if (row.zapi_message_id) existing.add(row.zapi_message_id)
  }
  return existing
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
    return !!(value.vCard || value.vcard || value.vCardString || value.vcardString || value.contactVcard)
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
    for (const [key, child] of Object.entries(value)) {
      if (/^(contact|contacts|contactMessage|contactsArrayMessage|vCard|vcard|vCardString|vcardString|contactVcard|contactArray|contactsArray|sharedContact|sharedContacts|contactCard|contactCards)$/i.test(key)) push(child)
      visit(child, key)
    }
  }
  visit(body)
  return Array.from(new Map(payloads.filter(Boolean).map((p) => [typeof p === 'string' ? p : JSON.stringify(p), p])).values())
}

function formatSharedContactContent(body: any): string {
  const contacts = contactPayloads(body).map(normalizeContactPayload).filter(Boolean) as Array<{ name: string | null; phones: string[] }>
  if (contacts.length === 0) return 'Contato compartilhado'
  return contacts.map((c, idx) => {
    const title = c.name || (contacts.length > 1 ? `Contato ${idx + 1}` : 'Contato compartilhado')
    return [title, ...c.phones.map((p) => `+${p}`)].join('\n')
  }).join('\n\n')
}

function normalizeContactPayload(payload: any): { name: string | null; phones: string[] } | null {
  if (!payload) return null
  const vcard = typeof payload === 'string' ? payload : (payload.vCard || payload.vcard || payload.vCardString || payload.vcardString || payload.contactVcard || null)
  const phones = new Set<string>()
  const addPhone = (value: any) => {
    if (!value) return
    if (Array.isArray(value)) return value.forEach(addPhone)
    if (typeof value === 'object') return addPhone(value.phone || value.number || value.waid || value.id || value.value)
    const digits = String(value).replace(/\D/g, '')
    if (digits) phones.add(digits)
  }
  if (typeof payload === 'object') addPhone(payload.phones || payload.phoneNumbers || payload.phoneNumber || payload.phone || payload.number || payload.waid)
  if (vcard) {
    for (const match of String(vcard).matchAll(/waid=(\d+)/gi)) phones.add(match[1])
    for (const match of String(vcard).matchAll(/^TEL[^:\n]*:(.+)$/gim)) addPhone(match[1])
  }
  const name = typeof payload === 'object'
    ? (payload.displayName || payload.name || payload.fullName || payload.formattedName || payload.notifyName || payload.verifiedName || extractVcardName(String(vcard || '')) || null)
    : extractVcardName(String(vcard || ''))
  if (!name && phones.size === 0) return null
  return { name: name ? String(name).trim() : null, phones: Array.from(phones) }
}

function extractVcardName(vcard: string): string | null {
  return vcard.match(/^FN:(.+)$/im)?.[1]?.trim() || vcard.match(/^N:([^;\n]+)/im)?.[1]?.trim() || null
}

function parseMessageDate(raw: any): string {
  const value = raw.momment ?? raw.moment ?? raw.timestamp ?? raw.time ?? raw.created ?? raw.Created ?? raw.createdAt ?? raw.CreatedAt
  if (typeof value === 'string' && /^\d+$/.test(value)) return parseEpoch(Number(value))
  if (typeof value === 'number') return parseEpoch(value)
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

function parseEpoch(n: number): string {
  const ms = n > 9999999999 ? n : n * 1000
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

function previewFor(type: string, content: string | null, caption: string | null): string {
  if (type === 'text') return (content ?? '').slice(0, 200)
  if (type === 'image') return '📷 Imagem'
  if (type === 'audio') return '🎤 Áudio'
  if (type === 'video') return '🎥 Vídeo'
  if (type === 'document') return '📄 Documento'
  if (type === 'sticker') return '🌟 Figurinha'
  if (type === 'location') return '📍 Localização'
  if (type === 'contact') return `👤 ${((content ?? '').split('\n')[0] || 'Contato compartilhado').slice(0, 80)}`
  return (content ?? caption ?? 'Mensagem').slice(0, 200)
}

function normalizeStatus(status: string | null | undefined, fallback: string): string {
  const map: Record<string, string> = {
    SENT: 'sent',
    RECEIVED: 'received',
    DELIVERED: 'received',
    READ: 'read',
    PLAYED: 'played',
    FAILED: 'failed',
    ERROR: 'failed',
  }
  if (!status) return fallback
  return map[String(status).toUpperCase()] ?? String(status).toLowerCase()
}

function normalizeChatPhone(phone: unknown): string | null {
  const raw = String(phone || '').trim()
  return raw || null
}

function isGroupPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return /-group$/i.test(phone) || /@g\.us$/i.test(phone) || /^120363\d+/.test(digits)
}

function isLidIdentifier(value: string): boolean {
  if (/@lid$/i.test(value)) return true
  const digits = value.replace(/\D/g, '')
  return /^\d+$/.test(value) && digits.length >= 14 && !digits.startsWith('120363')
}

function isAgencyName(name: string | null | undefined): boolean {
  const n = (name || '').trim()
  return !!n && (/altivus/i.test(n) || /turismo$/i.test(n))
}

function boolish(value: unknown): boolean {
  return value === true || value === 'true' || value === '1' || value === 1
}

function dedupeTargets(targets: SyncTarget[]): SyncTarget[] {
  const map = new Map<string, SyncTarget>()
  for (const target of targets) {
    const key = target.isGroup ? `g:${target.groupId || target.phone}` : `p:${target.phone}`
    const previous = map.get(key)
    map.set(key, { ...previous, ...target, name: target.name || previous?.name || null })
  }
  return Array.from(map.values())
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function safeJson(text: string): any {
  try { return JSON.parse(text) } catch { return null }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
