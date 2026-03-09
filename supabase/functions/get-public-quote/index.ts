import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const quoteId = url.searchParams.get("id");

    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quote id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch quote with client name
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*, clients(full_name)")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch quote items
    const { data: items } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order");

    // Fetch passengers linked to this quote
    const { data: quotePassengers } = await supabase
      .from("quote_passengers")
      .select("*, passengers(full_name, relationship_type)")
      .eq("quote_id", quoteId);

    // Fetch agency settings
    const { data: agency } = await supabase
      .from("agency_settings")
      .select("*")
      .limit(1)
      .single();

    return new Response(
      JSON.stringify({
        quote: {
          ...quote,
          client_name: quote.clients?.full_name ?? null,
          clients: undefined,
        },
        items: items ?? [],
        passengers: (quotePassengers ?? []).map((qp: any) => ({
          full_name: qp.passengers?.full_name,
          relationship_type: qp.passengers?.relationship_type,
        })),
        agency: agency ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
