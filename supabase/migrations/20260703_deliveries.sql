-- ============================================================
-- PRODHIN — Registro de entregas de huevo
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de los scripts
-- base (01_schema, 02_rls) y las migraciones previas.
--
-- Modelo:
--   egg_types       catálogo de categorías (Rojo Mediano, etc.)
--   deliveries      una visita a un cliente (cabecera)
--   delivery_items  líneas: tipo de huevo + cantidad
--
-- Unidad de cantidad: "cajas plásticas" (entero). 1 cajón = 2 cajas
-- plásticas, por lo que cajones = cajas_plasticas / 2 (se deriva en
-- la app, nunca se guardan fracciones).
-- ============================================================

-- ============================================================
-- CATÁLOGO: egg_types
-- ============================================================
CREATE TABLE public.egg_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT CHECK (color IN ('rojo', 'blanco')),  -- NULL para 'H' u otros
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed con las 8 categorías con las que más se trabaja
INSERT INTO public.egg_types (name, color, sort_order) VALUES
  ('Rojo Especial',            'rojo',   10),
  ('Rojo Extra',               'rojo',   20),
  ('Blanco Especial',          'blanco', 30),
  ('Blanco Grande Industrial', 'blanco', 40),
  ('Rojo Grande Industrial',   'rojo',   50),
  ('Blanco Mediano',           'blanco', 60),
  ('Rojo Mediano',             'rojo',   70),
  ('H',                        NULL,     80);

-- ============================================================
-- customers: preferencia de huevo (prellenado en la app)
-- ============================================================
ALTER TABLE public.customers
  ADD COLUMN preferred_egg_type_id UUID REFERENCES public.egg_types(id) ON DELETE SET NULL;

-- ============================================================
-- HELPER: ¿el chofer autenticado puede operar sobre este cliente?
-- Asignación directa O delegación activa hoy.
-- SECURITY DEFINER para poder leer driver_customers/delegations
-- sin depender del RLS del propio llamador.
-- ============================================================
CREATE OR REPLACE FUNCTION public.driver_can_access_customer(cust UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_customers dc
    WHERE dc.customer_id = cust
      AND dc.driver_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.driver_delegations dd
    JOIN public.driver_customers dc ON dc.driver_id = dd.from_driver_id
    WHERE dd.to_driver_id = auth.uid()
      AND dd.is_active = true
      AND dd.start_date <= current_date
      AND dd.end_date   >= current_date
      AND dc.customer_id = cust
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- TABLA: deliveries (cabecera de la visita/entrega)
-- El id lo genera el cliente (app) para que los reintentos
-- offline sean idempotentes (mismo id => no se duplica).
-- ============================================================
CREATE TABLE public.deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES public.profiles(id),
  status        TEXT NOT NULL DEFAULT 'entregado'
                  CHECK (status IN ('entregado', 'cliente_ausente', 'rechazado', 'sin_stock')),
  notes         TEXT,
  delivered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_customer   ON public.deliveries(customer_id);
CREATE INDEX idx_deliveries_driver     ON public.deliveries(driver_id);
CREATE INDEX idx_deliveries_delivered  ON public.deliveries(delivered_at);

CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- TABLA: delivery_items (líneas)
-- cajas_plasticas: entero >= 0 (0 = visitó pero no compró de ese tipo)
-- ============================================================
CREATE TABLE public.delivery_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id     UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  egg_type_id     UUID NOT NULL REFERENCES public.egg_types(id),
  cajas_plasticas INTEGER NOT NULL DEFAULT 0 CHECK (cajas_plasticas >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_egg_type ON public.delivery_items(egg_type_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.egg_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- ── egg_types ──────────────────────────────────────────────
-- Cualquier usuario autenticado puede leer el catálogo (el chofer
-- lo necesita para elegir). Solo el admin puede modificarlo.
CREATE POLICY "egg_types: lectura autenticados"
  ON public.egg_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "egg_types: admin escribe"
  ON public.egg_types FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- ── deliveries ─────────────────────────────────────────────
-- Admin: acceso total
CREATE POLICY "deliveries: admin acceso total"
  ON public.deliveries FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: ve solo sus propias entregas
CREATE POLICY "deliveries: chofer ve propias"
  ON public.deliveries FOR SELECT
  TO authenticated
  USING (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
  );

-- Chofer: inserta solo como sí mismo y solo para clientes que puede atender
CREATE POLICY "deliveries: chofer inserta propias"
  ON public.deliveries FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
    AND public.driver_can_access_customer(customer_id)
  );

-- Chofer: corrige sus propias entregas (no puede reasignar a otro chofer
-- ni moverla a un cliente que no atiende)
CREATE POLICY "deliveries: chofer actualiza propias"
  ON public.deliveries FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
  )
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
    AND public.driver_can_access_customer(customer_id)
  );

-- Chofer: puede borrar sus propias entregas (corrección)
CREATE POLICY "deliveries: chofer borra propias"
  ON public.deliveries FOR DELETE
  TO authenticated
  USING (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
  );

-- ── delivery_items ─────────────────────────────────────────
-- Admin: acceso total
CREATE POLICY "delivery_items: admin acceso total"
  ON public.delivery_items FOR ALL
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: opera líneas solo de entregas que le pertenecen
CREATE POLICY "delivery_items: chofer ve propias"
  ON public.delivery_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.driver_id = public.get_my_id()
    )
  );

CREATE POLICY "delivery_items: chofer inserta propias"
  ON public.delivery_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.driver_id = public.get_my_id()
    )
  );

CREATE POLICY "delivery_items: chofer actualiza propias"
  ON public.delivery_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.driver_id = public.get_my_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.driver_id = public.get_my_id()
    )
  );

CREATE POLICY "delivery_items: chofer borra propias"
  ON public.delivery_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.driver_id = public.get_my_id()
    )
  );
