const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetches hotel photos through Google. It tries Places API (New) first and,
// when that API is not enabled on the Google project, falls back to the legacy
// Places photo flow server-side so the public quote page is not left empty.

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

    const triedErrors: Array<{ api: string; status?: number | string; reason?: string; body?: string }> = [];

    const tryPlacesNew = async (q: string): Promise<string | null> => {
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
        const body = await res.text();
        const reason = parseGoogleReason(body);
        triedErrors.push({ api: "places_new_search", status: res.status, reason, body: body.slice(0, 1000) });
        console.error("searchText failed", res.status, body);
        return null;
      }
      const data = await res.json();
      const photoName: string | undefined = data?.places?.[0]?.photos?.[0]?.name;
      if (!photoName) return null;

      const mediaRes = await fetch(
        `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${key}`,
      );
      if (!mediaRes.ok) {
        const body = await mediaRes.text();
        triedErrors.push({ api: "places_new_media", status: mediaRes.status, reason: parseGoogleReason(body), body: body.slice(0, 1000) });
        console.error("photo media failed", mediaRes.status, body);
        return null;
      }
      const media = await mediaRes.json();
      return (media?.photoUri as string) ?? null;
    };

    const tryLegacyPlaces = async (q: string): Promise<string | null> => {
      const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      searchUrl.searchParams.set("query", q);
      searchUrl.searchParams.set("type", "lodging");
      searchUrl.searchParams.set("key", key);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const body = await searchRes.text();
        triedErrors.push({ api: "places_legacy_search_http", status: searchRes.status, body: body.slice(0, 1000) });
        console.error("legacy place search HTTP failed", searchRes.status, body);
        return null;
      }

      const searchData = await searchRes.json();
      if (searchData?.status && searchData.status !== "OK" && searchData.status !== "ZERO_RESULTS") {
        triedErrors.push({
          api: "places_legacy_search",
          status: searchData.status,
          body: String(searchData?.error_message ?? "").slice(0, 1000),
        });
        console.error("legacy place search failed", searchData.status, searchData?.error_message ?? "");
        return null;
      }

      const photoReference: string | undefined = searchData?.results?.[0]?.photos?.[0]?.photo_reference;
      if (!photoReference) return null;

      const photoUrl = new URL("https://maps.googleapis.com/maps/api/place/photo");
      photoUrl.searchParams.set("maxwidth", String(maxWidth));
      photoUrl.searchParams.set("photo_reference", photoReference);
      photoUrl.searchParams.set("key", key);

      const photoRes = await fetch(photoUrl.toString(), { redirect: "follow" });
      if (!photoRes.ok) {
        const body = await photoRes.text();
        triedErrors.push({ api: "places_legacy_photo", status: photoRes.status, body: body.slice(0, 1000) });
        console.error("legacy place photo failed", photoRes.status, body);
        return null;
      }

      const contentType = photoRes.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) return null;
      const buffer = await photoRes.arrayBuffer();
      return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
    };

    const queries = Array.from(new Set([query, fallback].filter(Boolean))) as string[];
    let photoUri: string | null = null;
    for (const q of queries) {
      photoUri = await tryPlacesNew(q);
      if (photoUri) break;
    }

    if (!photoUri) {
      for (const q of queries) {
        photoUri = await tryLegacyPlaces(q);
        if (photoUri) break;
      }
    }

    if (!photoUri && fallback && fallback !== query) {
      // Keep response successful so the public page can keep rendering with
      // placeholders, but expose why the integration returned no image.
      const serviceDisabled = triedErrors.some((e) => e.reason === "SERVICE_DISABLED");
      const apiBlocked = triedErrors.some((e) => String(e.status).includes("REQUEST_DENIED") || e.reason === "API_KEY_SERVICE_BLOCKED");
      return json({
        photoUri: null,
        fallback: true,
        error: serviceDisabled ? "PLACES_API_DISABLED" : apiBlocked ? "PLACES_API_KEY_BLOCKED" : "PHOTO_NOT_FOUND",
        details: triedErrors.slice(0, 3).map(({ api, status, reason }) => ({ api, status, reason })),
      });
    }

    return json({ photoUri, fallback: !photoUri });
  } catch (err) {
    console.error("get-hotel-photo error", err);
    return json({ photoUri: null, fallback: true, error: "HOTEL_PHOTO_ERROR" });
  }
});

function parseGoogleReason(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.details?.find((d: any) => d?.reason)?.reason;
  } catch {
    return undefined;
  }
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
