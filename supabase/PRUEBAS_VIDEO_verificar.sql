-- ============================================================
-- PRODHIN — Verificación de datos de PRUEBA (correr ANTES de borrar)
-- ============================================================
-- Solo LEE (no borra nada). Muestra qué encontró el marcador "ZZTEST" y
-- cuántas filas se borrarían en cada tabla. Si los números tienen sentido,
-- recién ahí corré PRUEBAS_VIDEO_cleanup.sql.
-- Corré TODO el bloque junto en el SQL Editor de Supabase.
-- ============================================================

WITH d AS (
  SELECT id FROM public.profiles WHERE full_name ILIKE 'ZZTEST%' AND role = 'chofer'
),
c AS (
  SELECT id FROM public.customers
  WHERE business_name ILIKE 'ZZTEST%' OR first_name ILIKE 'ZZTEST%' OR last_name ILIKE 'ZZTEST%'
)
SELECT 'chofer de prueba'        AS que, (SELECT count(*) FROM d) AS cantidad
UNION ALL SELECT 'clientes de prueba',       (SELECT count(*) FROM c)
UNION ALL SELECT 'rutas de prueba (ZZTEST)',  (SELECT count(*) FROM public.routes WHERE name ILIKE 'ZZTEST%')
UNION ALL SELECT 'entregas',                  (SELECT count(*) FROM public.deliveries WHERE driver_id IN (SELECT id FROM d) OR customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'recogidas de cajas',        (SELECT count(*) FROM public.box_pickups WHERE driver_id IN (SELECT id FROM d) OR customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'entregas de maples',        (SELECT count(*) FROM public.maple_returns WHERE driver_id IN (SELECT id FROM d))
UNION ALL SELECT 'rotos/devoluciones',        (SELECT count(*) FROM public.egg_returns WHERE driver_id IN (SELECT id FROM d))
UNION ALL SELECT 'confirmaciones de carga',   (SELECT count(*) FROM public.truck_load_confirmations WHERE driver_id IN (SELECT id FROM d))
UNION ALL SELECT 'cargas de camión',          (SELECT count(*) FROM public.truck_loads WHERE driver_id IN (SELECT id FROM d))
UNION ALL SELECT 'recuentos de camión',       (SELECT count(*) FROM public.truck_counts WHERE driver_id IN (SELECT id FROM d))
UNION ALL SELECT 'horarios de cierre',        (SELECT count(*) FROM public.customer_schedules WHERE customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'preferencias de huevo',     (SELECT count(*) FROM public.customer_egg_preferences WHERE customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'paradas de ruta',           (SELECT count(*) FROM public.route_stops WHERE customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'asignaciones',              (SELECT count(*) FROM public.driver_customers WHERE driver_id IN (SELECT id FROM d) OR customer_id IN (SELECT id FROM c))
UNION ALL SELECT 'entradas de auditoría (chofer)', (SELECT count(*) FROM public.audit_log WHERE actor_id IN (SELECT id FROM d))
ORDER BY 1;

-- Detalle: qué chofer y qué clientes matchearon (revisá que sean los de prueba)
SELECT 'CHOFER' AS tipo, id::text, full_name AS nombre FROM public.profiles WHERE full_name ILIKE 'ZZTEST%' AND role = 'chofer'
UNION ALL
SELECT 'CLIENTE', id::text, COALESCE(business_name, (first_name || ' ' || last_name))
  FROM public.customers WHERE business_name ILIKE 'ZZTEST%' OR first_name ILIKE 'ZZTEST%' OR last_name ILIKE 'ZZTEST%';
