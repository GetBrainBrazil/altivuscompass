ALTER TABLE public.vault_items
  ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS "Authorized viewers can read vault_items" ON public.vault_items;
DROP POLICY IF EXISTS "Users can view allowed vault_items" ON public.vault_items;

CREATE POLICY "Users can view own or shared vault_items"
ON public.vault_items
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.vault_item_viewers v
    WHERE v.vault_item_id = vault_items.id
      AND v.user_id = auth.uid()
  )
);