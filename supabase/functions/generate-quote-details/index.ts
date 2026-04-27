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

    const systemPrompt = `Você é um redator da agência de viagens Altivus Turismo. Crie descrições MUITO CURTAS e objetivas para o campo "Detalhes" de orçamentos.

REGRAS OBRIGATÓRIAS:
- Máximo 280 caracteres (conte caracteres, não palavras)
- Máximo 4 linhas curtas
- Português brasileiro, tom profissional e direto
- Descreva objetivamente o destino e o tipo de experiência
- SEM linguagem poética, SEM adjetivos exagerados, SEM emojis
- SEM markdown, texto puro
- NÃO invente datas, preços ou itinerários
- Não use parágrafos longos`;

    const userPrompt = `Gere uma descrição curta (máx. 280 caracteres, 4 linhas) para:
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
    // Hard caps: max 4 lines, max 280 chars
    text = String(text).trim().split("\n").slice(0, 4).join("\n");
    if (text.length > 280) text = text.slice(0, 277).trimEnd() + "...";

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
