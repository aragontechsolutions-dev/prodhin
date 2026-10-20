-- ============================================================
-- PRODHIN — Reset de datos: deja solo el usuario admin
-- Ejecutar en el SQL Editor de Supabase (como service_role)
-- ============================================================

DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Obtener el id del admin por email
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'hmarquezaragon@gmail.com';

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el usuario hmarquezaragon@gmail.com';
  END IF;

  -- 1. Borrar stops de rutas
  DELETE FROM public.route_stops;

  -- 2. Borrar rutas
  DELETE FROM public.routes;

  -- 3. Borrar delegaciones
  DELETE FROM public.driver_delegations;

  -- 4. Borrar asignaciones chofer-cliente
  DELETE FROM public.driver_customers;

  -- 5. Borrar clientes
  DELETE FROM public.customers;

  -- 6. Borrar perfiles que no sean el admin
  DELETE FROM public.profiles
  WHERE id <> admin_id;

  -- 7. Borrar usuarios de auth que no sean el admin
  --    (esto también elimina el perfil si hay cascade, pero ya lo borramos arriba)
  DELETE FROM auth.users
  WHERE id <> admin_id;

  RAISE NOTICE 'Reset completado. Admin conservado: %', admin_id;
END;
$$;
