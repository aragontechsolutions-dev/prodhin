-- ============================================================
-- PRODHIN — Entrega de maples plásticos a la empresa (con aprobación)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Flujo: el chofer registra cuántos maples plásticos entrega a la empresa
-- (declared_qty). El admin los cuenta y APRUEBA con la cantidad real
-- (approved_qty) o RECHAZA. Todo queda en auditoría (trigger).
--
-- Es un registro independiente: NO toca los saldos de cajas por cliente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.maple_returns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  declared_qty integer NOT NULL CHECK (declared_qty > 0),   -- lo que declara el chofer
  status       text NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  approved_qty integer,                                     -- lo que contó/aprobó el admin
  driver_note  text,
  review_note  text,
  reviewed_by  uuid REFERENCES public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maple_returns_driver
  ON public.maple_returns (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maple_returns_status
  ON public.maple_returns (status, created_at DESC);

ALTER TABLE public.maple_returns ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total (ve, aprueba, rechaza)
DROP POLICY IF EXISTS "maple_returns: admin acceso total" ON public.maple_returns;
CREATE POLICY "maple_returns: admin acceso total"
  ON public.maple_returns FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: ve las suyas
DROP POLICY IF EXISTS "maple_returns: chofer ve propias" ON public.maple_returns;
CREATE POLICY "maple_returns: chofer ve propias"
  ON public.maple_returns FOR SELECT
  USING (driver_id = public.get_my_id());

-- Chofer: registra las suyas (no puede aprobar; el estado lo maneja el admin)
DROP POLICY IF EXISTS "maple_returns: chofer registra propias" ON public.maple_returns;
CREATE POLICY "maple_returns: chofer registra propias"
  ON public.maple_returns FOR INSERT
  WITH CHECK (driver_id = public.get_my_id());

-- Auditoría automática (registro + aprobación/rechazo del admin)
DROP TRIGGER IF EXISTS audit_maple_returns ON public.maple_returns;
CREATE TRIGGER audit_maple_returns
  AFTER INSERT OR UPDATE OR DELETE ON public.maple_returns
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
