import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Estratégia:
// 1) Consulta o cache (tabela hotel_photo_cache) por query_key.
// 2) Tenta Google Places (New) e depois legado.
// 3) Se tudo falhar, gera uma imagem ilustrativa via Lovable AI (Gemini Image)
//    e persiste no cache para as próximas aberturas.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query")?.trim();
    const fallback = url.searchParams.get("fallback")?.trim();
    const maxWidth = Number(url.searchParams.get("maxWidth") ?? "600");

    if (!query) return json({ error: "missing query" }, 400);

    const cacheKey = normalizeKey(fallback || query);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Cache
    const { data: cached } = await supabase
      .from("hotel_photo_cache")
      .select("photo_url, source")
      .eq("query_key", cacheKey)
      .maybeSingle();
    if (cached?.photo_url) {
      return json({ photoUri: cached.photo_url, source: cached.source, cached: true });
    }

    // 2) Google Places
    const googleKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    const queries = Array.from(new Set([query, fallback].filter(Boolean))) as string[];
    let photoUri: string | null = null;
    let source = "google";

    if (googleKey) {
      for (const q of queries) {
        photoUri = await tryPlacesNew(q, googleKey, maxWidth);
        if (photoUri) break;
      }
      if (!photoUri) {
        for (const q of queries) {
          photoUri = await tryLegacyPlaces(q, googleKey, maxWidth);
          if (photoUri) break;
        }
      }
    }

    // 3) Fallback: gerar com Lovable AI
    if (!photoUri) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (lovableKey) {
        try {
          photoUri = await generateWithLovableAI(fallback || query, lovableKey);
          source = "ai";
        } catch (err) {
          console.error("lovable ai generation failed", err);
        }
      }
    }

    if (photoUri) {
      // Persistir no cache (best-effort)
      await supabase
        .from("hotel_photo_cache")
        .upsert({ query_key: cacheKey, photo_url: photoUri, source }, { onConflict: "query_key" });
      return json({ photoUri, source, cached: false });
    }

    return json({ photoUri: null, fallback: true, error: "PHOTO_NOT_FOUND" });
  } catch (err) {
    console.error("get-hotel-photo error", err);
    return json({ photoUri: null, fallback: true, error: "HOTEL_PHOTO_ERROR" });
  }
});

async function tryPlacesNew(q: string, key: string, maxWidth: number): Promise<string | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
      },
      body: JSON.stringify({ textQuery: q, maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photoName: string | undefined = data?.places?.[0]?.photos?.[0]?.name;
    if (!photoName) return null;
    const mediaRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${key}`,
    );
    if (!mediaRes.ok) return null;
    const media = await mediaRes.json();
    return (media?.photoUri as string) ?? null;
  } catch {
    return null;
  }
}

async function tryLegacyPlaces(q: string, key: string, maxWidth: number): Promise<string | null> {
  try {
    const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    searchUrl.searchParams.set("query", q);
    searchUrl.searchParams.set("type", "lodging");
    searchUrl.searchParams.set("key", key);
    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const photoReference: string | undefined = searchData?.results?.[0]?.photos?.[0]?.photo_reference;
    if (!photoReference) return null;
    const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
    photoUrl.searchParams.set("maxwidth", String(maxWidth));
    photoUrl.searchParams.set("photo_reference", photoReference);
    photoUrl.searchParams.set("key", key);
    const photoRes = await fetch(photoUrl.toString(), { redirect: "follow" });
    if (!photoRes.ok) return null;
    const contentType = photoRes.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = await photoRes.arrayBuffer();
    return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
  } catch {
    return null;
  }
}

async function generateWithLovableAI(hotelName: string, apiKey: string): Promise<string | null> {
  const prompt = `Fotografia profissional e realista de um hotel chamado "${hotelName}". ` +
    `Fachada ou vista frontal moderna, iluminação natural de fim de tarde, ` +
    `estilo revista de turismo, alta qualidade, sem pessoas em destaque, sem texto ou logo visível. ` +
    `Ambiente aconchegante e convidativo.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("lovable ai HTTP", res.status, body.slice(0, 500));
    return null;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.error("lovable ai no b64", JSON.stringify(data).slice(0, 500));
    return null;
  }
  return `data:image/png;base64,${b64}`;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
