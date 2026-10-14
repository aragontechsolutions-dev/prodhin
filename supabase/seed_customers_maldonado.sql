-- ============================================================
-- PRODHIN — Seed 500 clientes en Maldonado / Punta del Este
-- Zonas: Maldonado, Punta del Este, San Carlos, La Barra,
--        Balneario Buenos Aires, José Ignacio
--
-- Ejecutar en el SQL Editor de Supabase (rol: postgres o service_role)
-- ============================================================

DO $$
DECLARE
  admin_id uuid;
  i        int;

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

  notes_pool text[] := ARRAY[
    'Dejar en portería','Llamar antes de llegar','Entrada por el costado',
    'Retirar pago al entregar','Solo por las mañanas','Timbre no funciona',
    NULL,NULL,NULL,NULL,NULL,NULL
  ];

  -- Zonas: (nombre, lat_base, lng_base, radio_lat, radio_lng, calles[])
  -- Cada zona tiene calles representativas
  zone_names   text[]             := ARRAY['Maldonado','Punta del Este','San Carlos','La Barra','Balneario Buenos Aires','José Ignacio'];
  zone_lat     double precision[] := ARRAY[-34.9011,   -34.9633,        -34.7978,    -34.8967,  -34.7833,                -34.8283];
  zone_lng     double precision[] := ARRAY[-54.9595,   -54.9367,        -54.9167,    -54.8433,  -55.0167,                -54.6617];
  zone_rlat    double precision[] := ARRAY[0.025,       0.018,           0.022,        0.015,     0.020,                   0.012];
  zone_rlng    double precision[] := ARRAY[0.030,       0.022,           0.025,        0.018,     0.025,                   0.015];

  streets_maldonado      text[] := ARRAY['Av. Roosevelt','Calle Sarandí','Calle Florida','Av. Aparicio Saravia','Calle Ituzaingó','Calle 25 de Mayo','Av. Batlle y Ordóñez'];
  streets_punta          text[] := ARRAY['Gorlero','Calle 20','Calle 24','Av. Francia','Rambla Artigas','Calle 28','Bulevar Artigas'];
  streets_sancarlos      text[] := ARRAY['Av. Artigas','Calle Lavalleja','Calle General Flores','Calle Rivera','Calle Treinta y Tres','Av. España'];
  streets_labarra        text[] := ARRAY['Ruta 10','Av. del Mar','Calle Los Horneros','Calle Las Gaviotas','Camino Egaña'];
  streets_buenosaires    text[] := ARRAY['Av. Artigas','Calle Principal','Calle del Lago','Av. Costanera','Calle Los Pinos'];
  streets_joseignacio    text[] := ARRAY['Ruta 10','Calle del Faro','Av. del Horizonte','Camino al Mar','Calle Los Ombúes'];

  -- Selector de calles según zona
  zone_streets text[][];

  ctype text; fname text; lname text; bname text;
  taxid text; phone text; addr text; note text;
  lat double precision; lng double precision;
  zone_idx int; street_arr text[]; street text;
  rand_lat double precision; rand_lng double precision;

BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'hmarquezaragon@gmail.com';
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin hmarquezaragon@gmail.com no encontrado.';
  END IF;

  FOR i IN 1..500 LOOP
    -- Distribuir entre las 6 zonas (aprox 83-84 clientes cada una)
    zone_idx := 1 + ((i - 1) % 6);

    -- Seleccionar calles de la zona
    IF zone_idx = 1 THEN street_arr := streets_maldonado;
    ELSIF zone_idx = 2 THEN street_arr := streets_punta;
    ELSIF zone_idx = 3 THEN street_arr := streets_sancarlos;
    ELSIF zone_idx = 4 THEN street_arr := streets_labarra;
    ELSIF zone_idx = 5 THEN street_arr := streets_buenosaires;
    ELSE street_arr := streets_joseignacio;
    END IF;

    street := street_arr[1 + (i % array_length(street_arr, 1))];

    -- Coordenadas dentro de la zona con variación pseudo-aleatoria
    rand_lat := (((i * 31 + zone_idx * 17) % 1000) - 500) / 1000.0;
    rand_lng := (((i * 47 + zone_idx * 13) % 1000) - 500) / 1000.0;
    lat := zone_lat[zone_idx] + rand_lat * zone_rlat[zone_idx];
    lng := zone_lng[zone_idx] + rand_lng * zone_rlng[zone_idx];

    -- Tipo de cliente
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
    addr  := street || ' ' || (100 + (i * 17 % 900))::text || ', ' || zone_names[zone_idx];
    note  := notes_pool[1 + (i % array_length(notes_pool, 1))];

    INSERT INTO public.customers (
      customer_type, first_name, last_name, business_name, tax_id,
      phone, address, lat, lng, notes, is_active, created_by
    ) VALUES (
      ctype::customer_type, fname, lname, bname, taxid,
      phone, addr, lat, lng, note, true, admin_id
    );
  END LOOP;

  RAISE NOTICE '✅ 500 clientes creados distribuidos en:';
  RAISE NOTICE '   ~84 en Maldonado';
  RAISE NOTICE '   ~84 en Punta del Este';
  RAISE NOTICE '   ~84 en San Carlos';
  RAISE NOTICE '   ~83 en La Barra';
  RAISE NOTICE '   ~83 en Balneario Buenos Aires';
  RAISE NOTICE '   ~83 en José Ignacio';
END;
$$;
