ALTER TABLE public.deal_events DROP CONSTRAINT IF EXISTS deal_events_event_type_known;
ALTER TABLE public.deal_events ADD CONSTRAINT deal_events_event_type_known CHECK (event_type = ANY (ARRAY[
  'deal_created','phase_changed','stage_changed',
  'quote_sent','quote_accepted','quote_lost','quote_archived','quote_unarchived',
  'sale_created','sale_stage_changed',
  'item_added','item_updated','item_removed','item_returned',
  'client_promoted','client_reverted','client_revert_skipped',
  'deal_fully_returned'
]));