-- ============================================================
-- PRODHIN — Stock del camión (por chofer)
-- Ejecutar DESPUÉS de las migraciones de entregas.
--
-- Stock actual por tipo = (último recuento) + (cargas posteriores)
--                          − (entregas con venta posteriores)
--
-- El sobrante pasa solo de un día a otro (no hay reseteo). Las entregas
-- ya registradas (delivery_items) alimentan la resta.
-- ============================================================

-- Cargas: el chofer sube producto al camión (suma). id de cliente para
-- idempotencia offline.
CREATE TABLE public.truck_loads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  egg_type_id     UUID NOT NULL REFERENCES public.egg_types(id) ON DELETE CASCADE,
  cajas_plasticas INTEGER NOT NULL CHECK (cajas_plasticas > 0),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_truck_loads_driver ON public.truck_loads(driver_id, created_at);

-- Recuentos físicos: fija el valor absoluto de un tipo en un momento.
CREATE TABLE public.truck_counts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  egg_type_id     UUID NOT NULL REFERENCES public.egg_types(id) ON DELETE CASCADE,
  cajas_plasticas INTEGER NOT NULL CHECK (cajas_plasticas >= 0),
  counted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_truck_counts_driver ON public.truck_counts(driver_id, egg_type_id, counted_at);

-- ============================================================
-- Vista: stock actual por chofer y tipo
-- security_invoker → respeta la RLS de las tablas base
-- ============================================================
CREATE OR REPLACE VIEW public.truck_stock_current
WITH (security_invoker = true) AS
WITH last_count AS (
  SELECT DISTINCT ON (driver_id, egg_type_id)
    driver_id, egg_type_id, cajas_plasticas AS base, counted_at
  FROM public.truck_counts
  ORDER BY driver_id, egg_type_id, counted_at DESC
),
loads_since AS (
  SELECT tl.driver_id, tl.egg_type_id, SUM(tl.cajas_plasticas)::int AS loaded
  FROM public.truck_loads tl
  LEFT JOIN last_count lc
    ON lc.driver_id = tl.driver_id AND lc.egg_type_id = tl.egg_type_id
  WHERE lc.counted_at IS NULL OR tl.created_at > lc.counted_at
  GROUP BY tl.driver_id, tl.egg_type_id
),
deliv_since AS (
  SELECT d.driver_id, di.egg_type_id, SUM(di.cajas_plasticas)::int AS delivered
  FROM public.deliveries d
  JOIN public.delivery_items di ON di.delivery_id = d.id
  LEFT JOIN last_count lc
    ON lc.driver_id = d.driver_id AND lc.egg_type_id = di.egg_type_id
  WHERE d.status = 'entregado'
    AND (lc.counted_at IS NULL OR d.delivered_at > lc.counted_at)
  GROUP BY d.driver_id, di.egg_type_id
),
keys AS (
  SELECT driver_id, egg_type_id FROM last_count
  UNION SELECT driver_id, egg_type_id FROM loads_since
  UNION SELECT driver_id, egg_type_id FROM deliv_since
)
SELECT
  k.driver_id,
  k.egg_type_id,
  GREATEST(0,
    COALESCE(lc.base, 0) + COALESCE(ls.loaded, 0) - COALESCE(ds.delivered, 0)
  ) AS cajas_plasticas
FROM keys k
LEFT JOIN last_count  lc ON lc.driver_id = k.driver_id AND lc.egg_type_id = k.egg_type_id
LEFT JOIN loads_since ls ON ls.driver_id = k.driver_id AND ls.egg_type_id = k.egg_type_id
LEFT JOIN deliv_since ds ON ds.driver_id = k.driver_id AND ds.egg_type_id = k.egg_type_id;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.truck_loads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_counts ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
CREATE POLICY "truck_loads: admin acceso total"
  ON public.truck_loads FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY "truck_counts: admin acceso total"
  ON public.truck_counts FOR ALL TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: gestiona (lee/crea) las cargas y recuentos de SU camión
CREATE POLICY "truck_loads: chofer gestiona propias"
  ON public.truck_loads FOR ALL TO authenticated
  USING (driver_id = public.get_my_id())
  WITH CHECK (driver_id = public.get_my_id());

CREATE POLICY "truck_counts: chofer gestiona propios"
  ON public.truck_counts FOR ALL TO authenticated
  USING (driver_id = public.get_my_id())
  WITH CHECK (driver_id = public.get_my_id());
