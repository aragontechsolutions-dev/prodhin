-- ============================================================
-- PRODHIN — Reporte de descuadres de stock (chofer reporta, admin ajusta)
-- Ejecutar en el SQL Editor de Supabase (después de 20260807).
--
-- El chofer hace un "arqueo" en la app: cuenta físicamente y, si no coincide
-- con lo que dice el sistema, REPORTA el descuadre (no ajusta nada). La
-- administración lo revisa en la web, concilia y aplica el ajuste.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_discrepancies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- id del cliente (idempotencia offline)
  driver_id         uuid NOT NULL REFERENCES public.profiles(id),
  note              text,
  status            text NOT NULL DEFAULT 'pendiente'
                      CHECK (status IN ('pendiente', 'resuelto', 'descartado')),
  resolution_reason text,          -- merma / roto / error_carga / entrega_no_registrada / otro
  resolution_note   text,
  resolved_by       uuid REFERENCES public.profiles(id),
  resolved_at       timestamptz,
  created_by        uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_disc_status ON public.stock_discrepancies (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stock_discrepancy_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id uuid NOT NULL REFERENCES public.stock_discrepancies(id) ON DELETE CASCADE,
  egg_type_id    uuid NOT NULL REFERENCES public.egg_types(id),
  system_qty     integer NOT NULL,   -- cp que decía el sistema al reportar
  counted_qty    integer NOT NULL    -- cp contadas físicamente por el chofer
);
CREATE INDEX IF NOT EXISTS idx_stock_disc_items_parent ON public.stock_discrepancy_items (discrepancy_id);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.stock_discrepancies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_discrepancy_items  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_disc: admin acceso total" ON public.stock_discrepancies;
CREATE POLICY "stock_disc: admin acceso total" ON public.stock_discrepancies FOR ALL
  TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "stock_disc: chofer ve propios" ON public.stock_discrepancies;
CREATE POLICY "stock_disc: chofer ve propios" ON public.stock_discrepancies FOR SELECT
  TO authenticated USING (driver_id = public.get_my_id());

DROP POLICY IF EXISTS "stock_disc: chofer reporta" ON public.stock_discrepancies;
CREATE POLICY "stock_disc: chofer reporta" ON public.stock_discrepancies FOR INSERT
  TO authenticated WITH CHECK (public.get_my_role() = 'chofer' AND driver_id = public.get_my_id());

DROP POLICY IF EXISTS "stock_disc_items: admin acceso total" ON public.stock_discrepancy_items;
CREATE POLICY "stock_disc_items: admin acceso total" ON public.stock_discrepancy_items FOR ALL
  TO authenticated USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "stock_disc_items: chofer ve propios" ON public.stock_discrepancy_items;
CREATE POLICY "stock_disc_items: chofer ve propios" ON public.stock_discrepancy_items FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM public.stock_discrepancies d
    WHERE d.id = stock_discrepancy_items.discrepancy_id AND d.driver_id = public.get_my_id()));

DROP POLICY IF EXISTS "stock_disc_items: chofer inserta propios" ON public.stock_discrepancy_items;
CREATE POLICY "stock_disc_items: chofer inserta propios" ON public.stock_discrepancy_items FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.stock_discrepancies d
    WHERE d.id = stock_discrepancy_items.discrepancy_id AND d.driver_id = public.get_my_id()));

-- ── Auditoría ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_stock_discrepancies ON public.stock_discrepancies;
CREATE TRIGGER audit_stock_discrepancies
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_discrepancies
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_stock_discrepancy_items ON public.stock_discrepancy_items;
CREATE TRIGGER audit_stock_discrepancy_items
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_discrepancy_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
