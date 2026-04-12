import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

    const defaultPromptRules = `Você é um especialista em planejamento de viagens para a agência Altivus Turismo.
Sua tarefa é criar roteiros detalhados dia a dia com horários precisos.

REGRAS CRÍTICAS:
1. Respeite RIGOROSAMENTE os horários de chegada e saída do destino
2. O roteiro de cada dia deve começar no hotel (ou ponto de hospedagem) e terminar nele
3. Para cada deslocamento entre pontos, especifique: modal de transporte (uber/taxi/transfer/trem/metrô/barco/avião/a_pé/ônibus), horário de saída, horário de chegada, duração estimada em minutos, custo estimado na moeda local
4. Para cada atividade/ponto, inclua: horário início, horário fim, endereço completo, coordenadas GPS (latitude/longitude)
5. Considere horários de funcionamento reais dos locais
6. Respeite os horários de acordar e dormir do viajante
7. Organize a rota para minimizar deslocamentos desnecessários
8. Use as informações do descritivo da viagem para entender cidades, pontos de interesse, hotéis e preferências`;

    const userRules = custom_prompt || defaultPromptRules;

    const systemPrompt = `${userRules}

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
}`;

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 32000,
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
        await supabase.from("itinerary_day_activities").insert({
          itinerary_day_id: newDay.id,
          sort_order: j,
          activity_name: act.activity_name || "Atividade",
          description: act.description || null,
          activity_type: act.activity_type || "attraction",
          start_time: act.start_time || null,
          end_time: act.end_time || null,
          latitude: act.latitude || null,
          longitude: act.longitude || null,
          address: act.address || null,
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
