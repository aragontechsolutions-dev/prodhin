# ✅ Checklist de QA — Prodhin (antes de grabar el video)

Probá en este orden. Marcá cada casilla cuando pase. Si algo falla, anotalo y
avisá antes de grabar. Objetivo: que la demo sea fluida y sin sorpresas.

---

## Fase 0 — Preparación del entorno

- [ ] **Traer lo último**
  ```powershell
  cd C:\dev\prodhin
  git pull origin claude/quirky-heisenberg-dsky70
  ```
- [ ] **Typecheck del móvil** (no debe dar errores)
  ```powershell
  cd apps\mobile
  npx tsc --noEmit
  ```
- [ ] **Typecheck de la web**
  ```powershell
  cd ..\web
  npx tsc --noEmit
  ```
- [ ] **La web compila**
  ```powershell
  npm run build   # si falla por @prodhin/shared, primero: npm install en la raíz
  ```
  > Si `tsc` marca errores, pegámelos y los corrijo antes de seguir.

---

## Fase 1 — Base de datos (Supabase → SQL Editor)

Aplicar **en este orden** (si la base ya tenía las primeras, saltealas):

- [ ] `supabase/01_schema.sql`  (solo en base nueva)
- [ ] `supabase/02_rls.sql`      (solo en base nueva)
- [ ] `supabase/migrations/20260615_driver_delegations.sql`
- [ ] `supabase/migrations/20260616_customers_delegation_rls.sql`
- [ ] `supabase/migrations/20260617_routes.sql`
- [ ] `supabase/migrations/20260703_deliveries.sql`
- [ ] `supabase/migrations/20260704_customer_egg_preferences.sql`
- [ ] `supabase/migrations/20260705_unique_constraints.sql`
- [ ] `supabase/migrations/20260706_truck_stock.sql`
- [ ] `supabase/migrations/20260707_boxes_and_audit.sql`
- [ ] `supabase/migrations/20260708_counts_admin_only.sql`

**Verificar que existan** (SQL Editor):
```sql
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('deliveries','delivery_items','egg_types',
    'customer_egg_preferences','truck_loads','truck_counts','audit_log');
-- deben salir las 7

select viewname from pg_views where schemaname='public'
  and viewname in ('truck_stock_current','customer_box_balance');
-- deben salir las 2
```
- [ ] Salen las 7 tablas y las 2 vistas.
- [ ] `select count(*) from egg_types;` → hay categorías (seed).

---

## Fase 2 — Datos de demo (armar un escenario limpio)

Desde el **panel web** (o SQL):

- [ ] Crear **1 chofer** (Usuarios → Nuevo). Anotá email + contraseña temporal.
- [ ] Crear **4–6 clientes** con **coordenadas reales cercanas** (para que la ruta/navegación se vea bien). Usá empresas con RUT y alguna persona física.
- [ ] En **Categorías**: confirmá que estén las que usan (Rojo Mediano, etc.).
- [ ] A cada cliente, botón **🥚 Huevos** → asignar 1–2 tipos habituales + marcar principal.
- [ ] **Asignaciones**: asignar esos clientes al chofer.
- [ ] **Rutas**: crear ruta para el chofer, agregar los clientes al **día de hoy**.
- [ ] **Stock camiones** → botón **Recuento** del chofer → cargar stock inicial (ej. 20 cp de cada tipo).

---

## Fase 3 — Panel web (módulos)

### Usuarios
- [ ] Crear usuario con **teléfono repetido** → debe **bloquear** (teléfono único).
- [ ] Cambiar contraseña / forzar cambio funciona.

### Clientes
- [ ] Crear cliente con **RUT ya existente** → **bloquea** con aviso.
- [ ] Crear cliente con **teléfono repetido** → **modal de aviso** "¿crear de todas formas?".
- [ ] La columna **📦 Cajas** aparece (0 al inicio).
- [ ] Vista **mapa** de clientes: los pines se ven bien; sin scroll horizontal en móvil.

### Rutas
- [ ] Panel de ruta: **lista única con checks**, buscador, filtro "Solo en ruta".
- [ ] **Copiar día**: copia clientes de un día a otro.
- [ ] En móvil (DevTools) no se sale la tabla ni los días.

### Reportes
- [ ] Filtros (fechas, chofer, tipo) funcionan.
- [ ] **Exportar CSV** descarga bien.
- [ ] Analíticas se muestran (se llenan después de registrar entregas en Fase 4).

