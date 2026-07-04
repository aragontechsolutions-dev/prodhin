-- ============================================================
-- PRODHIN — Tipos de huevo habituales por cliente (varios)
-- Ejecutar DESPUÉS de 20260703_deliveries.sql
--
-- Un cliente puede tener VARIOS tipos habituales; uno puede
-- marcarse como "principal" (is_primary) para prellenar la
-- entrega. La entrega sigue siendo libre: el chofer puede
-- entregar cualquier tipo, esté o no en las preferencias.
-- ============================================================

CREATE TABLE public.customer_egg_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  egg_type_id  UUID NOT NULL REFERENCES public.egg_types(id) ON DELETE CASCADE,
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, egg_type_id)
);

CREATE INDEX idx_cep_customer ON public.customer_egg_preferences(customer_id);
CREATE INDEX idx_cep_egg_type ON public.customer_egg_preferences(egg_type_id);

-- Como máximo un principal por cliente (red de seguridad a nivel de BD)
CREATE UNIQUE INDEX uq_cep_primary
  ON public.customer_egg_preferences(customer_id)
  WHERE is_primary;

-- ============================================================
-- Migrar el dato existente (columna única) al nuevo modelo
-- ============================================================
INSERT INTO public.customer_egg_preferences (customer_id, egg_type_id, is_primary)
SELECT id, preferred_egg_type_id, true
FROM public.customers
WHERE preferred_egg_type_id IS NOT NULL
ON CONFLICT (customer_id, egg_type_id) DO NOTHING;

ALTER TABLE public.customers DROP COLUMN IF EXISTS preferred_egg_type_id;

-- ============================================================
-- Trigger: al marcar un principal, desmarca los demás del cliente
-- (mantiene el índice único satisfecho sin trabajo del cliente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cep_enforce_single_primary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.customer_egg_preferences
      SET is_primary = false
      WHERE customer_id = NEW.customer_id
        AND id <> NEW.id
        AND is_primary;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cep_single_primary
  BEFORE INSERT OR UPDATE ON public.customer_egg_preferences
  FOR EACH ROW EXECUTE FUNCTION public.cep_enforce_single_primary();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.customer_egg_preferences ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "cep: admin acceso total"
  ON public.customer_egg_preferences FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: gestiona (lee/crea/edita/borra) las preferencias de los
-- clientes que puede atender (asignados o delegados hoy)
CREATE POLICY "cep: chofer gestiona sus clientes"
  ON public.customer_egg_preferences FOR ALL
  TO authenticated
  USING (
    public.get_my_role() = 'chofer'
    AND public.driver_can_access_customer(customer_id)
  )
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND public.driver_can_access_customer(customer_id)
  );
