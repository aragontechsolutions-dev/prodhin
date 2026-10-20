-- ============================================================
-- PRODHIN — Recogida de cajas sin entrega + Horario de cierre de clientes
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- ── 1. Recogida de cajas plásticas SIN entrega ──────────────
-- A veces el cliente no compra pero devuelve cajas. El chofer lo registra
-- desde la app y baja el saldo de cajas del local.
CREATE TABLE IF NOT EXISTS public.box_pickups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  driver_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qty         integer NOT NULL CHECK (qty > 0),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_box_pickups_customer ON public.box_pickups (customer_id);
CREATE INDEX IF NOT EXISTS idx_box_pickups_driver ON public.box_pickups (driver_id, created_at DESC);

ALTER TABLE public.box_pickups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "box_pickups: admin acceso total" ON public.box_pickups;
CREATE POLICY "box_pickups: admin acceso total" ON public.box_pickups FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
DROP POLICY IF EXISTS "box_pickups: chofer ve propias" ON public.box_pickups;
CREATE POLICY "box_pickups: chofer ve propias" ON public.box_pickups FOR SELECT
  USING (driver_id = public.get_my_id());
DROP POLICY IF EXISTS "box_pickups: chofer registra propias" ON public.box_pickups;
CREATE POLICY "box_pickups: chofer registra propias" ON public.box_pickups FOR INSERT
  WITH CHECK (driver_id = public.get_my_id());

DROP TRIGGER IF EXISTS audit_box_pickups ON public.box_pickups;
CREATE TRIGGER audit_box_pickups AFTER INSERT OR UPDATE OR DELETE ON public.box_pickups
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Saldo de cajas por cliente = dejadas − recogidas (en entregas) − recogidas sueltas
CREATE OR REPLACE VIEW public.customer_box_balance
WITH (security_invoker = true) AS
WITH per_delivery AS (
  SELECT
    d.customer_id, d.mode, d.cajas_recogidas,
    COALESCE((SELECT SUM(di.cajas_plasticas) FROM public.delivery_items di WHERE di.delivery_id = d.id), 0) AS cp_total
  FROM public.deliveries d
  WHERE d.status = 'entregado'
),
movimientos AS (
  SELECT customer_id, (CASE WHEN mode = 'cp' THEN cp_total ELSE 0 END) - cajas_recogidas AS delta FROM per_delivery
  UNION ALL
  SELECT customer_id, -qty AS delta FROM public.box_pickups
)
SELECT customer_id, SUM(delta)::int AS cajas_en_local
FROM movimientos
GROUP BY customer_id;

-- ── 2. Horario de cierre por cliente (lo carga el chofer) ────
CREATE TABLE IF NOT EXISTS public.customer_schedules (
  customer_id  uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  closing_time time NOT NULL,               -- hora de cierre (misma todos los días)
  updated_by   uuid REFERENCES public.profiles(id),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customer_schedules: admin acceso total" ON public.customer_schedules;
CREATE POLICY "customer_schedules: admin acceso total" ON public.customer_schedules FOR ALL
  USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');
-- El chofer sabe los horarios: puede verlos y gestionarlos
DROP POLICY IF EXISTS "customer_schedules: chofer gestiona" ON public.customer_schedules;
CREATE POLICY "customer_schedules: chofer gestiona" ON public.customer_schedules FOR ALL
  USING (public.get_my_role() = 'chofer') WITH CHECK (public.get_my_role() = 'chofer');

DROP TRIGGER IF EXISTS audit_customer_schedules ON public.customer_schedules;
CREATE TRIGGER audit_customer_schedules AFTER INSERT OR UPDATE OR DELETE ON public.customer_schedules
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
