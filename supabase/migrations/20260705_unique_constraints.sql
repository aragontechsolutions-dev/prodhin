-- ============================================================
-- PRODHIN — Unicidad de RUT (clientes) y teléfono (usuarios)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Reglas:
--  * customers.tax_id (RUT) → único entre clientes (cuando existe).
--  * profiles.phone (usuarios) → único entre usuarios (cuando existe).
--  * customers.phone → NO se restringe: un mismo dueño puede tener
--    varias empresas/locales con el mismo teléfono. (Se avisa en la
--    app, pero no se bloquea.)
--
-- Antes de crear los índices, si ya hubiera duplicados la creación
-- fallará. Para detectarlos:
--
--   SELECT btrim(tax_id) AS rut, count(*)
--   FROM public.customers
--   WHERE tax_id IS NOT NULL AND btrim(tax_id) <> ''
--   GROUP BY 1 HAVING count(*) > 1;
--
--   SELECT btrim(phone) AS tel, count(*)
--   FROM public.profiles
--   WHERE phone IS NOT NULL AND btrim(phone) <> ''
--   GROUP BY 1 HAVING count(*) > 1;
-- ============================================================

-- RUT único entre clientes (normalizado: sin espacios alrededor)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tax_id
  ON public.customers (btrim(tax_id))
  WHERE tax_id IS NOT NULL AND btrim(tax_id) <> '';

-- Teléfono único entre usuarios (profiles)
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_phone
  ON public.profiles (btrim(phone))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';
