-- ============================================================
-- PRODHIN — Cargas del camión: solo el admin (desde la web)
-- Igual que los recuentos, las CARGAS pasan a ser exclusivas del admin.
-- El chofer solo LEE (para calcular su stock).
-- ============================================================

DROP POLICY IF EXISTS "truck_loads: chofer gestiona propias" ON public.truck_loads;

CREATE POLICY "truck_loads: chofer lee propias"
  ON public.truck_loads FOR SELECT
  TO authenticated
  USING (driver_id = public.get_my_id());

-- La política "truck_loads: admin acceso total" (FOR ALL) ya existente
-- permite al admin registrar cargas de cualquier chofer.
