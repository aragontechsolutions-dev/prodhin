-- ============================================================
-- PRODHIN — Seed de datos de prueba
-- Escenario: 10 choferes, 500 clientes, 50 clientes/chofer,
--            1 ruta/chofer con paradas por día, 2 delegaciones activas
--
-- Credenciales de choferes:
--   Email:      chofer1@prodhin.com … chofer10@prodhin.com
--   Contraseña: Prodhin2025!
--
-- Ejecutar en el SQL Editor de Supabase (service_role)
-- ============================================================

DO $$
DECLARE
  admin_id     uuid;
  driver_ids   uuid[] := '{}';
  customer_ids uuid[] := '{}';
  driver_id    uuid;
  route_id     uuid;
  new_uid      uuid;
  new_cid      uuid;
  hashed_pw    text;
  i int; j int; dow int; batch_start int;

  -- ── Datos de choferes ──────────────────────────────────────
  driver_names text[] := ARRAY[
    'Carlos Rodríguez','Miguel Fernández','Diego García','Pablo López',
    'Andrés Martínez','Roberto Pérez','Gonzalo Silva','Sergio Núñez',
    'Alejandro Torres','Matías Suárez'
  ];

  -- ── Nombres y apellidos (personas físicas) ─────────────────
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
    'Delgado','Espinoza','Fuentes','Gómez','Herrera','Ibáñez','Juárez'
  ];

  -- ── Datos de empresas ──────────────────────────────────────
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

  -- ── Calles de Rocha / costa este Uruguay ───────────────────
  streets text[] := ARRAY[
    'Av. Artigas','Calle General Flores','Bulevar Batlle','Av. Victorino Pereira',
    'Calle Lavalleja','Av. General Líber Seregni','Calle 25 de Agosto',
    'Av. Roosvelt','Calle Treinta y Tres','Bulevar José Batlle y Ordóñez',
    'Av. de los Pioneros','Calle Caballeros','Av. Circunvalación',
    'Calle Ituzaingó','Av. del Lago'
  ];

  -- ── Notas realistas para clientes ──────────────────────────
  notes_pool text[] := ARRAY[
    'Dejar en portería','Llamar antes de llegar','Entrada por el costado',
    'Retirar pago al entregar','Solo por las mañanas','Timbre no funciona',
    NULL,NULL,NULL,NULL,NULL,NULL  -- mayoría sin nota
  ];

  ctype text; fname text; lname text; bname text;
  taxid text; phone text; addr text;
  lat double precision; lng double precision;
  note text;

  -- Centro del mapa: costa este Uruguay (-34.48, -54.33)
  base_lat constant double precision := -34.48;
  base_lng constant double precision := -54.33;

  -- Distribución de clientes por día (no uniforme, más realista)
  -- 50 clientes / ruta: Lun=12, Mar=8, Mié=12, Jue=8, Vie=10
  day_counts int[] := ARRAY[12, 8, 12, 8, 10];
  day_offset int;

