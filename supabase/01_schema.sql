-- ============================================================
-- PRODHIN — Esquema de base de datos
-- Ejecutar en orden en el SQL Editor de Supabase
-- ============================================================

-- Tipos personalizados
CREATE TYPE user_role AS ENUM ('admin', 'chofer');
CREATE TYPE customer_type AS ENUM ('persona_fisica', 'empresa');

-- ============================================================
-- TABLA: profiles
-- Extiende auth.users de Supabase con datos del negocio
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        user_role NOT NULL DEFAULT 'chofer',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLA: customers
-- ============================================================
CREATE TABLE public.customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type   customer_type NOT NULL,

  -- Persona física
  first_name      TEXT,
  last_name       TEXT,

  -- Empresa / Local
  business_name   TEXT,
  tax_id          TEXT,
  contact_name    TEXT,

  -- Datos comunes
  phone           TEXT NOT NULL,
  email           TEXT,
  address         TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,

  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Validación: persona_fisica requiere nombre, empresa requiere business_name
  CONSTRAINT chk_persona_fisica CHECK (
    customer_type != 'persona_fisica' OR (first_name IS NOT NULL AND last_name IS NOT NULL)
  ),
  CONSTRAINT chk_empresa CHECK (
    customer_type != 'empresa' OR business_name IS NOT NULL
  )
);

-- ============================================================
-- TABLA: driver_customers
-- Asignación de clientes a choferes (por Admin)
-- ============================================================
CREATE TABLE public.driver_customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(driver_id, customer_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_customers_lat_lng ON public.customers(lat, lng);
CREATE INDEX idx_customers_is_active ON public.customers(is_active);
CREATE INDEX idx_driver_customers_driver ON public.driver_customers(driver_id);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNCIÓN: crear profile automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Sin nombre'),
    COALESCE((NEW.raw_app_meta_data->>'role')::user_role, 'chofer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
