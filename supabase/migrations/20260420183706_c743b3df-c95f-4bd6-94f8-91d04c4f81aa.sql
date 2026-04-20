-- Allow managers to manage operational registrations (cadastros)
-- Suppliers
DROP POLICY IF EXISTS "Admins can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Admins can delete suppliers" ON public.suppliers;
CREATE POLICY "Admins and managers can insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Supplier phones
DROP POLICY IF EXISTS "Admins can insert supplier_phones" ON public.supplier_phones;
DROP POLICY IF EXISTS "Admins can update supplier_phones" ON public.supplier_phones;
DROP POLICY IF EXISTS "Admins can delete supplier_phones" ON public.supplier_phones;
CREATE POLICY "Admins and managers can insert supplier_phones" ON public.supplier_phones FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update supplier_phones" ON public.supplier_phones FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete supplier_phones" ON public.supplier_phones FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Supplier emails
DROP POLICY IF EXISTS "Admins can insert supplier_emails" ON public.supplier_emails;
DROP POLICY IF EXISTS "Admins can update supplier_emails" ON public.supplier_emails;
DROP POLICY IF EXISTS "Admins can delete supplier_emails" ON public.supplier_emails;
CREATE POLICY "Admins and managers can insert supplier_emails" ON public.supplier_emails FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update supplier_emails" ON public.supplier_emails FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete supplier_emails" ON public.supplier_emails FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Airports
DROP POLICY IF EXISTS "Admins can insert airports" ON public.airports;
DROP POLICY IF EXISTS "Admins can update airports" ON public.airports;
DROP POLICY IF EXISTS "Admins can delete airports" ON public.airports;
CREATE POLICY "Admins and managers can insert airports" ON public.airports FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update airports" ON public.airports FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete airports" ON public.airports FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Airlines
DROP POLICY IF EXISTS "Admins can insert airlines" ON public.airlines;
DROP POLICY IF EXISTS "Admins can update airlines" ON public.airlines;
DROP POLICY IF EXISTS "Admins can delete airlines" ON public.airlines;
CREATE POLICY "Admins and managers can insert airlines" ON public.airlines FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update airlines" ON public.airlines FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete airlines" ON public.airlines FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Continents
DROP POLICY IF EXISTS "Admins can insert continents" ON public.continents;
DROP POLICY IF EXISTS "Admins can update continents" ON public.continents;
DROP POLICY IF EXISTS "Admins can delete continents" ON public.continents;
CREATE POLICY "Admins and managers can insert continents" ON public.continents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update continents" ON public.continents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete continents" ON public.continents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Continent countries
DROP POLICY IF EXISTS "Admins can insert continent_countries" ON public.continent_countries;
DROP POLICY IF EXISTS "Admins can update continent_countries" ON public.continent_countries;
DROP POLICY IF EXISTS "Admins can delete continent_countries" ON public.continent_countries;
CREATE POLICY "Admins and managers can insert continent_countries" ON public.continent_countries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update continent_countries" ON public.continent_countries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete continent_countries" ON public.continent_countries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Countries
DROP POLICY IF EXISTS "Admins can insert countries" ON public.countries;
DROP POLICY IF EXISTS "Admins can update countries" ON public.countries;
DROP POLICY IF EXISTS "Admins can delete countries" ON public.countries;
CREATE POLICY "Admins and managers can insert countries" ON public.countries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update countries" ON public.countries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete countries" ON public.countries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- States
DROP POLICY IF EXISTS "Admins can insert states" ON public.states;
DROP POLICY IF EXISTS "Admins can update states" ON public.states;
DROP POLICY IF EXISTS "Admins can delete states" ON public.states;
CREATE POLICY "Admins and managers can insert states" ON public.states FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update states" ON public.states FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete states" ON public.states FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Cities
DROP POLICY IF EXISTS "Admins can insert cities" ON public.cities;
DROP POLICY IF EXISTS "Admins can update cities" ON public.cities;
DROP POLICY IF EXISTS "Admins can delete cities" ON public.cities;
CREATE POLICY "Admins and managers can insert cities" ON public.cities FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update cities" ON public.cities FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete cities" ON public.cities FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Custom destinations
DROP POLICY IF EXISTS "Admins can insert custom_destinations" ON public.custom_destinations;
DROP POLICY IF EXISTS "Admins can update custom_destinations" ON public.custom_destinations;
DROP POLICY IF EXISTS "Admins can delete custom_destinations" ON public.custom_destinations;
CREATE POLICY "Admins and managers can insert custom_destinations" ON public.custom_destinations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update custom_destinations" ON public.custom_destinations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete custom_destinations" ON public.custom_destinations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Custom destination items
DROP POLICY IF EXISTS "Admins can insert custom_destination_items" ON public.custom_destination_items;
DROP POLICY IF EXISTS "Admins can update custom_destination_items" ON public.custom_destination_items;
DROP POLICY IF EXISTS "Admins can delete custom_destination_items" ON public.custom_destination_items;
CREATE POLICY "Admins and managers can insert custom_destination_items" ON public.custom_destination_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update custom_destination_items" ON public.custom_destination_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete custom_destination_items" ON public.custom_destination_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Financial categories (chart of accounts)
DROP POLICY IF EXISTS "Admins can insert financial_categories" ON public.financial_categories;
DROP POLICY IF EXISTS "Admins can update financial_categories" ON public.financial_categories;
DROP POLICY IF EXISTS "Admins can delete financial_categories" ON public.financial_categories;
CREATE POLICY "Admins and managers can insert financial_categories" ON public.financial_categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can update financial_categories" ON public.financial_categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins and managers can delete financial_categories" ON public.financial_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));