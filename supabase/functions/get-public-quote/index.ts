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

    // Whitelist of fields safe to expose to the public client.
    // IMPORTANT: never use select("*") here — internal/commercial fields
    // (cost, commission, supplier, internal notes, etc.) must NEVER leak.
    const PUBLIC_QUOTE_FIELDS = [
      "id",
      "title",
      "destination",
      "travel_date_start",
      "travel_date_end",
      "total_value",
      "discount_amount",
      "discount_percent",
      "details",
      "payment_terms",
      "terms_conditions",
      "other_info",
      "client_notes",
      "notes",
      "cover_image_url",
      "quote_validity",
      "stage",
      "price_breakdown",
      "client_id",
      "created_at",
      "updated_at",
    ].join(", ");

    // Fetch quote with client name and phone
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`${PUBLIC_QUOTE_FIELDS}, clients(full_name, phone)`)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch primary phone from client_phones if available
    let clientPhone = quote.clients?.phone ?? null;
    if (quote.client_id) {
      const { data: primaryPhone } = await supabase
        .from("client_phones")
        .select("phone")
        .eq("client_id", quote.client_id)
        .eq("is_primary", true)
        .limit(1)
        .single();
      if (primaryPhone?.phone) {
        clientPhone = primaryPhone.phone;
      } else if (!clientPhone) {
        const { data: anyPhone } = await supabase
          .from("client_phones")
          .select("phone")
          .eq("client_id", quote.client_id)
          .limit(1)
          .single();
        if (anyPhone?.phone) clientPhone = anyPhone.phone;
      }
    }

    // Whitelist of quote_items fields safe to expose. Excludes:
    // unit_cost, commission_amount, commission_status, supplier_id,
    // payment_source, attachment_urls, created_at, updated_at.
    const PUBLIC_ITEM_FIELDS = [
      "id",
      "item_type",
      "title",
      "description",
      "details",
      "sort_order",
      "quantity",
      "unit_price",
      "option_group",
      "option_label",
      "option_order",
      "is_recommended",
      "is_selected",
      "external_url",
    ].join(", ");

    // Fetch quote items
    const { data: items } = await supabase
      .from("quote_items")
      .select(PUBLIC_ITEM_FIELDS)
      .eq("quote_id", quoteId)
      .order("sort_order");

    // Fetch passengers linked to this quote
    const { data: quotePassengers } = await supabase
      .from("quote_passengers")
      .select("*, passengers(full_name, relationship_type)")
      .eq("quote_id", quoteId);

    // Fetch linked clients from price_breakdown
    const linkedClientIds: string[] = (quote.price_breakdown as any)?.linked_client_ids ?? [];
    let linkedClients: { full_name: string; relationship_type: string | null }[] = [];
    if (linkedClientIds.length > 0 && quote.client_id) {
      // Get relationship info from client_relationships
      const { data: relationships } = await supabase
        .from("client_relationships")
        .select("client_id_a, client_id_b, relationship_type")
        .or(`client_id_a.eq.${quote.client_id},client_id_b.eq.${quote.client_id}`)
        .in("client_id_a", [...linkedClientIds, quote.client_id])
        .in("client_id_b", [...linkedClientIds, quote.client_id]);

      // Fetch linked client names
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, full_name")
        .in("id", linkedClientIds);

      const relationshipMap: Record<string, string> = {};
      // Map to invert relationship labels
      const INVERSE_RELATIONSHIP: Record<string, string> = {
        spouse: "spouse",
        child: "parent",
        parent: "child",
        employee: "partner",
        partner: "employee",
        sibling: "sibling",
        other: "other",
      };

      for (const rel of (relationships ?? [])) {
        if (rel.client_id_a === quote.client_id && linkedClientIds.includes(rel.client_id_b)) {
          relationshipMap[rel.client_id_b] = rel.relationship_type;
        } else if (rel.client_id_b === quote.client_id && linkedClientIds.includes(rel.client_id_a)) {
          // Invert relationship perspective
          relationshipMap[rel.client_id_a] = INVERSE_RELATIONSHIP[rel.relationship_type] || rel.relationship_type;
        }
      }

      linkedClients = (clientsData ?? []).map((c: any) => ({
        full_name: c.full_name,
        relationship_type: relationshipMap[c.id] || null,
      }));
    }

    // Fetch agency settings
    const { data: agency } = await supabase
      .from("agency_settings")
      .select("*")
      .limit(1)
      .single();

    // Fetch linked itinerary with public token
    const { data: itinerary } = await supabase
      .from("itineraries")
      .select("id, title, public_token")
      .eq("quote_id", quoteId)
      .limit(1)
      .single();

    // Merge passengers and linked clients
    const allPassengers = [
      ...(quotePassengers ?? []).map((qp: any) => ({
        full_name: qp.passengers?.full_name,
        relationship_type: qp.passengers?.relationship_type,
      })),
      ...linkedClients,
    ];

    return new Response(
      JSON.stringify({
        quote: {
          ...quote,
          client_name: quote.clients?.full_name ?? null,
          client_phone: clientPhone,
          clients: undefined,
        },
        items: items ?? [],
        passengers: allPassengers,
        agency: agency ?? null,
        itinerary: itinerary?.public_token ? { title: itinerary.title, public_token: itinerary.public_token } : null,
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
