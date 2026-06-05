CREATE OR REPLACE FUNCTION public.is_vault_item_owner(_item_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vault_items
    WHERE id = _item_id
      AND created_by = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_vault_item(_item_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vault_items i
    WHERE i.id = _item_id
      AND i.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.vault_item_viewers v
    WHERE v.vault_item_id = _item_id
      AND v.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_vault_item(_item_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vault_items i
    WHERE i.id = _item_id
      AND i.created_by = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.vault_item_viewers v
    WHERE v.vault_item_id = _item_id
      AND v.user_id = _user_id
      AND v.can_edit = true
  );
$$;

DROP POLICY IF EXISTS "Creator can select own vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Authorized viewers can select vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Authenticated can insert own vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Creator can update own vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Editors can update vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Creator can delete own vault_items" ON public.vault_items;

CREATE POLICY "Users can view allowed vault_items"
  ON public.vault_items FOR SELECT TO authenticated
  USING (public.can_view_vault_item(id, auth.uid()));

CREATE POLICY "Users can create own vault_items"
  ON public.vault_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can edit allowed vault_items"
  ON public.vault_items FOR UPDATE TO authenticated
  USING (public.can_edit_vault_item(id, auth.uid()))
  WITH CHECK (public.can_edit_vault_item(id, auth.uid()));

CREATE POLICY "Owners can delete own vault_items"
  ON public.vault_items FOR DELETE TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Creator can manage viewers" ON public.vault_item_viewers;
DROP POLICY IF EXISTS "Users can view own viewer rows" ON public.vault_item_viewers;
DROP POLICY IF EXISTS "Users can view their own viewer records" ON public.vault_item_viewers;

CREATE POLICY "Owners can manage vault_item_viewers"
  ON public.vault_item_viewers FOR ALL TO authenticated
  USING (public.is_vault_item_owner(vault_item_id, auth.uid()))
  WITH CHECK (public.is_vault_item_owner(vault_item_id, auth.uid()));

CREATE POLICY "Users can view own vault_item_viewers rows"
  ON public.vault_item_viewers FOR SELECT TO authenticated
  USING (user_id = auth.uid());