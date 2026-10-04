-- ============================================================
-- PRODHIN — Formas de pago, precios y deudas de crédito
-- Ejecutar en el SQL Editor de Supabase.
--
-- Resumen:
--  * egg_types: precio mínimo (min_price) y maples por caja plástica
--    (maples_per_box, para sueltos) por categoría.
--  * deliveries: forma de pago (efectivo/crédito) y monto total.
--  * delivery_items: precio unitario y total de la línea.
--  * customer_payments: cobros que bajan la deuda del cliente.
--  * Vista customer_debt_balance: saldo y nº de entregas a crédito sin cobrar.
--
-- Empaque (se deriva en la app, no se guarda):
--  * Suelto:    1 cajón = 2 cajas plásticas.  Precio mínimo POR CAJÓN.
--  * Envasado:  1 cajón = 3 cajas plásticas.  Precio mínimo POR ENVASE.
-- ============================================================

-- ── egg_types: precio mínimo + maples por caja ──────────────
ALTER TABLE public.egg_types
  ADD COLUMN IF NOT EXISTS min_price numeric(12,2),           -- mínimo: por cajón (suelto) o por envase (envasado)
  ADD COLUMN IF NOT EXISTS maples_per_box integer;            -- maples por caja plástica (sueltos; 6 normal, 5 Jumbo)

-- Por defecto, los sueltos traen 6 maples por caja plástica.
UPDATE public.egg_types SET maples_per_box = 6
  WHERE is_packaged = false AND maples_per_box IS NULL;
-- El Jumbo suelto trae 5 (huevos más grandes, ocupan más espacio).
UPDATE public.egg_types SET maples_per_box = 5
  WHERE is_packaged = false AND maples_per_box = 6 AND name ILIKE '%jumbo%';

-- ── deliveries: forma de pago + total ───────────────────────
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS payment_method text
    CHECK (payment_method IN ('efectivo', 'credito')),
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0;

-- ── delivery_items: precio unitario + total de línea ────────
ALTER TABLE public.delivery_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2),          -- por cajón (suelto) o por envase (envasado)
  ADD COLUMN IF NOT EXISTS line_total numeric(12,2);

-- ── customer_payments: cobros (bajan la deuda) ──────────────
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  driver_id   uuid REFERENCES public.profiles(id),            -- quién cobró (chofer o NULL si lo carga admin)
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  note        text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer
  ON public.customer_payments (customer_id, received_at DESC);

ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_payments: admin acceso total" ON public.customer_payments;
CREATE POLICY "customer_payments: admin acceso total" ON public.customer_payments FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "customer_payments: chofer ve accesibles" ON public.customer_payments;
CREATE POLICY "customer_payments: chofer ve accesibles" ON public.customer_payments FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'chofer' AND public.driver_can_access_customer(customer_id));

DROP POLICY IF EXISTS "customer_payments: chofer cobra accesibles" ON public.customer_payments;
CREATE POLICY "customer_payments: chofer cobra accesibles" ON public.customer_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND public.driver_can_access_customer(customer_id)
  );

DROP TRIGGER IF EXISTS audit_customer_payments ON public.customer_payments;
CREATE TRIGGER audit_customer_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ── Vista: saldo de deuda por cliente ───────────────────────
-- saldo = (entregas a crédito entregadas) − (cobros registrados)
-- entregas_credito_sin_cobrar = entregas a crédito POSTERIORES al último cobro.
CREATE OR REPLACE VIEW public.customer_debt_balance
WITH (security_invoker = true) AS
WITH cred AS (
  SELECT customer_id,
         COALESCE(SUM(total_amount), 0) AS deuda_bruta,
         MAX(delivered_at)             AS ultima_entrega_credito
  FROM public.deliveries
  WHERE payment_method = 'credito' AND status = 'entregado'
  GROUP BY customer_id
),
pay AS (
  SELECT customer_id,
         COALESCE(SUM(amount), 0) AS pagos,
         MAX(received_at)         AS ultimo_pago
  FROM public.customer_payments
  GROUP BY customer_id
)
SELECT c.id AS customer_id,
       COALESCE(cred.deuda_bruta, 0)                                 AS deuda_bruta,
       COALESCE(pay.pagos, 0)                                        AS pagos,
       COALESCE(cred.deuda_bruta, 0) - COALESCE(pay.pagos, 0)        AS saldo,
       cred.ultima_entrega_credito,
       pay.ultimo_pago,
       (SELECT COUNT(*) FROM public.deliveries d2
         WHERE d2.customer_id = c.id
           AND d2.payment_method = 'credito'
           AND d2.status = 'entregado'
           AND d2.delivered_at > COALESCE(pay.ultimo_pago, '-infinity'::timestamptz)
       )                                                             AS entregas_credito_sin_cobrar
FROM public.customers c
LEFT JOIN cred ON cred.customer_id = c.id
LEFT JOIN pay  ON pay.customer_id  = c.id;
