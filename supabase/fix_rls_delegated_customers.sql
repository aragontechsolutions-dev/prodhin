-- ============================================================
-- PRODHIN — Fix RLS para clientes delegados
-- Permite que un chofer vea los clientes de choferes que lo
-- tienen como cobertura en una delegación activa hoy.
--
-- Ejecutar en el SQL Editor de Supabase (rol: postgres o service_role)
-- ============================================================

-- 1. Ver las políticas actuales (para referencia)
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE tablename = 'customers' AND schemaname = 'public';

-- 2. Reemplazar la política SELECT de choferes en customers
--    para incluir también clientes de choferes delegados

DROP POLICY IF EXISTS "Drivers can view assigned customers" ON public.customers;
DROP POLICY IF EXISTS "drivers_select_customers" ON public.customers;
DROP POLICY IF EXISTS "chofer_select_customers" ON public.customers;

-- Política unificada: el chofer puede ver clientes que:
--   a) le están asignados directamente en driver_customers, O
--   b) pertenecen a un chofer que lo tiene como cobertura en
--      una delegación activa hoy (driver_delegations)

CREATE POLICY "drivers_select_customers" ON public.customers
  FOR SELECT
  USING (
    -- Admins ven todo
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR
    -- Clientes asignados directamente al chofer
    EXISTS (
      SELECT 1 FROM public.driver_customers dc
      WHERE dc.customer_id = customers.id
        AND dc.driver_id = auth.uid()
    )
    OR
    -- Clientes de choferes cubiertos por este chofer (delegación activa hoy)
    EXISTS (
      SELECT 1
      FROM public.driver_delegations dd
      JOIN public.driver_customers dc ON dc.driver_id = dd.from_driver_id
      WHERE dd.to_driver_id = auth.uid()
        AND dd.is_active = true
        AND dd.start_date <= current_date
        AND dd.end_date   >= current_date
        AND dc.customer_id = customers.id
    )
  );
