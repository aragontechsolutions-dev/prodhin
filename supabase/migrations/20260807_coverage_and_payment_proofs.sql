-- ============================================================
-- PRODHIN — Cobertura de licencia, método de cobro y comprobantes
-- Ejecutar en el SQL Editor de Supabase (después de 20260806).
--
-- 1) El chofer que cubre una licencia ve TODO lo del cliente del chofer
--    ausente (entregas, deuda, cajas) — no como clientes separados. Se logra
--    ampliando la visibilidad (SELECT) de deliveries/delivery_items a los
--    clientes accesibles (asignados o delegados), no solo a las entregas
--    propias. Las vistas de saldo/deuda son security_invoker, así que heredan.
-- 2) customer_payments: método de cobro (efectivo/cheque/transferencia) y
--    ruta del comprobante (foto del cheque o PDF de la transferencia).
-- 3) Bucket privado "comprobantes" para esos archivos.
-- ============================================================

-- ── 1. Visibilidad de entregas para el chofer que cubre ─────
DROP POLICY IF EXISTS "deliveries: chofer ve propias" ON public.deliveries;
CREATE POLICY "deliveries: chofer ve accesibles"
  ON public.deliveries FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'chofer'
    AND (
      driver_id = public.get_my_id()
      OR public.driver_can_access_customer(customer_id)
    )
  );

DROP POLICY IF EXISTS "delivery_items: chofer ve propias" ON public.delivery_items;
CREATE POLICY "delivery_items: chofer ve accesibles"
  ON public.delivery_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND (
          d.driver_id = public.get_my_id()
          OR public.driver_can_access_customer(d.customer_id)
        )
    )
  );

-- ── 2. Método de cobro + comprobante ────────────────────────
ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'efectivo'
    CHECK (method IN ('efectivo', 'cheque', 'transferencia')),
  ADD COLUMN IF NOT EXISTS proof_path text;   -- ruta en el bucket "comprobantes"

-- ── 3. Bucket privado para comprobantes ─────────────────────
-- Privado: las fotos de cheques / PDFs de transferencias no deben ser
-- públicas. Se leen con URL firmada (createSignedUrl) por usuarios con sesión.
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "comprobantes: subida" ON storage.objects;
CREATE POLICY "comprobantes: subida" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'comprobantes');

DROP POLICY IF EXISTS "comprobantes: lectura" ON storage.objects;
CREATE POLICY "comprobantes: lectura" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'comprobantes');
