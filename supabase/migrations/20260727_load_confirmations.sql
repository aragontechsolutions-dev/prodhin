-- ============================================================
-- PRODHIN — Confirmación de la carga del día por el chofer
-- Ejecutar en el SQL Editor de Supabase.
--
-- Cuando el admin registra una carga (truck_loads), el chofer debe
-- CONFIRMARLA en la app antes de poder registrar entregas. Puede confirmar
-- "todo correcto" o "con diferencias" (informando las cantidades reales).
-- Todo queda en la auditoría automáticamente (trigger).
--
-- Una carga = todas las filas de truck_loads con el mismo created_at para
-- ese chofer (lote). La confirmación referencia ese timestamp.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.truck_load_confirmations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  load_created_at timestamptz NOT NULL,          -- timestamp del lote de carga confirmado
  has_discrepancy boolean NOT NULL DEFAULT false,
  note            text,                            -- explicación si hay diferencias
  details         jsonb,                           -- { assigned: {...}, actual: {...} } por egg_type_id
  confirmed_at    timestamptz NOT NULL DEFAULT now()
);

-- Una sola confirmación por lote y chofer
CREATE UNIQUE INDEX IF NOT EXISTS uq_load_confirmation_driver_batch
  ON public.truck_load_confirmations (driver_id, load_created_at);

CREATE INDEX IF NOT EXISTS idx_load_confirmations_driver
  ON public.truck_load_confirmations (driver_id, confirmed_at DESC);

ALTER TABLE public.truck_load_confirmations ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
DROP POLICY IF EXISTS "load_confirm: admin acceso total" ON public.truck_load_confirmations;
CREATE POLICY "load_confirm: admin acceso total"
  ON public.truck_load_confirmations FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: ve las suyas
DROP POLICY IF EXISTS "load_confirm: chofer ve propias" ON public.truck_load_confirmations;
CREATE POLICY "load_confirm: chofer ve propias"
  ON public.truck_load_confirmations FOR SELECT
  USING (driver_id = public.get_my_id());

-- Chofer: confirma las suyas (insert propio)
DROP POLICY IF EXISTS "load_confirm: chofer inserta propias" ON public.truck_load_confirmations;
CREATE POLICY "load_confirm: chofer inserta propias"
  ON public.truck_load_confirmations FOR INSERT
  WITH CHECK (driver_id = public.get_my_id());

-- Auditoría automática (mismo patrón que truck_loads, deliveries, etc.)
DROP TRIGGER IF EXISTS audit_truck_load_confirmations ON public.truck_load_confirmations;
CREATE TRIGGER audit_truck_load_confirmations
  AFTER INSERT OR UPDATE OR DELETE ON public.truck_load_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
