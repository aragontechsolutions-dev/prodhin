-- ============================================================
-- PRODHIN — Número de cliente + Autoservicio de datos (link de un solo uso)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Incluye:
--   1. Columna customer_number (número que asigna administración), único.
--   2. Tabla customer_intake_tokens: links de un solo uso para que el
--      propio cliente complete/corrija sus datos (se envía por WhatsApp).
--   3. Funciones RPC (SECURITY DEFINER) para que un visitante SIN sesión
--      pueda leer y guardar sus datos usando el token, sin exponer la tabla.
--
-- No rompe datos existentes: customer_number es NULL en los clientes ya
-- creados; el RUT existente no se modifica ni se re-valida.
-- ============================================================

-- ── 1. Número de cliente ────────────────────────────────────
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_number integer;

-- Único entre clientes (cuando existe). Los clientes viejos quedan en NULL
-- hasta que administración les asigne un número.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_customer_number
  ON public.customers (customer_number)
  WHERE customer_number IS NOT NULL;

-- ── 2. Tokens de autoservicio ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_intake_tokens (
  token       text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES public.profiles(id) DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  used_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_intake_tokens_customer
  ON public.customer_intake_tokens (customer_id);

ALTER TABLE public.customer_intake_tokens ENABLE ROW LEVEL SECURITY;

-- Solo el admin gestiona los tokens desde la web (con sesión).
DROP POLICY IF EXISTS "intake_tokens: admin acceso total" ON public.customer_intake_tokens;
CREATE POLICY "intake_tokens: admin acceso total"
  ON public.customer_intake_tokens
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- ── 3. RPC: leer datos del cliente para prellenar (visitante sin sesión) ──
-- Devuelve el estado del token y, si es válido, los datos actuales del
-- cliente para prellenar el formulario. Nunca expone la tabla de tokens.
CREATE OR REPLACE FUNCTION public.intake_get(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.customer_intake_tokens%ROWTYPE;
  v_cust  record;
BEGIN
  SELECT * INTO v_token FROM public.customer_intake_tokens WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  IF v_token.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'used');
  END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT id, customer_type, first_name, last_name, business_name, tax_id,
         business_type, contact_name, phone, email, address, lat, lng,
         notes, customer_number
    INTO v_cust
    FROM public.customers
   WHERE id = v_token.customer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'customer', to_jsonb(v_cust));
END;
$$;

-- ── 3b. RPC: guardar los datos que ingresó el cliente ───────
-- Valida el token, actualiza SOLO los campos permitidos del cliente y
-- marca el token como usado (un solo uso). Valida RUT (12 dígitos y único)
-- si el cliente lo ingresa.
CREATE OR REPLACE FUNCTION public.intake_submit(p_token text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token public.customer_intake_tokens%ROWTYPE;
  v_type  text;
  v_rut   text;
BEGIN
  SELECT * INTO v_token FROM public.customer_intake_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  IF v_token.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'used');
  END IF;
  IF v_token.expires_at IS NOT NULL AND v_token.expires_at < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT customer_type INTO v_type FROM public.customers WHERE id = v_token.customer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- RUT: si viene, exactamente 12 dígitos y único entre clientes
  v_rut := nullif(btrim(coalesce(p_data->>'tax_id', '')), '');
  IF v_rut IS NOT NULL THEN
    IF v_rut !~ '^[0-9]{12}$' THEN
      RETURN jsonb_build_object('status', 'error', 'message', 'El RUT debe tener 12 dígitos.');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.customers
       WHERE btrim(tax_id) = v_rut AND id <> v_token.customer_id
    ) THEN
      RETURN jsonb_build_object('status', 'error', 'message', 'Ese RUT ya está registrado en otro cliente.');
    END IF;
  END IF;

  UPDATE public.customers SET
    first_name    = CASE WHEN v_type = 'persona_fisica' THEN nullif(btrim(coalesce(p_data->>'first_name','')), '') ELSE first_name END,
    last_name     = CASE WHEN v_type = 'persona_fisica' THEN nullif(btrim(coalesce(p_data->>'last_name','')), '') ELSE last_name END,
    business_name = CASE WHEN v_type = 'empresa' THEN nullif(btrim(coalesce(p_data->>'business_name','')), '') ELSE business_name END,
    tax_id        = v_rut,
    business_type = nullif(btrim(coalesce(p_data->>'business_type','')), ''),
    contact_name  = nullif(btrim(coalesce(p_data->>'contact_name','')), ''),
    phone         = coalesce(nullif(btrim(coalesce(p_data->>'phone','')), ''), phone),
    email         = nullif(btrim(coalesce(p_data->>'email','')), ''),
    address       = coalesce(nullif(btrim(coalesce(p_data->>'address','')), ''), address),
    lat           = coalesce((p_data->>'lat')::double precision, lat),
    lng           = coalesce((p_data->>'lng')::double precision, lng),
    notes         = nullif(btrim(coalesce(p_data->>'notes','')), ''),
    updated_at    = now()
  WHERE id = v_token.customer_id;

  UPDATE public.customer_intake_tokens SET used_at = now() WHERE token = p_token;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- El visitante sin sesión (anon) solo puede ejecutar estas dos funciones.
GRANT EXECUTE ON FUNCTION public.intake_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intake_submit(text, jsonb) TO anon, authenticated;
