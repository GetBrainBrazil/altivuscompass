
ALTER TABLE public._pre_etapa3_snapshot_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._pre_etapa3_snapshot_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._pre_etapa3_snapshot_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._pre_etapa3_snapshot_deal_events_dealid_nulls ENABLE ROW LEVEL SECURITY;
-- Sem políticas: apenas service_role (que bypassa RLS) consegue ler.
