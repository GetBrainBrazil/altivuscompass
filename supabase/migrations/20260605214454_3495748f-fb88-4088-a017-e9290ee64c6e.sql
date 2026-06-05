
-- Add can_edit flag to viewers
ALTER TABLE public.vault_item_viewers
  ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false;

-- Rewrite vault_items policies: creator-only by default, plus authorized viewers
DROP POLICY IF EXISTS "Admins can manage vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Authorized users can view vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Viewers can see vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Creator full access vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Viewers can read vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Editors can update vault_items" ON public.vault_items;

CREATE POLICY "Creator can select own vault_items"
  ON public.vault_items FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Authorized viewers can select vault_items"
  ON public.vault_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vault_item_viewers v
    WHERE v.vault_item_id = vault_items.id AND v.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated can insert own vault_items"
  ON public.vault_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creator can update own vault_items"
  ON public.vault_items FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Editors can update vault_items"
  ON public.vault_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vault_item_viewers v
    WHERE v.vault_item_id = vault_items.id AND v.user_id = auth.uid() AND v.can_edit = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vault_item_viewers v
    WHERE v.vault_item_id = vault_items.id AND v.user_id = auth.uid() AND v.can_edit = true
  ));

CREATE POLICY "Creator can delete own vault_items"
  ON public.vault_items FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Rewrite vault_item_viewers policies: only the item creator can manage authorizations
DROP POLICY IF EXISTS "Admins can manage vault_item_viewers" ON public.vault_item_viewers;
DROP POLICY IF EXISTS "Users can view own viewer rows" ON public.vault_item_viewers;
DROP POLICY IF EXISTS "Creator can manage viewers" ON public.vault_item_viewers;
DROP POLICY IF EXISTS "Authenticated can view own viewer rows" ON public.vault_item_viewers;

CREATE POLICY "Creator can manage viewers"
  ON public.vault_item_viewers FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vault_items i
    WHERE i.id = vault_item_viewers.vault_item_id AND i.created_by = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vault_items i
    WHERE i.id = vault_item_viewers.vault_item_id AND i.created_by = auth.uid()
  ));

CREATE POLICY "Users can view own viewer rows"
  ON public.vault_item_viewers FOR SELECT TO authenticated
  USING (user_id = auth.uid());
