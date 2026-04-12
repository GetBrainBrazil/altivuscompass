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
    const { itinerary_id, messages } = await req.json();
    if (!itinerary_id) {
      return new Response(JSON.stringify({ error: "itinerary_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load full itinerary context
    const { data: itinerary } = await supabase.from("itineraries").select("*").eq("id", itinerary_id).single();
    const { data: days } = await supabase.from("itinerary_days").select("*, itinerary_day_activities(*)").eq("itinerary_id", itinerary_id).order("sort_order");
    const { data: hotels } = await supabase.from("itinerary_hotels").select("*").eq("itinerary_id", itinerary_id);
    const { data: restaurants } = await supabase.from("itinerary_restaurants").select("*").eq("itinerary_id", itinerary_id);
    const { data: activities } = await supabase.from("itinerary_activities").select("*").eq("itinerary_id", itinerary_id);

    // Build context
    const context = JSON.stringify({
      itinerary,
      days: days || [],
      hotels: hotels || [],
      restaurants: restaurants || [],
      activities: activities || [],
    }, null, 2);

    const systemPrompt = `Você é um assistente especialista em viagens da agência Altivus Turismo.
Seu papel é APENAS responder dúvidas sobre o roteiro abaixo. Você NÃO deve sugerir alterações no roteiro nem gerar novos dias/atividades.
Responda de forma clara, objetiva e amigável em português.

Exemplos de perguntas que você pode responder:
- Qual o horário de check-in no hotel X?
- Quanto tempo leva do aeroporto ao hotel?
- Quais restaurantes estão no roteiro?
- O que está programado para o dia 3?
- Preciso de visto para esse destino?
- Qual a melhor época para visitar esse lugar?
- Dicas sobre o que levar na mala?

CONTEXTO COMPLETO DO ROTEIRO:
${context}`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-itinerary error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
