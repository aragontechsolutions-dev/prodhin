-- ============================================================
-- PRODHIN — Inteligencia comercial: competencia + prospectos (potenciales)
-- Ejecutar en el SQL Editor de Supabase.
--
--  * competitors      : dónde opera la competencia + radio de acción (admin).
--  * prospects        : potenciales clientes relevados por los choferes, con
--                       ubicación; se pueden convertir en cliente real.
--  * prospect_offers  : la oferta de la competencia en ese local (tipo de
--                       huevo, formato, precio y foto).
-- Las fotos van a un bucket de Storage llamado "prospects".
-- ============================================================

-- ── Competidores (zonas del admin) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.competitors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  lat        double precision NOT NULL,
  lng        double precision NOT NULL,
  radius_m   integer NOT NULL DEFAULT 500 CHECK (radius_m > 0),  -- radio de acción (metros)
  notes      text,
  created_by uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitors: admin acceso total" ON public.competitors;
CREATE POLICY "competitors: admin acceso total" ON public.competitors FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "competitors: chofer ve" ON public.competitors;
CREATE POLICY "competitors: chofer ve" ON public.competitors FOR SELECT
  USING (public.get_my_role() = 'chofer');

DROP TRIGGER IF EXISTS audit_competitors ON public.competitors;
CREATE TRIGGER audit_competitors AFTER INSERT OR UPDATE OR DELETE ON public.competitors
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ── Prospectos (potenciales clientes) ───────────────────────
CREATE TABLE IF NOT EXISTS public.prospects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  address               text,
  phone                 text,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  has_competition       boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'nuevo'
                          CHECK (status IN ('nuevo','contactado','convertido','descartado')),
  notes                 text,
  created_by            uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  converted_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON public.prospects (status, created_at DESC);
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prospects: admin acceso total" ON public.prospects;
CREATE POLICY "prospects: admin acceso total" ON public.prospects FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "prospects: chofer ve propios" ON public.prospects;
CREATE POLICY "prospects: chofer ve propios" ON public.prospects FOR SELECT
  USING (created_by = public.get_my_id());
DROP POLICY IF EXISTS "prospects: chofer registra" ON public.prospects;
CREATE POLICY "prospects: chofer registra" ON public.prospects FOR INSERT
  WITH CHECK (created_by = public.get_my_id());

DROP TRIGGER IF EXISTS audit_prospects ON public.prospects;
CREATE TRIGGER audit_prospects AFTER INSERT OR UPDATE OR DELETE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ── Oferta de competencia relevada en cada prospecto ────────
CREATE TABLE IF NOT EXISTS public.prospect_offers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  egg_type    text,                  -- tipo de huevo de la competencia (texto libre)
  format      text,                  -- formato: "de a 30", "15", "6", etc.
  price       numeric(10,2),         -- precio ofertado
  photo_path  text,                  -- ruta en el bucket "prospects"
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prospect_offers_prospect ON public.prospect_offers (prospect_id);
ALTER TABLE public.prospect_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prospect_offers: admin acceso total" ON public.prospect_offers;
CREATE POLICY "prospect_offers: admin acceso total" ON public.prospect_offers FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "prospect_offers: chofer ve propios" ON public.prospect_offers;
CREATE POLICY "prospect_offers: chofer ve propios" ON public.prospect_offers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = public.get_my_id()));
DROP POLICY IF EXISTS "prospect_offers: chofer inserta propios" ON public.prospect_offers;
CREATE POLICY "prospect_offers: chofer inserta propios" ON public.prospect_offers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = public.get_my_id()));

DROP TRIGGER IF EXISTS audit_prospect_offers ON public.prospect_offers;
CREATE TRIGGER audit_prospect_offers AFTER INSERT OR UPDATE OR DELETE ON public.prospect_offers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ── Storage: bucket "prospects" para las fotos ──────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('prospects', 'prospects', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública (para mostrar las fotos en la web) y subida por usuarios
-- autenticados (choferes). Los nombres de archivo son uuid (no adivinables).
DROP POLICY IF EXISTS "prospects fotos: lectura" ON storage.objects;
CREATE POLICY "prospects fotos: lectura" ON storage.objects FOR SELECT
  USING (bucket_id = 'prospects');
DROP POLICY IF EXISTS "prospects fotos: subida" ON storage.objects;
CREATE POLICY "prospects fotos: subida" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prospects');
