
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'sales_agent', 'operations');
CREATE TYPE public.travel_profile AS ENUM ('economic', 'opportunity', 'sophisticated');
CREATE TYPE public.quote_stage AS ENUM ('new', 'sent', 'negotiation', 'confirmed', 'issued', 'completed', 'post_sale');
CREATE TYPE public.financial_party_type AS ENUM ('individual', 'company');

-- HELPER: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Brasil',
  region TEXT,
  passport_status TEXT DEFAULT 'none',
  travel_preferences TEXT,
  notes TEXT,
  travel_profile travel_profile DEFAULT 'economic',
  preferred_airports TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins and managers can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PASSENGERS
CREATE TABLE public.passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  birth_date DATE,
  passport_number TEXT,
  passport_expiry DATE,
  nationality TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view passengers" ON public.passengers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert passengers" ON public.passengers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update passengers" ON public.passengers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete passengers" ON public.passengers
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_passengers_updated_at BEFORE UPDATE ON public.passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FINANCIAL PARTIES
CREATE TABLE public.financial_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type financial_party_type NOT NULL DEFAULT 'individual',
  document_number TEXT,
  billing_email TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view financial parties" ON public.financial_parties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert financial parties" ON public.financial_parties
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update financial parties" ON public.financial_parties
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete financial parties" ON public.financial_parties
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_financial_parties_updated_at BEFORE UPDATE ON public.financial_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTES
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  stage quote_stage NOT NULL DEFAULT 'new',
  destination TEXT,
  departure_city TEXT,
  departure_airport TEXT,
  travel_date_start DATE,
  travel_date_end DATE,
  airline_options TEXT,
  hotel_options TEXT,
  price_breakdown JSONB DEFAULT '{}',
  total_value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  destination_images TEXT[] DEFAULT '{}',
  quote_validity DATE,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotes" ON public.quotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quotes" ON public.quotes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins and managers can delete quotes" ON public.quotes
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Quote-Passengers junction
CREATE TABLE public.quote_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  passenger_id UUID REFERENCES public.passengers(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(quote_id, passenger_id)
);
ALTER TABLE public.quote_passengers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view quote passengers" ON public.quote_passengers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quote passengers" ON public.quote_passengers
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quote passengers" ON public.quote_passengers
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete quote passengers" ON public.quote_passengers
  FOR DELETE TO authenticated USING (true);

-- Quote-Financial Parties junction
CREATE TABLE public.quote_financial_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  financial_party_id UUID REFERENCES public.financial_parties(id) ON DELETE CASCADE NOT NULL,
  share_percentage NUMERIC(5,2),
  UNIQUE(quote_id, financial_party_id)
);
ALTER TABLE public.quote_financial_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view quote financial parties" ON public.quote_financial_parties
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quote financial parties" ON public.quote_financial_parties
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quote financial parties" ON public.quote_financial_parties
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete quote financial parties" ON public.quote_financial_parties
  FOR DELETE TO authenticated USING (true);

-- MILES PROGRAMS
CREATE TABLE public.miles_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  airline TEXT NOT NULL,
  program_name TEXT NOT NULL,
  membership_number TEXT,
  login_email TEXT,
  login_password_encrypted TEXT,
  miles_balance INTEGER DEFAULT 0,
  expiration_date DATE,
  authorized_to_manage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.miles_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view miles" ON public.miles_programs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert miles" ON public.miles_programs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update miles" ON public.miles_programs
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete miles" ON public.miles_programs
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_miles_programs_updated_at BEFORE UPDATE ON public.miles_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  channel TEXT,
  template TEXT,
  filters JSONB DEFAULT '{}',
  recipients_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaigns" ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaigns" ON public.campaigns
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaigns" ON public.campaigns
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FINANCIAL TRANSACTIONS
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view finances" ON public.financial_transactions
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  );
CREATE POLICY "Admins can manage finances" ON public.financial_transactions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update finances" ON public.financial_transactions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete finances" ON public.financial_transactions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- INDEXES
CREATE INDEX idx_clients_travel_profile ON public.clients(travel_profile);
CREATE INDEX idx_clients_region ON public.clients(region);
CREATE INDEX idx_clients_preferred_airports ON public.clients USING GIN(preferred_airports);
CREATE INDEX idx_quotes_stage ON public.quotes(stage);
CREATE INDEX idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX idx_miles_client_id ON public.miles_programs(client_id);
CREATE INDEX idx_miles_expiration ON public.miles_programs(expiration_date);
