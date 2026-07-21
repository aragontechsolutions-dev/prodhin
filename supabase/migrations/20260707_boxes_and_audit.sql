-- ============================================================
-- PRODHIN — Cajas plásticas en locales, modo de entrega,
--           corrección de entregas y auditoría automática
-- Ejecutar DESPUÉS de las migraciones anteriores.
-- ============================================================

-- ── Entregas: modo, cajas recogidas y motivo de corrección ──
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'cp'
    CHECK (mode IN ('cp', 'cartones')),
  ADD COLUMN IF NOT EXISTS cajas_recogidas INTEGER NOT NULL DEFAULT 0
    CHECK (cajas_recogidas >= 0),
  ADD COLUMN IF NOT EXISTS edit_reason TEXT;

-- ============================================================
-- Vista: saldo de cajas plásticas por cliente (cuántas hay en su local)
--   dejadas = si mode='cp', el total de cp entregado; si 'cartones', 0
--   saldo   = Σ dejadas − Σ recogidas   (solo entregas con venta)
-- ============================================================
CREATE OR REPLACE VIEW public.customer_box_balance
WITH (security_invoker = true) AS
WITH per_delivery AS (
  SELECT
    d.id, d.customer_id, d.mode, d.cajas_recogidas,
    COALESCE((SELECT SUM(di.cajas_plasticas) FROM public.delivery_items di WHERE di.delivery_id = d.id), 0) AS cp_total
  FROM public.deliveries d
  WHERE d.status = 'entregado'
)
SELECT
  customer_id,
  (SUM(CASE WHEN mode = 'cp' THEN cp_total ELSE 0 END) - SUM(cajas_recogidas))::int AS cajas_en_local
FROM per_delivery
GROUP BY customer_id;

-- ============================================================
-- AUDITORÍA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID,
  actor_role  TEXT,
  action      TEXT NOT NULL,            -- INSERT / UPDATE / DELETE
  table_name  TEXT NOT NULL,
  row_id      TEXT,
  reason      TEXT,                     -- motivo (ej. corrección de entrega)
  changed     JSONB,                    -- {old, new}
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_table   ON public.audit_log(table_name);

-- Trigger genérico: registra INSERT/UPDATE/DELETE con el usuario actual
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_row_id text;
  v_reason text;
  v_changed jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := to_jsonb(OLD) ->> 'id';
    v_reason := to_jsonb(OLD) ->> 'edit_reason';
    v_changed := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_row_id := to_jsonb(NEW) ->> 'id';
    v_reason := to_jsonb(NEW) ->> 'edit_reason';
    v_changed := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_row_id := to_jsonb(NEW) ->> 'id';
    v_reason := to_jsonb(NEW) ->> 'edit_reason';
    v_changed := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_role, action, table_name, row_id, reason, changed)
  VALUES (
    auth.uid(),
    auth.jwt() -> 'app_metadata' ->> 'role',
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_reason,
    v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adjuntar a las tablas clave
DROP TRIGGER IF EXISTS audit_deliveries ON public.deliveries;
CREATE TRIGGER audit_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_delivery_items ON public.delivery_items;
CREATE TRIGGER audit_delivery_items AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_customers ON public.customers;
CREATE TRIGGER audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_routes ON public.routes;
CREATE TRIGGER audit_routes AFTER INSERT OR UPDATE OR DELETE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_route_stops ON public.route_stops;
CREATE TRIGGER audit_route_stops AFTER INSERT OR UPDATE OR DELETE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_egg_types ON public.egg_types;
CREATE TRIGGER audit_egg_types AFTER INSERT OR UPDATE OR DELETE ON public.egg_types
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_customer_egg_preferences ON public.customer_egg_preferences;
CREATE TRIGGER audit_customer_egg_preferences AFTER INSERT OR UPDATE OR DELETE ON public.customer_egg_preferences
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_truck_loads ON public.truck_loads;
CREATE TRIGGER audit_truck_loads AFTER INSERT OR UPDATE OR DELETE ON public.truck_loads
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_truck_counts ON public.truck_counts;
CREATE TRIGGER audit_truck_counts AFTER INSERT OR UPDATE OR DELETE ON public.truck_counts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_driver_customers ON public.driver_customers;
CREATE TRIGGER audit_driver_customers AFTER INSERT OR UPDATE OR DELETE ON public.driver_customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_driver_delegations ON public.driver_delegations;
CREATE TRIGGER audit_driver_delegations AFTER INSERT OR UPDATE OR DELETE ON public.driver_delegations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- RLS: solo el admin puede leer la auditoría. Los inserts los hace el
-- trigger (SECURITY DEFINER), que no está sujeto a estas políticas.
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit: admin lee" ON public.audit_log;
CREATE POLICY "audit: admin lee"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');
