-- ============================================================
-- PRODHIN — Huevos rotos y devoluciones (vencidos) con aprobación
-- Ejecutar en el SQL Editor de Supabase.
--
-- El chofer reporta a la empresa:
--   * huevos ROTOS (total simple), y/o
--   * productos envasados VENCIDOS (por categoría, con la fecha de caducidad
--     que dice el envase).
-- Queda PENDIENTE de aprobación. El admin controla la devolución y registra
-- cuántos le devuelve al chofer (rotos y/o envasados, con la fecha del envase
-- de reposición). Todo queda en auditoría (trigger).
--
-- Registro independiente (no toca stock). expiry se guarda como TEXTO tal cual
-- dice el envase (ej: "06/2026" o "15/06/2026").
-- ============================================================

CREATE TABLE IF NOT EXISTS public.egg_returns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  broken_qty      integer NOT NULL DEFAULT 0 CHECK (broken_qty >= 0),  -- rotos declarados (total)
  broken_returned integer,                                            -- rotos que el admin devuelve
  status          text NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','aprobada','rechazada')),
  driver_note     text,
  review_note     text,
  reviewed_by     uuid REFERENCES public.profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.egg_return_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id            uuid NOT NULL REFERENCES public.egg_returns(id) ON DELETE CASCADE,
  egg_type_id          uuid NOT NULL REFERENCES public.egg_types(id),
  qty                  integer NOT NULL CHECK (qty > 0),   -- envasados vencidos declarados
  expiry_date          text NOT NULL,                       -- fecha del envase (texto)
  returned_qty         integer,                             -- envasados que el admin devuelve
  returned_expiry_date text                                 -- fecha del envase de reposición
);

CREATE INDEX IF NOT EXISTS idx_egg_returns_driver ON public.egg_returns (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_egg_returns_status ON public.egg_returns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_egg_return_items_return ON public.egg_return_items (return_id);

ALTER TABLE public.egg_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_return_items ENABLE ROW LEVEL SECURITY;

-- egg_returns: admin total; chofer ve e inserta las suyas
DROP POLICY IF EXISTS "egg_returns: admin acceso total" ON public.egg_returns;
CREATE POLICY "egg_returns: admin acceso total" ON public.egg_returns FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "egg_returns: chofer ve propias" ON public.egg_returns;
CREATE POLICY "egg_returns: chofer ve propias" ON public.egg_returns FOR SELECT
  USING (driver_id = public.get_my_id());
DROP POLICY IF EXISTS "egg_returns: chofer registra propias" ON public.egg_returns;
CREATE POLICY "egg_returns: chofer registra propias" ON public.egg_returns FOR INSERT
  WITH CHECK (driver_id = public.get_my_id());

-- egg_return_items: admin total; chofer ve/inserta si el encabezado es suyo
DROP POLICY IF EXISTS "egg_return_items: admin acceso total" ON public.egg_return_items;
CREATE POLICY "egg_return_items: admin acceso total" ON public.egg_return_items FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "egg_return_items: chofer ve propias" ON public.egg_return_items;
CREATE POLICY "egg_return_items: chofer ve propias" ON public.egg_return_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.egg_returns r WHERE r.id = return_id AND r.driver_id = public.get_my_id()));
DROP POLICY IF EXISTS "egg_return_items: chofer inserta propias" ON public.egg_return_items;
CREATE POLICY "egg_return_items: chofer inserta propias" ON public.egg_return_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.egg_returns r WHERE r.id = return_id AND r.driver_id = public.get_my_id()));

-- Auditoría automática
DROP TRIGGER IF EXISTS audit_egg_returns ON public.egg_returns;
CREATE TRIGGER audit_egg_returns AFTER INSERT OR UPDATE OR DELETE ON public.egg_returns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
DROP TRIGGER IF EXISTS audit_egg_return_items ON public.egg_return_items;
CREATE TRIGGER audit_egg_return_items AFTER INSERT OR UPDATE OR DELETE ON public.egg_return_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
