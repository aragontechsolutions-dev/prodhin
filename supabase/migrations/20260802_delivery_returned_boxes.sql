-- ============================================================
-- PRODHIN — Cajas devueltas en el acto (durante la entrega)
-- Ejecutar en el SQL Editor de Supabase.
--
-- A veces se dejan cajas plásticas pero algunas se vacían y se devuelven en
-- el momento. cajas_devueltas = cuántas de las que se dejaron vuelven ya mismo.
-- Saldo en el local = dejadas − recogidas (de antes) − devueltas en el acto
--                     − recogidas sueltas (box_pickups).
-- ============================================================

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS cajas_devueltas integer NOT NULL DEFAULT 0
    CHECK (cajas_devueltas >= 0);

CREATE OR REPLACE VIEW public.customer_box_balance
WITH (security_invoker = true) AS
WITH per_delivery AS (
  SELECT
    d.customer_id, d.mode, d.cajas_recogidas, d.cajas_devueltas,
    COALESCE((SELECT SUM(di.cajas_plasticas) FROM public.delivery_items di WHERE di.delivery_id = d.id), 0) AS cp_total
  FROM public.deliveries d
  WHERE d.status = 'entregado'
),
movimientos AS (
  SELECT customer_id,
         (CASE WHEN mode = 'cp' THEN cp_total ELSE 0 END) - cajas_recogidas - cajas_devueltas AS delta
  FROM per_delivery
  UNION ALL
  SELECT customer_id, -qty AS delta FROM public.box_pickups
)
SELECT customer_id, SUM(delta)::int AS cajas_en_local
FROM movimientos
GROUP BY customer_id;
