-- ============================================================
-- PRODHIN — Row Level Security (RLS)
-- Ejecutar DESPUÉS de 01_schema.sql
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_customers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: función para obtener el rol del usuario autenticado
-- Lee desde app_metadata (no modificable por el usuario)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    'chofer'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_my_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE;

-- ============================================================
-- POLÍTICAS: profiles
-- ============================================================

-- El usuario puede ver su propio perfil
CREATE POLICY "profile: ver propio"
  ON public.profiles FOR SELECT
  USING (id = public.get_my_id());

-- Admin puede ver todos los perfiles
CREATE POLICY "profile: admin ve todos"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Admin puede actualizar cualquier perfil
CREATE POLICY "profile: admin actualiza"
  ON public.profiles FOR UPDATE
  USING (public.get_my_role() = 'admin');

-- El usuario puede actualizar su propio perfil (solo campos permitidos)
CREATE POLICY "profile: usuario actualiza propio"
  ON public.profiles FOR UPDATE
  USING (id = public.get_my_id());

-- Solo el sistema (service_role) puede insertar profiles — lo hace el trigger
-- Los inserts directos desde el cliente están bloqueados

-- ============================================================
-- POLÍTICAS: customers
-- ============================================================

-- Admin: acceso total
CREATE POLICY "customers: admin acceso total"
  ON public.customers FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: solo ve clientes asignados a él y activos
CREATE POLICY "customers: chofer ve asignados"
  ON public.customers FOR SELECT
  USING (
    public.get_my_role() = 'chofer'
    AND is_active = true
    AND id IN (
      SELECT customer_id FROM public.driver_customers
      WHERE driver_id = public.get_my_id()
    )
  );

-- ============================================================
-- POLÍTICAS: driver_customers
-- ============================================================

-- Admin: acceso total
CREATE POLICY "driver_customers: admin acceso total"
  ON public.driver_customers FOR ALL
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Chofer: solo ve sus propias asignaciones
CREATE POLICY "driver_customers: chofer ve propias"
  ON public.driver_customers FOR SELECT
  USING (driver_id = public.get_my_id());
