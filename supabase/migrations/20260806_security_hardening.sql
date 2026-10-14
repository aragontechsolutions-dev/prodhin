-- ============================================================
-- PRODHIN — Hardening de seguridad e integridad
-- Ejecutar en el SQL Editor de Supabase (después de 20260805).
--
-- 1) Fija search_path en las funciones SECURITY DEFINER (cierra el hallazgo
--    "function_search_path_mutable": una función SECURITY DEFINER con
--    search_path mutable puede ser secuestrada por objetos de otro esquema).
-- 2) Restricciones de integridad de dinero: no se admiten montos negativos.
-- 3) Endurece la política de cobros: el chofer solo registra cobros a su
--    propio nombre (no puede suplantar a otro chofer).
-- ============================================================

-- ── 1. search_path en funciones SECURITY DEFINER ────────────
-- Todas referencian sus objetos con esquema calificado, así que es seguro
-- vaciar el search_path (salvo el cast a enum, que se califica).

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'chofer');
$$;

CREATE OR REPLACE FUNCTION public.get_my_id()
RETURNS UUID
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.driver_can_access_customer(cust UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driver_customers dc
    WHERE dc.customer_id = cust AND dc.driver_id = auth.uid()
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
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row_id text;
  v_reason text;
  v_changed jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row_id := to_jsonb(OLD) ->> 'id';
    v_reason := to_jsonb(OLD) ->> 'edit_reason';
    v_changed := jsonb_build_object('old', to_jsonb(OLD));
  ELSIF TG_OP = 'INSERT' THEN
    v_row_id := to_jsonb(NEW) ->> 'id';
    v_reason := to_jsonb(NEW) ->> 'edit_reason';
    v_changed := jsonb_build_object('new', to_jsonb(NEW));
  ELSE
    v_row_id := to_jsonb(NEW) ->> 'id';
    v_reason := to_jsonb(NEW) ->> 'edit_reason';
    v_changed := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_role, action, table_name, row_id, reason, changed)
  VALUES (
    auth.uid(),
    auth.jwt() -> 'app_metadata' ->> 'role',
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_reason,
    v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    COALESCE((NEW.raw_app_meta_data->>'role')::public.user_role, 'chofer')
  );
  RETURN NEW;
END;
$$;

-- ── 2. Integridad de dinero: nada negativo ──────────────────
ALTER TABLE public.deliveries      DROP CONSTRAINT IF EXISTS deliveries_total_amount_nonneg;
ALTER TABLE public.deliveries      ADD  CONSTRAINT deliveries_total_amount_nonneg CHECK (total_amount >= 0);

ALTER TABLE public.delivery_items  DROP CONSTRAINT IF EXISTS delivery_items_unit_price_nonneg;
ALTER TABLE public.delivery_items  ADD  CONSTRAINT delivery_items_unit_price_nonneg CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER TABLE public.delivery_items  DROP CONSTRAINT IF EXISTS delivery_items_line_total_nonneg;
ALTER TABLE public.delivery_items  ADD  CONSTRAINT delivery_items_line_total_nonneg CHECK (line_total IS NULL OR line_total >= 0);

ALTER TABLE public.egg_types       DROP CONSTRAINT IF EXISTS egg_types_min_price_nonneg;
ALTER TABLE public.egg_types       ADD  CONSTRAINT egg_types_min_price_nonneg CHECK (min_price IS NULL OR min_price >= 0);
ALTER TABLE public.egg_types       DROP CONSTRAINT IF EXISTS egg_types_maples_per_box_pos;
ALTER TABLE public.egg_types       ADD  CONSTRAINT egg_types_maples_per_box_pos CHECK (maples_per_box IS NULL OR maples_per_box > 0);

-- ── 3. Cobros: el chofer solo cobra a su propio nombre ──────
DROP POLICY IF EXISTS "customer_payments: chofer cobra accesibles" ON public.customer_payments;
CREATE POLICY "customer_payments: chofer cobra accesibles" ON public.customer_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_my_role() = 'chofer'
    AND driver_id = public.get_my_id()
    AND public.driver_can_access_customer(customer_id)
  );
