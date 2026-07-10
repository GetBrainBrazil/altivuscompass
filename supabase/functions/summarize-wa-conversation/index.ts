// Edge function: summarize-wa-conversation
// Generates an AI summary for a wa_conversation when it is closed (resolved/abandoned).
// Idempotent: only runs when summary is empty.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const conversation_id: string | undefined = body?.conversation_id;
    const force: boolean = !!body?.force;
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: convo, error: convErr } = await supabase
      .from("wa_conversations")
      .select("id, status, summary, contact_name, phone")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convErr || !convo) {
      return new Response(JSON.stringify({ error: "conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!force && convo.summary && String(convo.summary).trim().length > 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "summary already exists" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgs } = await supabase
      .from("wa_messages")
      .select("direction, body, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(80);

    if (!msgs || msgs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no messages" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = msgs
      .map((m: any) => `${m.direction === "in" ? "Cliente" : "Atendente"}: ${(m.body || "").slice(0, 500)}`)
      .join("\n");

    const prompt = `Resuma a conversa de WhatsApp abaixo entre um(a) consultor(a)/IA da Altivus Turismo e o cliente "${convo.contact_name || convo.phone}".
Produza um resumo OBJETIVO em 1 a 3 frases (máx 350 caracteres) capturando:
- Intenção principal do cliente (cotação, suporte, dúvida etc.)
- Destino/período/viajantes se mencionados
- Status final (resolvido, abandonado, escalado)
- Próximos passos pendentes, se houver

Responda APENAS com o resumo em texto puro, sem prefixos.

CONVERSA:
${transcript}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você gera resumos curtos e factuais de conversas de atendimento." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "ai gateway", status: aiRes.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const summary: string = (data?.choices?.[0]?.message?.content ?? "").trim().slice(0, 600);

    if (!summary) {
      return new Response(JSON.stringify({ skipped: true, reason: "empty summary" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("wa_conversations")
      .update({ summary })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-wa-conversation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
