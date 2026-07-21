-- ============================================================
-- PRODHIN — Recuentos del camión: solo el admin
-- El chofer solo puede REGISTRAR CARGAS y LEER recuentos (para calcular su
-- stock). Los RECUENTOS (valor absoluto) los hace únicamente el admin desde
-- la plataforma web.
-- ============================================================

-- Quitar el permiso de gestión del chofer sobre truck_counts
DROP POLICY IF EXISTS "truck_counts: chofer gestiona propios" ON public.truck_counts;

-- El chofer solo puede LEER sus recuentos (necesario para el cálculo de stock)
CREATE POLICY "truck_counts: chofer lee propios"
  ON public.truck_counts FOR SELECT
  TO authenticated
  USING (driver_id = public.get_my_id());

-- La política "truck_counts: admin acceso total" (FOR ALL) ya existente
-- permite al admin crear/editar recuentos de cualquier chofer.
