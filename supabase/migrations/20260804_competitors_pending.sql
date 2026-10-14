-- ============================================================
-- PRODHIN — Competidores marcados por choferes (flujo de aprobación)
-- Ejecutar en el SQL Editor de Supabase.
--
-- El chofer, que sí está en la calle, marca en el mapa de la app dónde
-- opera un competidor (con su GPS). Entra como "pendiente". La
-- administración lo ve en el módulo Competencia, lo ajusta (nombre,
-- radio de acción) y lo APRUEBA. Solo los aprobados cuentan como zona.
-- ============================================================

-- Estado de aprobación. Los que ya existían quedan como 'aprobado'.
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aprobado'
    CHECK (status IN ('pendiente', 'aprobado'));

CREATE INDEX IF NOT EXISTS idx_competitors_status ON public.competitors (status, created_at DESC);

-- El chofer puede PROPONER un competidor: siempre entra como 'pendiente'
-- y a su propio nombre. No puede editar ni aprobar (eso es solo admin,
-- ya cubierto por la política "competitors: admin acceso total").
DROP POLICY IF EXISTS "competitors: chofer propone" ON public.competitors;
CREATE POLICY "competitors: chofer propone" ON public.competitors FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND created_by = public.get_my_id()
    AND status = 'pendiente'
  );
