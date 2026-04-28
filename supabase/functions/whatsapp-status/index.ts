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

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_SECURITY_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Credenciais Z-API não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action ?? 'status'

    const zapiHeaders = {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_SECURITY_TOKEN,
    }
    const baseUrl = `${ZAPI_BASE_URL}/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`

    if (action === 'qr-code') {
      // Returns base64 QR image
      const r = await fetch(`${baseUrl}/qr-code/image`, { headers: zapiHeaders })
      const data = await r.json().catch(() => ({}))
      return new Response(JSON.stringify(data), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'disconnect') {
      const r = await fetch(`${baseUrl}/disconnect`, { headers: zapiHeaders })
      const data = await r.json().catch(() => ({}))
      return new Response(JSON.stringify(data), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'restart') {
      const r = await fetch(`${baseUrl}/restart`, { headers: zapiHeaders })
      const data = await r.json().catch(() => ({}))
      return new Response(JSON.stringify(data), {
        status: r.ok ? 200 : r.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: get status + device info in parallel
    const [statusRes, deviceRes] = await Promise.all([
      fetch(`${baseUrl}/status`, { headers: zapiHeaders }),
      fetch(`${baseUrl}/device`, { headers: zapiHeaders }),
    ])

    const status = await statusRes.json().catch(() => ({}))
    const device = await deviceRes.json().catch(() => ({}))

    return new Response(
      JSON.stringify({
        connected: status?.connected === true,
        smartphoneConnected: status?.smartphoneConnected === true,
        session: status?.session === true,
        statusRaw: status,
        device: {
          phone: device?.phone ?? null,
          formattedPhone: device?.phone
            ? formatPhone(String(device.phone))
            : null,
          name: device?.name ?? null,
          imgUrl: device?.imgUrl ?? null,
          battery: device?.battery ?? null,
          platform: device?.platform ?? null,
          deviceManufacturer: device?.deviceManufacturer ?? null,
          deviceModel: device?.deviceModel ?? null,
        },
        instanceId: ZAPI_INSTANCE_ID,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[whatsapp-status] error', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

function formatPhone(p: string) {
  // Brazilian: 55 21 97675 6008  → +55 (21) 97675-6008
  const digits = p.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) {
    const cc = digits.slice(0, 2)
    const ddd = digits.slice(2, 4)
    const part1 = digits.slice(4, digits.length - 4)
    const part2 = digits.slice(-4)
    return `+${cc} (${ddd}) ${part1}-${part2}`
  }
  return `+${digits}`
}
