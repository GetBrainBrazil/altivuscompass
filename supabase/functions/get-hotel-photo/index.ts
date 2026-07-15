import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.98.0/cors";

// Uses Places API (New) with the server-side GOOGLE_MAPS_API_KEY to fetch a
// hotel photo. Public endpoint, safe because it only exposes a photo URI.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("query")?.trim();
    const fallback = url.searchParams.get("fallback")?.trim();
    const maxWidth = Number(url.searchParams.get("maxWidth") ?? "600");

    if (!query) {
      return json({ error: "missing query" }, 400);
    }

    const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!key) return json({ error: "missing key" }, 500);

    const tryQuery = async (q: string): Promise<string | null> => {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "places.id,places.displayName,places.photos",
        },
        body: JSON.stringify({ textQuery: q, maxResultCount: 1 }),
      });
      if (!res.ok) {
        console.error("searchText failed", res.status, await res.text());
        return null;
      }
      const data = await res.json();
      const photoName: string | undefined = data?.places?.[0]?.photos?.[0]?.name;
      if (!photoName) return null;

      const mediaRes = await fetch(
        `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${key}`,
      );
      if (!mediaRes.ok) {
        console.error("photo media failed", mediaRes.status, await mediaRes.text());
        return null;
      }
      const media = await mediaRes.json();
      return (media?.photoUri as string) ?? null;
    };

    let photoUri = await tryQuery(query);
    if (!photoUri && fallback && fallback !== query) {
      photoUri = await tryQuery(fallback);
    }

    return json({ photoUri });
  } catch (err) {
    console.error("get-hotel-photo error", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
