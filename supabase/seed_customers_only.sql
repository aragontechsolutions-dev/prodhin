-- ============================================================
-- PRODHIN — Seed de clientes de prueba (500 clientes)
-- Los choferes, asignaciones y rutas se gestionan desde el CORE web
--
-- Ejecutar en el SQL Editor de Supabase (rol: postgres o service_role)
-- ============================================================

DO $$
DECLARE
  admin_id     uuid;
  new_cid      uuid;
  i            int;

  first_names text[] := ARRAY[
    'Juan','María','Carlos','Ana','Pedro','Laura','Miguel','Sofía',
    'Diego','Elena','Roberto','Patricia','Alejandro','Valeria','Sergio',
    'Lucía','Pablo','Andrea','Matías','Fernanda','Hugo','Gabriela',
    'Nicolás','Beatriz','Ramón','Cristina','Eduardo','Silvia','Jorge','Claudia'
  ];
  last_names text[] := ARRAY[
    'Rodríguez','Fernández','García','López','Martínez','Pérez','Silva',
    'Núñez','Torres','Suárez','Ramírez','Herrera','Castro','Ruiz','Morales',
    'Jiménez','Vargas','Medina','Rojas','Flores','Acosta','Benítez','Cabrera',
    'Delgado','Espinoza','Fuentes','Gómez','Ibáñez','Juárez','Molina'
  ];

  biz_prefixes text[] := ARRAY[
    'Almacén','Supermercado','Panadería','Carnicería','Verdulería',
    'Minimercado','Despensa','Rotisería','Pizzería','Bar','Kiosco',
    'Fiambrería','Lácteos','Distribuidora','Comercio'
  ];
  biz_suffixes text[] := ARRAY[
    'El Sol','La Esquina','Don Pedro','La Victoria','El Rincón',
    'Los Amigos','La Esperanza','El Central','Don Juan','La Unión',
    'San Martín','El Progreso','Los Pinos','La Paloma','El Faro'
  ];

  streets text[] := ARRAY[
    'Av. Artigas','Calle General Flores','Bulevar Batlle','Av. Victorino Pereira',
    'Calle Lavalleja','Av. General Líber Seregni','Calle 25 de Agosto',
    'Av. Roosvelt','Calle Treinta y Tres','Bulevar José Batlle y Ordóñez',
    'Av. de los Pioneros','Calle Caballeros','Av. Circunvalación',
    'Calle Ituzaingó','Av. del Lago'
  ];

  notes_pool text[] := ARRAY[
    'Dejar en portería','Llamar antes de llegar','Entrada por el costado',
    'Retirar pago al entregar','Solo por las mañanas','Timbre no funciona',
    NULL,NULL,NULL,NULL,NULL,NULL
  ];

  ctype text; fname text; lname text; bname text;
  taxid text; phone text; addr text; note text;
  lat double precision; lng double precision;

  base_lat constant double precision := -34.48;
  base_lng constant double precision := -54.33;

BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'hmarquezaragon@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin hmarquezaragon@gmail.com no encontrado.';
  END IF;

  FOR i IN 1..500 LOOP
    IF (i % 5) < 3 THEN
      ctype := 'persona_fisica';
      fname := first_names[1 + ((i * 3) % array_length(first_names, 1))];
      lname := last_names [1 + ((i * 7) % array_length(last_names,  1))];
      bname := NULL;
      taxid := NULL;
    ELSE
      ctype := 'empresa';
      fname := NULL;
      lname := NULL;
      bname := biz_prefixes[1 + ((i * 2) % array_length(biz_prefixes, 1))]
               || ' ' || biz_suffixes[1 + ((i * 5) % array_length(biz_suffixes, 1))];
      taxid := (210000000 + i * 1237)::text;
    END IF;

    phone := '09' || (8 + (i % 2))::text || lpad((1000000 + i * 9)::text, 7, '0');
    addr  := streets[1 + (i % array_length(streets, 1))]
             || ' ' || (100 + (i * 17 % 900))::text;
    lat   := base_lat + (((i * 31) % 800) - 400) / 10000.0;
    lng   := base_lng + (((i * 47) % 800) - 400) / 10000.0;
    note  := notes_pool[1 + (i % array_length(notes_pool, 1))];

    INSERT INTO public.customers (
      customer_type, first_name, last_name, business_name, tax_id,
      phone, address, lat, lng, notes, is_active, created_by
    ) VALUES (
      ctype::customer_type, fname, lname, bname, taxid,
      phone, addr, lat, lng, note, true, admin_id
    );
  END LOOP;

  RAISE NOTICE '✅ 500 clientes creados (300 personas físicas, 200 empresas)';
  RAISE NOTICE '   Próximos pasos en el CORE web:';
  RAISE NOTICE '   1. Crear choferes en Usuarios';
  RAISE NOTICE '   2. Asignar clientes en Asignaciones';
  RAISE NOTICE '   3. Configurar rutas en Rutas';
END;
$$;
