-- ============================================================
-- PRODHIN — Limpieza de datos de PRUEBA (para grabar el video)
-- ============================================================
-- Idea: hacés todas las pruebas con un CHOFER y CLIENTES marcados con "ZZTEST"
-- en el nombre. Este script borra SOLO eso (y su rastro en la auditoría),
-- sin tocar nada real. Corré TODO el bloque junto en el SQL Editor de Supabase.
--
-- ⚠️ Requisito: que el chofer de prueba se llame empezando con "ZZTEST"
--    (ej: "ZZTEST Chofer") y los clientes también (razón social o nombre
--    empezando con "ZZTEST", ej: "ZZTEST Local 1"). Y si creaste una ruta de
--    prueba, llamala empezando con "ZZTEST" también.
-- ============================================================

DO $$
DECLARE
  v_driver uuid;
  v_cust   uuid[];
BEGIN
  SELECT id INTO v_driver FROM public.profiles
    WHERE full_name ILIKE 'ZZTEST%' AND role = 'chofer' LIMIT 1;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cust FROM public.customers
    WHERE business_name ILIKE 'ZZTEST%' OR first_name ILIKE 'ZZTEST%' OR last_name ILIKE 'ZZTEST%';

  -- 1) Auditoría: borrar las entradas de las filas de prueba (por row_id) y
  --    todas las acciones hechas por el chofer de prueba (por actor).
  IF v_driver IS NOT NULL THEN
    DELETE FROM public.audit_log WHERE actor_id = v_driver;
  END IF;
  DELETE FROM public.audit_log WHERE row_id IN (
    SELECT id::text FROM public.deliveries WHERE driver_id = v_driver OR customer_id = ANY(v_cust)
    UNION SELECT di.id::text FROM public.delivery_items di JOIN public.deliveries d ON d.id = di.delivery_id WHERE d.driver_id = v_driver OR d.customer_id = ANY(v_cust)
    UNION SELECT id::text FROM public.box_pickups WHERE driver_id = v_driver OR customer_id = ANY(v_cust)
    UNION SELECT id::text FROM public.maple_returns WHERE driver_id = v_driver
    UNION SELECT id::text FROM public.egg_returns WHERE driver_id = v_driver
    UNION SELECT i.id::text FROM public.egg_return_items i JOIN public.egg_returns r ON r.id = i.return_id WHERE r.driver_id = v_driver
    UNION SELECT id::text FROM public.truck_load_confirmations WHERE driver_id = v_driver
    UNION SELECT id::text FROM public.truck_loads WHERE driver_id = v_driver
    UNION SELECT id::text FROM public.truck_counts WHERE driver_id = v_driver
    UNION SELECT customer_id::text FROM public.customer_schedules WHERE customer_id = ANY(v_cust)
    UNION SELECT id::text FROM public.customers WHERE id = ANY(v_cust)
    UNION SELECT COALESCE(v_driver::text, '')
  );

  -- 2) Operaciones (borrado explícito y ordenado)
  DELETE FROM public.deliveries               WHERE driver_id = v_driver OR customer_id = ANY(v_cust);
  DELETE FROM public.box_pickups              WHERE driver_id = v_driver OR customer_id = ANY(v_cust);
  DELETE FROM public.maple_returns            WHERE driver_id = v_driver;
  DELETE FROM public.egg_returns              WHERE driver_id = v_driver;  -- egg_return_items cae por cascada
  DELETE FROM public.truck_load_confirmations WHERE driver_id = v_driver;
  DELETE FROM public.truck_loads              WHERE driver_id = v_driver;
  DELETE FROM public.truck_counts             WHERE driver_id = v_driver;
  DELETE FROM public.customer_schedules       WHERE customer_id = ANY(v_cust);
  DELETE FROM public.customer_egg_preferences WHERE customer_id = ANY(v_cust);
  DELETE FROM public.route_stops              WHERE customer_id = ANY(v_cust);
  DELETE FROM public.driver_customers         WHERE driver_id = v_driver OR customer_id = ANY(v_cust);

  -- 3) Rutas de prueba (si creaste una llamada ZZTEST...)
  DELETE FROM public.routes WHERE name ILIKE 'ZZTEST%';

  -- 4) Clientes y chofer de prueba
  DELETE FROM public.customers WHERE id = ANY(v_cust);
  IF v_driver IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = v_driver;
  END IF;

  RAISE NOTICE 'Limpieza OK. Chofer borrado: %. Clientes borrados: %.', v_driver, COALESCE(array_length(v_cust, 1), 0);
END $$;

-- NOTA: el usuario de login del chofer de prueba (Authentication → Users) queda
-- como huérfano inofensivo. Si querés, borralo a mano desde ese panel.
