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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { destination, quoteId } = await req.json();
    if (!destination) throw new Error("Destination is required");

    const prompt = `A stunning, professional travel photography of ${destination}. Beautiful landscape, cinematic lighting, vivid colors, high resolution, travel magazine cover quality. No text, no watermarks, no people close-up.`;

    // Generate image using Lovable AI with Gemini image model
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("Falha ao gerar imagem");
    }

    const aiData = await aiResponse.json();
    console.log("AI response structure:", JSON.stringify(Object.keys(aiData)));
    console.log("First choice keys:", JSON.stringify(aiData.choices?.[0]?.message ? Object.keys(aiData.choices[0].message) : "no message"));
    
    // Try multiple response formats
    let imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // Alternative: check content parts for inline_data
    if (!imageBase64 && aiData.choices?.[0]?.message?.content) {
      const content = aiData.choices[0].message.content;
      if (Array.isArray(content)) {
        const imagePart = content.find((p: any) => p.type === "image_url" || p.inline_data || p.image_url);
        if (imagePart?.image_url?.url) imageBase64 = imagePart.image_url.url;
        else if (imagePart?.inline_data?.data) imageBase64 = `data:${imagePart.inline_data.mime_type || "image/png"};base64,${imagePart.inline_data.data}`;
      }
    }
    
    console.log("Image found:", !!imageBase64, imageBase64 ? imageBase64.substring(0, 50) : "none");

    if (!imageBase64) {
      console.error("Full AI response:", JSON.stringify(aiData).substring(0, 2000));
      throw new Error("Nenhuma imagem foi gerada");
    }

    // If quoteId provided, upload to storage
    if (quoteId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      // Convert base64 to binary
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

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

    // Return base64 if no quoteId
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
