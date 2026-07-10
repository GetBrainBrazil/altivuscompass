import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { destination, quoteId } = await req.json();
    if (!destination) throw new Error("Destination is required");

    const prompt = `A stunning, professional travel photography of ${destination}. Beautiful landscape, cinematic lighting, vivid colors, high resolution, travel magazine cover quality. No text, no watermarks, no people close-up.`;

    // Generate image via OpenAI Images API (gpt-image-1)
    const aiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1536x1024",
        quality: "medium",
        n: 1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI image error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 401) {
        return new Response(JSON.stringify({ error: "Chave OpenAI inválida ou não configurada." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar imagem", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const b64 = aiData?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("Sem imagem na resposta:", JSON.stringify(aiData).substring(0, 500));
      throw new Error("Nenhuma imagem foi gerada");
    }
    const imageBase64 = `data:image/png;base64,${b64}`;

    // If quoteId provided, upload to storage
    if (quoteId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const binaryData = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const path = `${quoteId}/cover-ai.png`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("quote-images")
        .upload(path, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Falha ao salvar imagem");
      }

      const { data: urlData } = supabaseAdmin.storage.from("quote-images").getPublicUrl(path);

      return new Response(
        JSON.stringify({ imageUrl: urlData.publicUrl, base64: imageBase64 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ base64: imageBase64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-cover-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
