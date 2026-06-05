
-- Vault items table (senhas, acessos, observações)
CREATE TABLE public.vault_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  url TEXT,
  username TEXT,
  password TEXT,
  notes TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_items TO authenticated;
GRANT ALL ON public.vault_items TO service_role;

ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- Viewers granted by admin
CREATE TABLE public.vault_item_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_item_id UUID NOT NULL REFERENCES public.vault_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vault_item_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_item_viewers TO authenticated;
GRANT ALL ON public.vault_item_viewers TO service_role;

ALTER TABLE public.vault_item_viewers ENABLE ROW LEVEL SECURITY;

-- Policies for vault_items
CREATE POLICY "Admins can manage vault_items"
  ON public.vault_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authorized viewers can read vault_items"
  ON public.vault_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vault_item_viewers v
      WHERE v.vault_item_id = vault_items.id
        AND v.user_id = auth.uid()
    )
  );

-- Policies for vault_item_viewers
CREATE POLICY "Admins can manage vault_item_viewers"
  ON public.vault_item_viewers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own viewer records"
  ON public.vault_item_viewers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER update_vault_items_updated_at
  BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
