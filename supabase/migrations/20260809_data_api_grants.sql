-- ============================================================
-- PRODHIN — GRANTs explícitos para la Data API (cambio Supabase 30/10)
-- Ejecutar en el SQL Editor de Supabase.
--
-- Desde el 30/10 Supabase deja de dar acceso automático a la Data API a las
-- tablas NUEVAS del esquema public. Esto otorga el permiso a nivel tabla a las
-- tablas/vistas creadas en este ciclo. La RLS sigue protegiendo las filas:
-- esto es solo el permiso de tabla (lo que antes Supabase ponía solo).
-- Es idempotente: se puede correr siempre, sin importar si ya tenían acceso.
-- ============================================================

-- Tablas operadas por usuarios con sesión (choferes/admin). La RLS decide qué
-- filas ve cada uno; acá solo habilitamos el acceso a la API.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.competitors,
  public.prospects,
  public.prospect_offers,
  public.customer_payments,
  public.stock_discrepancies,
  public.stock_discrepancy_items
  TO authenticated;

-- Vistas de solo lectura (saldo de cajas y de deuda).
GRANT SELECT ON public.customer_box_balance   TO authenticated;
GRANT SELECT ON public.customer_debt_balance   TO authenticated;

-- El backend (service_role) mantiene acceso total.
GRANT ALL ON
  public.competitors,
  public.prospects,
  public.prospect_offers,
  public.customer_payments,
  public.stock_discrepancies,
  public.stock_discrepancy_items
  TO service_role;
