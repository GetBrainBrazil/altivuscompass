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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Auth is optional (public quote page can send without auth)
    const authHeader = req.headers.get('Authorization')
    let user: any = null
    if (authHeader) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user: authUser } } = await supabase.auth.getUser()
      user = authUser
    }

    const body = await req.json()
    const { action, phone, message, quote_id, image_url, document_url, document_name } = body

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Telefone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
            message,
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
            caption: message || '',
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
            caption: message || '',
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
            message,
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
      const serviceSupabase = createClient(supabaseUrl, supabaseKey)
      if (user) {
        const { data: profile } = await serviceSupabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .single()

        await serviceSupabase.from('quote_history').insert({
          quote_id,
          user_id: user.id,
          user_name: profile?.full_name || user.email,
          action: 'whatsapp_sent',
          description: `Mensagem WhatsApp enviada para ${phone}`,
        })
      } else {
        await serviceSupabase.from('quote_history').insert({
          quote_id,
          action: 'whatsapp_sent',
          description: `Mensagem WhatsApp enviada para ${phone} (página pública)`,
        })
      }
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
