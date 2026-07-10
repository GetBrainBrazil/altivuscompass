import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the caller's JWT — reject anon keys / unverified tokens
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { itinerary_id, mode, chat_message, custom_prompt } = await req.json();
    if (!itinerary_id) {
      return new Response(JSON.stringify({ error: "itinerary_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: itinerary, error: itErr } = await supabase.from("itineraries").select("*").eq("id", itinerary_id).single();
    if (itErr) throw itErr;

    const { data: existingDays } = await supabase.from("itinerary_days").select("*, itinerary_day_activities(*)").eq("itinerary_id", itinerary_id).order("sort_order");
    const { data: hotels } = await supabase.from("itinerary_hotels").select("*").eq("itinerary_id", itinerary_id);
    const { data: restaurants } = await supabase.from("itinerary_restaurants").select("*").eq("itinerary_id", itinerary_id);
    const { data: activities } = await supabase.from("itinerary_activities").select("*").eq("itinerary_id", itinerary_id);

    await supabase.from("itineraries").update({ ai_status: "generating" }).eq("id", itinerary_id);

    const systemPrompt = `${custom_prompt || "Você é um especialista em planejamento de viagens."}

RESPONDA SEMPRE em JSON válido com a seguinte estrutura:
{
  "days": [
    {
      "day_date": "YYYY-MM-DD",
      "city": "Nome da cidade",
      "activities": [
        {
          "activity_name": "Nome do local/atividade",
          "description": "Breve descrição",
          "activity_type": "attraction|restaurant|hotel|transport_hub|shopping|entertainment|nature|cultural",
          "start_time": "HH:MM",
          "end_time": "HH:MM",
          "latitude": -23.5505,
          "longitude": -46.6333,
          "address": "Endereço completo",
          "transport_mode": "uber|taxi|transfer|trem|metro|barco|aviao|a_pe|onibus",
          "transport_departure_time": "HH:MM",
          "transport_arrival_time": "HH:MM",
          "transport_duration_min": 15,
          "transport_cost_estimate": 25.00,
          "transport_currency": "EUR",
          "transport_notes": "Detalhes sobre o deslocamento",
          "notes": "Dicas ou observações"
        }
      ]
    }
  ],
  "summary": "Resumo geral do roteiro",
  "tips": ["Dica 1", "Dica 2"]
}

REGRAS OBRIGATÓRIAS DE TRANSPORTE:
- O campo transport_mode de cada atividade indica como o viajante CHEGOU a esse local vindo do local anterior.
- Quando o deslocamento é entre dois AEROPORTOS ou entre cidades distantes (>200km), o transport_mode DEVE ser "aviao".
- Quando o destino ou origem é um aeroporto e o outro ponto fica na mesma cidade/região, use "uber", "taxi" ou "transfer".
- Para deslocamentos curtos (<3km) em áreas urbanas com calçadas, prefira "a_pe".
- NUNCA coloque "uber" ou "taxi" entre dois aeroportos de cidades diferentes.

REGRAS DE ALUGUEL DE CARRO:
- Analise CUIDADOSAMENTE o descritivo da viagem, observações, atividades cadastradas e roteiro existente em busca de menções a aluguel/locação de carro (palavras como "aluguel", "locação", "locadora", "carro alugado", "rent a car", "Localiza", "Movida", "Hertz", "Avis", "Unidas", reservas de locadora, retirada/devolução de veículo).
- Se houver período com carro alugado (entre a retirada e a devolução), use SEMPRE transport_mode "carro" (ou similar) para todos os deslocamentos dentro desse período. NÃO sugira "uber", "taxi" nem "transfer" enquanto o cliente estiver com o carro alugado, exceto se houver justificativa clara (ex: ida a um restaurante onde haverá consumo de álcool, área de pedágio/zona restrita sem estacionamento, balsa apenas para pedestres). Quando usar outro modal nesse período, EXPLIQUE o motivo no transport_notes.
- Para cada destino visitado de carro durante o período de aluguel, recomende um ESTACIONAMENTO próximo (nome, endereço aproximado e custo médio se possível) no campo transport_notes ou notes da atividade.
- Considere o tempo necessário para retirar o carro na locadora (use uma atividade/parada específica de retirada) e para devolvê-lo antes do voo de saída (com folga adequada).
- Fora do período de aluguel, siga as regras normais de transporte.`;

    let userPrompt = "";

    // Fetch airport labels for both modes
    let arrivalAirportLabel = "Não especificado";
    let departureAirportLabel = "Não especificado";
    if (itinerary.arrival_airport_id) {
      const { data: ap } = await supabase.from("airports").select("iata_code, name, city").eq("id", itinerary.arrival_airport_id).single();
      if (ap) arrivalAirportLabel = `${ap.iata_code} — ${ap.name}, ${ap.city}`;
    }
    if (itinerary.departure_airport_id) {
      const { data: ap } = await supabase.from("airports").select("iata_code, name, city").eq("id", itinerary.departure_airport_id).single();
      if (ap) departureAirportLabel = `${ap.iata_code} — ${ap.name}, ${ap.city}`;
    }

    const arrivalDate = itinerary.arrival_datetime ? new Date(itinerary.arrival_datetime) : null;
    const departureDate = itinerary.departure_datetime ? new Date(itinerary.departure_datetime) : null;

    if (mode === "chat" && chat_message) {
      userPrompt = `DADOS DO FORMULÁRIO (SEMPRE RESPEITAR — SÃO A BASE DO ROTEIRO):
CHEGADA: ${arrivalDate ? arrivalDate.toISOString() : "Não especificado"}
AEROPORTO CHEGADA: ${arrivalAirportLabel}
SAÍDA: ${departureDate ? departureDate.toISOString() : "Não especificado"}
AEROPORTO SAÍDA: ${departureAirportLabel}
HORÁRIO ACORDAR: ${itinerary.wake_time || "08:00"}
HORÁRIO DORMIR: ${itinerary.sleep_time || "22:00"}
DESTINO: ${itinerary.destination || "Não especificado"}
DESCRITIVO DA VIAGEM: ${itinerary.notes || "Nenhum descritivo fornecido"}

ROTEIRO ATUAL (MANTENHA TODOS OS DIAS E ATIVIDADES QUE NÃO FOREM AFETADOS PELO PEDIDO):
${JSON.stringify(existingDays, null, 2)}

HOTÉIS CADASTRADOS: ${JSON.stringify(hotels)}
RESTAURANTES CADASTRADOS: ${JSON.stringify(restaurants)}
PASSEIOS CADASTRADOS: ${JSON.stringify(activities)}

PEDIDO DO USUÁRIO: ${chat_message}

REGRAS PARA AJUSTE:
1. NÃO refaça o roteiro inteiro. Altere SOMENTE o que foi pedido pelo usuário.
2. Mantenha todos os dias, horários, atividades e deslocamentos que não foram mencionados no pedido.
3. Se o ajuste exigir mudanças em outros pontos por logística (ex: horários de deslocamento), ajuste apenas o mínimo necessário.
4. Retorne o roteiro COMPLETO no JSON (todos os dias, incluindo os não alterados), pois ele será salvo por inteiro.
5. Respeite TODAS as regras do prompt de sistema (horários, transporte, coordenadas, etc).
6. O aeroporto de chegada e saída são os definidos nos DADOS DO FORMULÁRIO acima. NÃO invente outros aeroportos.`;
    } else {

      userPrompt = `CRIE UM ROTEIRO COMPLETO:

CHEGADA: ${arrivalDate ? arrivalDate.toISOString() : "Não especificado"}
AEROPORTO CHEGADA: ${arrivalAirportLabel}
SAÍDA: ${departureDate ? departureDate.toISOString() : "Não especificado"}
AEROPORTO SAÍDA: ${departureAirportLabel}

HORÁRIO ACORDAR: ${itinerary.wake_time || "08:00"}
HORÁRIO DORMIR: ${itinerary.sleep_time || "22:00"}

DESCRITIVO DA VIAGEM (cidades, pontos de interesse, hotéis, preferências):
${itinerary.notes || "Nenhum descritivo fornecido"}

HOTÉIS CADASTRADOS: ${JSON.stringify(hotels)}
RESTAURANTES CADASTRADOS: ${JSON.stringify(restaurants)}
PASSEIOS CADASTRADOS: ${JSON.stringify(activities)}

Gere o roteiro completo com todos os dias. Cada dia deve iniciar no hotel e terminar nele, com todos os deslocamentos detalhados (modal, horário saída, horário chegada, custo estimado).`;
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 16384,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`AI API error: ${err}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let parsed;
    try {
      // Extract JSON from markdown fences if present
      const jsonMatch = content.match(/(?:```|''')(?:json)?\s*([\s\S]*?)(?:```|''')/);
      let jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

      // Find JSON boundaries
      const jsonStart = jsonStr.search(/[\{\[]/);
      const jsonEnd = Math.max(jsonStr.lastIndexOf('}'), jsonStr.lastIndexOf(']'));
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      // Clean trailing commas
      jsonStr = jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      // Remove control characters that break JSON
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\r' || c === '\t' ? c : '');

      try {
        parsed = JSON.parse(jsonStr);
      } catch (_firstErr) {
        // Truncation repair: find the last complete activity/day object
        console.warn("First parse failed, attempting truncation repair...");
        
        // Remove the last potentially broken object/value after the last complete entry
        // Strategy: find the last valid closing of an activity array item
        let repaired = jsonStr;
        
        // Try to find the last complete "}" that closes an activity
        // and truncate everything after it, then close all open structures
        const lastCompleteActivity = repaired.lastIndexOf('"notes"');
        const lastCompleteBlock = repaired.lastIndexOf('}', lastCompleteActivity > -1 ? undefined : undefined);
        
        // More robust: iteratively remove trailing broken content
        // Find where JSON breaks by trying to parse progressively shorter strings
        let fixed = false;
        
        // First attempt: close all open brackets/braces
        const openBraces = (repaired.match(/{/g) || []).length;
        const closeBraces = (repaired.match(/}/g) || []).length;
        const openBrackets = (repaired.match(/\[/g) || []).length;
        const closeBrackets = (repaired.match(/\]/g) || []).length;

        if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
          // Find the last complete JSON value (string, number, bool, null, }, or ])
          // by removing broken trailing content
          repaired = repaired.replace(/,?\s*"[^"]*$/, ''); // remove incomplete key
          repaired = repaired.replace(/,?\s*"[^"]*"\s*:\s*("[^"]*)?$/, ''); // remove incomplete key:value
          repaired = repaired.replace(/,?\s*"[^"]*"\s*:\s*$/, ''); // remove key with no value
          repaired = repaired.replace(/,?\s*$/, ''); // remove trailing comma
          
          // Re-count and close
          const ob = (repaired.match(/{/g) || []).length;
          const cb = (repaired.match(/}/g) || []).length;
          const oB = (repaired.match(/\[/g) || []).length;
          const cB = (repaired.match(/\]/g) || []).length;
          
          for (let k = 0; k < (oB - cB); k++) repaired += "]";
          for (let k = 0; k < (ob - cb); k++) repaired += "}";
          repaired = repaired.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
        }

        try {
          parsed = JSON.parse(repaired);
          fixed = true;
          console.log("Truncation repair succeeded");
        } catch (_secondErr) {
          // Last resort: progressively trim from the end until parseable
          let trimmed = repaired;
          for (let attempt = 0; attempt < 50 && !fixed; attempt++) {
            // Remove last property or value
            const lastComma = trimmed.lastIndexOf(',');
            const lastBrace = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
            const cutPoint = Math.max(lastComma, lastBrace);
            if (cutPoint <= 0) break;
            
            trimmed = trimmed.substring(0, cutPoint);
            trimmed = trimmed.replace(/,\s*$/, '');
            
            // Close open structures
            let candidate = trimmed;
            const cob = (candidate.match(/{/g) || []).length - (candidate.match(/}/g) || []).length;
            const coB = (candidate.match(/\[/g) || []).length - (candidate.match(/\]/g) || []).length;
            for (let k = 0; k < coB; k++) candidate += "]";
            for (let k = 0; k < cob; k++) candidate += "}";
            
            try {
              parsed = JSON.parse(candidate);
              fixed = true;
              console.log(`Progressive trim succeeded after ${attempt + 1} attempts`);
            } catch { /* continue */ }
          }
        }

        if (!fixed) {
          throw _firstErr;
        }
      }
    } catch (parseErr: any) {
      console.error("JSON parse error:", parseErr.message, "Raw length:", content.length);
      await supabase.from("itineraries").update({ ai_status: "error" }).eq("id", itinerary_id);
      return new Response(JSON.stringify({ error: "Falha ao processar resposta da IA. Tente novamente.", details: parseErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Save to database
    // Always clear existing days before saving (chat mode returns full updated itinerary)
    if (existingDays && existingDays.length > 0) {
      const dayIds = existingDays.map((d: any) => d.id);
      await supabase.from("itinerary_day_activities").delete().in("itinerary_day_id", dayIds);
      await supabase.from("itinerary_days").delete().eq("itinerary_id", itinerary_id);
    }

    // Resolve real coordinates/address via Google Places (avoids AI hallucinated lat/lng)
    const mapsKey = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
    const placeCache = new Map<string, { lat: number; lng: number; address: string } | null>();
    async function resolvePlace(name: string, address: string | null, city: string | null) {
      if (!mapsKey) return null;
      const query = [name, address, city].filter(Boolean).join(", ");
      if (!query) return null;
      if (placeCache.has(query)) return placeCache.get(query)!;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=formatted_address,geometry,name&key=${mapsKey}`;
        const res = await fetch(url);
        const json = await res.json();
        const c = json?.candidates?.[0];
        if (c?.geometry?.location) {
          const out = { lat: c.geometry.location.lat, lng: c.geometry.location.lng, address: c.formatted_address || address || "" };
          placeCache.set(query, out);
          return out;
        }
      } catch (e) { console.warn("place lookup failed", query, e); }
      placeCache.set(query, null);
      return null;
    }

    for (let i = 0; i < (parsed.days || []).length; i++) {
      const day = parsed.days[i];
      const { data: newDay, error: dayErr } = await supabase.from("itinerary_days").insert({
        itinerary_id,
        day_date: day.day_date || null,
        city: day.city || null,
        sort_order: i,
      }).select().single();

      if (dayErr) { console.error("Error inserting day:", dayErr); continue; }

      for (let j = 0; j < (day.activities || []).length; j++) {
        const act = day.activities[j];
        const resolved = await resolvePlace(act.activity_name, act.address, day.city);
        await supabase.from("itinerary_day_activities").insert({
          itinerary_day_id: newDay.id,
          sort_order: j,
          activity_name: act.activity_name || "Atividade",
          description: act.description || null,
          activity_type: act.activity_type || "attraction",
          start_time: act.start_time || null,
          end_time: act.end_time || null,
          latitude: resolved?.lat ?? act.latitude ?? null,
          longitude: resolved?.lng ?? act.longitude ?? null,
          address: resolved?.address || act.address || null,
          transport_mode: act.transport_mode || null,
          transport_departure_time: act.transport_departure_time || null,
          transport_arrival_time: act.transport_arrival_time || null,
          transport_duration_min: act.transport_duration_min || null,
          transport_cost_estimate: act.transport_cost_estimate || null,
          transport_currency: act.transport_currency || "EUR",
          transport_notes: act.transport_notes || null,
          is_ai_suggested: true,
          notes: act.notes || null,
        });
      }
    }

    // Combine summary + tips into one observations field
    let fullSummary = parsed.summary || "";
    if (parsed.tips && parsed.tips.length > 0) {
      fullSummary += "\n\n🔸 Dicas:\n" + parsed.tips.map((t: string) => `• ${t}`).join("\n");
    }

    await supabase.from("itineraries").update({ ai_status: "completed", summary: fullSummary || null }).eq("id", itinerary_id);

    return new Response(JSON.stringify({
      success: true,
      summary: fullSummary,
      tips: parsed.tips,
      days_count: parsed.days?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
