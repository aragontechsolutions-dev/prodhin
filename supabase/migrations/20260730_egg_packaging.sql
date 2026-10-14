-- ============================================================
-- PRODHIN — Datos de envasado por categoría (para control fino de devoluciones)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Cada categoría envasada puede tener:
--   * eggs_per_package  = huevos por paquete (el "x N")
--   * packages_per_box  = paquetes por caja plástica
-- Sirve para saber, por ejemplo, que 4 paquetes de "Doña Clara x 6"
-- (caja de 24 paquetes) equivalen a 24 huevos. Se editan en Categorías.
-- Nullable: las categorías sueltas (no envasadas) quedan en NULL.
-- ============================================================

ALTER TABLE public.egg_types
  ADD COLUMN IF NOT EXISTS eggs_per_package integer,
  ADD COLUMN IF NOT EXISTS packages_per_box integer;

-- Semilla (best-effort por nombre normalizado sin espacios). Si algún nombre
-- no coincide, ajustalo a mano en el módulo Categorías.
UPDATE public.egg_types SET eggs_per_package = 6,  packages_per_box = 24 WHERE lower(replace(name, ' ', '')) = 'doñaclarax6';
UPDATE public.egg_types SET eggs_per_package = 12, packages_per_box = 12 WHERE lower(replace(name, ' ', '')) = 'doñaclarax12';
UPDATE public.egg_types SET eggs_per_package = 15, packages_per_box = 8  WHERE lower(replace(name, ' ', '')) = 'doñaclarax15';
UPDATE public.egg_types SET eggs_per_package = 20, packages_per_box = 4  WHERE lower(replace(name, ' ', '')) = 'doñaclarax20';
UPDATE public.egg_types SET eggs_per_package = 6,  packages_per_box = 24 WHERE lower(replace(name, ' ', '')) = 'aldeax6';
UPDATE public.egg_types SET eggs_per_package = 15, packages_per_box = 8  WHERE lower(replace(name, ' ', '')) = 'aldeax15';
UPDATE public.egg_types SET eggs_per_package = 25, packages_per_box = 4  WHERE lower(replace(name, ' ', '')) = 'aldeax25';
UPDATE public.egg_types SET eggs_per_package = 12, packages_per_box = 12 WHERE lower(replace(name, ' ', '')) = 'jumbox12';
UPDATE public.egg_types SET eggs_per_package = 6,  packages_per_box = 24 WHERE lower(replace(name, ' ', '')) = 'yemita';
