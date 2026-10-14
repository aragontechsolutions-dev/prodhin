-- ============================================================
-- PRODHIN — Clasificar categorías: huevo suelto vs. envasado
-- Ejecutar en el SQL Editor de Supabase (después de 20260730).
--
-- is_packaged = false → huevo SUELTO (se vende en maples de cartón)
-- is_packaged = true  → huevo ENVASADO (tiene huevos/paquete y paquetes/caja;
--                        se controla por vencimiento en devoluciones)
-- ============================================================

ALTER TABLE public.egg_types
  ADD COLUMN IF NOT EXISTS is_packaged boolean NOT NULL DEFAULT false;

-- Las que ya tienen datos de envasado quedan marcadas como envasadas.
UPDATE public.egg_types SET is_packaged = true WHERE eggs_per_package IS NOT NULL;