BEGIN
  -- ── Verificar admin ────────────────────────────────────────
  SELECT id INTO admin_id FROM auth.users WHERE email = 'hmarquezaragon@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin hmarquezaragon@gmail.com no encontrado. Ejecutar el reset primero.';
  END IF;

  hashed_pw := crypt('Prodhin2025!', gen_salt('bf'));

  -- ══════════════════════════════════════════════════════════
  -- 1. CHOFERES
  -- ══════════════════════════════════════════════════════════
  FOR i IN 1..10 LOOP
    new_uid := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
      new_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'chofer' || i || '@prodhin.com',
      hashed_pw,
      now(),
      jsonb_build_object('full_name', driver_names[i]),
      jsonb_build_object('role', 'chofer'),
      now(), now(), '', ''
    );

    -- Insertar identity (requerido por GoTrue para autenticación por email)
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      new_uid,
      new_uid::text,
      jsonb_build_object('sub', new_uid::text, 'email', 'chofer' || i || '@prodhin.com'),
      'email',
      now(), now(), now()
    );

    -- El trigger crea el profile; actualizamos teléfono
    UPDATE public.profiles
    SET phone = '099' || lpad((100000 + i * 11111)::text, 6, '0')
    WHERE id = new_uid;

    driver_ids := array_append(driver_ids, new_uid);
  END LOOP;

  RAISE NOTICE '✔ Choferes creados: 10';

  -- ══════════════════════════════════════════════════════════
  -- 2. CLIENTES (500)
  -- ══════════════════════════════════════════════════════════
  FOR i IN 1..500 LOOP
    -- 60% persona física, 40% empresa
    IF (i % 5) < 3 THEN
      ctype := 'persona_fisica';
      fname := first_names[1 + ((i * 3)  % array_length(first_names, 1))];
      lname := last_names [1 + ((i * 7)  % array_length(last_names,  1))];
      bname := NULL;
      taxid := NULL;
    ELSE
      ctype := 'empresa';
      fname := NULL;
      lname := NULL;
      bname := biz_prefixes[1 + ((i * 2) % array_length(biz_prefixes, 1))]
               || ' '
               || biz_suffixes[1 + ((i * 5) % array_length(biz_suffixes, 1))];
      taxid := (210000000 + i * 1237)::text;
    END IF;

    phone := '09' || (8 + (i % 2))::text
             || lpad((1000000 + i * 9)::text, 7, '0');
    addr  := streets[1 + (i % array_length(streets, 1))]
             || ' ' || (100 + (i * 17 % 900))::text;

    -- Coordenadas dispersas ~40 km alrededor del centro
    lat  := base_lat + (((i * 31) % 800) - 400) / 10000.0;
    lng  := base_lng + (((i * 47) % 800) - 400) / 10000.0;

    note := notes_pool[1 + (i % array_length(notes_pool, 1))];

    INSERT INTO public.customers (
      customer_type, first_name, last_name, business_name, tax_id,
      phone, address, lat, lng, notes, is_active, created_by
    ) VALUES (
      ctype::customer_type, fname, lname, bname, taxid,
      phone, addr, lat, lng, note, true, admin_id
    ) RETURNING id INTO new_cid;

    customer_ids := array_append(customer_ids, new_cid);
  END LOOP;

  RAISE NOTICE '✔ Clientes creados: 500';

  -- ══════════════════════════════════════════════════════════
  -- 3. ASIGNACIONES (50 clientes por chofer, sin solapamiento)
  -- ══════════════════════════════════════════════════════════
  FOR i IN 1..10 LOOP
    batch_start := (i - 1) * 50 + 1;
    FOR j IN batch_start..(batch_start + 49) LOOP
      INSERT INTO public.driver_customers (driver_id, customer_id, assigned_by)
      VALUES (driver_ids[i], customer_ids[j], admin_id);
    END LOOP;
  END LOOP;

  RAISE NOTICE '✔ Asignaciones creadas: 500';

  -- ══════════════════════════════════════════════════════════
  -- 4. RUTAS (1 por chofer, paradas distribuidas por día)
  --    Distribución: Lun=12, Mar=8, Mié=12, Jue=8, Vie=10
  -- ══════════════════════════════════════════════════════════
  FOR i IN 1..10 LOOP
    INSERT INTO public.routes (name, driver_id, is_active, created_by)
    VALUES ('Ruta ' || driver_names[i], driver_ids[i], true, admin_id)
    RETURNING id INTO route_id;

    batch_start := (i - 1) * 50;
    day_offset  := 0;

    FOR dow IN 1..5 LOOP
      FOR j IN 1..day_counts[dow] LOOP
        INSERT INTO public.route_stops (route_id, customer_id, day_of_week)
        VALUES (
          route_id,
          customer_ids[batch_start + day_offset + j],
          dow
        );
      END LOOP;
      day_offset := day_offset + day_counts[dow];
    END LOOP;
  END LOOP;

  RAISE NOTICE '✔ Rutas creadas: 10  |  Paradas totales: 500';

  -- ══════════════════════════════════════════════════════════
  -- 5. DELEGACIONES ACTIVAS (para probar cobertura)
  --    Chofer 2 ausente → lo cubre Chofer 1
  --    Chofer 4 ausente → lo cubre Chofer 3
  -- ══════════════════════════════════════════════════════════
  INSERT INTO public.driver_delegations
    (from_driver_id, to_driver_id, start_date, end_date, created_by, is_active)
  VALUES
    (driver_ids[2], driver_ids[1], current_date, current_date + 7, admin_id, true),
    (driver_ids[4], driver_ids[3], current_date, current_date + 5, admin_id, true);

  RAISE NOTICE '✔ Delegaciones activas: 2';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE '✅  Seed completado exitosamente';
  RAISE NOTICE '   Choferes:     chofer1@prodhin.com … chofer10@prodhin.com';
  RAISE NOTICE '   Contraseña:   Prodhin2025!';
  RAISE NOTICE '   Clientes:     500  (300 personas, 200 empresas)';
  RAISE NOTICE '   Asignaciones: 50 clientes/chofer (sin solapamiento)';
  RAISE NOTICE '   Rutas:        10  (Lun×12 Mar×8 Mié×12 Jue×8 Vie×10)';
  RAISE NOTICE '   Delegaciones: Chofer2→1 y Chofer4→3 (activas esta semana)';
  RAISE NOTICE '════════════════════════════════════════';
END;
$$;
