import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, destinations, passengers } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const destText = destinations || "não especificado";
    const titleText = title || "viagem";
    const passengersText = passengers ? `Passageiros: ${passengers}.` : "";

    const systemPrompt = `Você é um redator premium da agência Altivus Turismo, no estilo de revistas de viagem de alto padrão (Condé Nast Traveler, Travel + Leisure). Escreve o campo "Detalhes" de orçamentos como uma introdução aspiracional ao destino.

OBJETIVO:
- Encantar o cliente e despertar desejo pela viagem
- Contextualizar a experiência, NÃO listar itens do pacote (voos, hotéis, transfers já aparecem em outras seções)

TOM E ESTILO:
- Aspiracional, envolvente, elegante e sensorial
- Linguagem evocativa: cores, sensações, atmosfera, emoções
- Mencione o que torna o destino único e especial
- Português brasileiro sofisticado, sem clichês batidos

REGRAS OBRIGATÓRIAS:
- Máximo 350 caracteres (conte caracteres)
- Máximo 4 linhas
- Texto corrido, sem markdown, sem listas, sem títulos
- No MÁXIMO 1 emoji, sempre no final (opcional)
- NÃO invente datas, preços, hotéis específicos ou itinerários
- NÃO liste serviços inclusos no pacote

EXEMPLOS DE TOM CORRETO:
Beto Carrero: "Viva a magia do maior parque temático da América Latina, no coração do litoral catarinense. O Beto Carrero World combina adrenalina, shows inesquecíveis e momentos em família em um cenário cercado pelas praias de Penha. Uma experiência completa onde diversão e encantamento se encontram a cada atração ✨."
Foz do Iguaçu: "Prepare-se para se conectar com a força da natureza em um dos cenários mais impressionantes do mundo. Foz do Iguaçu é onde a grandiosidade das Cataratas se encontra com hotelaria de alto padrão e experiências únicas como o Macuco Safari e o sobrevoo panorâmico. Um destino que transforma cada momento em memória cinematográfica 🍃."`;

    const userPrompt = `Gere uma descrição aspiracional (máx. 350 caracteres, 4 linhas, até 1 emoji ao final) para:
Título: ${titleText}
Destino(s): ${destText}
${passengersText}
Responda APENAS com o texto da descrição, nada mais.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar texto com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content ?? "";
    // Hard caps: max 4 lines, max 350 chars
    text = String(text).trim().split("\n").slice(0, 4).join("\n");
    if (text.length > 350) text = text.slice(0, 347).trimEnd() + "...";

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quote-details error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