### Stock camiones
- [ ] Se ve el stock del chofer por tipo.
- [ ] **Recuento**: dejar una categoría vacía → se toma como **0**.

### Auditoría
- [ ] Se ven acciones (crear cliente, ruta, etc.) en **lenguaje claro** (nombres, no IDs).
- [ ] Filtros por **usuario / fecha / sección / acción** funcionan.
- [ ] **Paginación** (cambiar tamaño 10/20/50/100, anterior/siguiente).

### Manual
- [ ] Abre y navega por secciones.

---

## Fase 4 — App móvil (build real)

> El logo y todo cambio nativo requieren recompilar. Para la demo usá el APK.
```powershell
cd C:\dev\prodhin\apps\mobile
npx expo prebuild --platform android --clean
npx expo run:android           # o el APK que ya tengas actualizado
```

### Login / sesión
- [ ] **Sin credenciales** no entra.
- [ ] Primer login con contraseña temporal → pide cambiarla.
- [ ] (Opcional) Con un usuario borrado en BD → muestra **"Sesión expirada"** y vuelve al login.

### Mapa
- [ ] Se ven los clientes con colores correctos (verde ruta, rojo propio, etc.).
- [ ] Buscador vuela al cliente.
- [ ] Botón **📍 recentrar** funciona.

### Navegación
- [ ] Tocar cliente → **Navegar**: la flecha apunta hacia donde te movés y el mapa gira.
- [ ] Avisos de giro por voz (probar con volumen).

### Registrar entrega (el corazón de la demo)
- [ ] Multi-tipo: seleccionar varios tipos, cantidad editable.
- [ ] **Validación de stock (online)**: intentar entregar más de lo que hay → **bloquea**.
- [ ] Modo **deja cajas** / **cartones**.
- [ ] **Cajas recogidas**: intentar recoger más de las que hay en el local → **bloquea/avisa**.
- [ ] Al guardar, el cliente queda **✓ verde (entregado)** en el mapa.
- [ ] Auto-sugerencia si el tipo no está en habituales.

### Después de entregar
- [ ] **Stock del camión** bajó por lo entregado.
- [ ] **Detalle del cliente** muestra **cajas en el local** actualizadas.
- [ ] **Mis entregas**: aparece la entrega; resumen por categoría + total; filtro por día/rango.
- [ ] **Carga del día**: muestra demanda − en camión = a cargar.
- [ ] Drawer "Ruta de hoy": el cliente pasó a **Entregados**.

### Stock del camión (chofer)
- [ ] Solo aparece **➕ Registrar carga** (NO "Hacer recuento").
- [ ] Registrar una carga → el stock sube.

---

## Fase 5 — Prueba OFFLINE (el gran diferencial)

1. [ ] Abrí la app **con conexión** (para que precargue stock y cajas).
2. [ ] Poné el teléfono en **modo avión**.
3. [ ] Registrá una entrega → avisa que no pudo verificar pero **deja registrar igual**.
4. [ ] Se muestra el banner de **sin conexión**.
5. [ ] Sacá el modo avión → la entrega **se sincroniza sola** (aparece en Reportes web al refrescar).

---

## Fase 6 — Integración cruzada (web ↔ app)

- [ ] Cambiar algo en la web (agregar cliente / tipo habitual / categoría) → en la app, tocar **Actualizar** (o entrar a la sección) → **se ve el cambio**.
- [ ] **Corregir una entrega** desde Reportes (cambiar categoría, poner motivo) → aparece en **Auditoría** con el motivo, y el stock/cajas se recalculan.
- [ ] Registrar entregas desde la app → **Reportes** y **analíticas** (más vendidos, top clientes, choferes, evolución por día) se llenan.

---

## Fase 7 — Pre-video (dejar todo lindo para grabar)

- [ ] Tener **historial de varios días** (registrar unas entregas con fechas variadas si se puede) para que las analíticas y "Carga del día" se vean con datos.
- [ ] Batería del teléfono cargada, brillo alto, notificaciones en silencio.
- [ ] Ensayar el flujo 1 vez completo antes de grabar.
- [ ] Tener un cliente con **cajas pendientes** para mostrar el reclamo de envases.

---

### Si algo falla
Anotá: **qué pantalla, qué hiciste, qué esperabas, qué pasó** (captura si podés) y
pasámelo. Los errores de tipos (`tsc`) son los primeros a descartar.
