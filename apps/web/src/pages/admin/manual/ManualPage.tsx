import { useState, useEffect } from 'react';

const sections = [
  { id: 'intro', emoji: '🥚', label: 'Introducción' },
  { id: 'dashboard', emoji: '🏠', label: 'Dashboard (inicio)' },
  { id: 'usuarios', emoji: '👤', label: 'Usuarios' },
  { id: 'clientes', emoji: '📍', label: 'Clientes' },
  { id: 'categorias', emoji: '🥚', label: 'Categorías de huevo' },
  { id: 'asignaciones', emoji: '📋', label: 'Asignaciones' },
  { id: 'rutas', emoji: '🗺️', label: 'Rutas' },
  { id: 'reportes', emoji: '📊', label: 'Reportes' },
  { id: 'stock', emoji: '🚚', label: 'Stock camiones' },
  { id: 'maples', emoji: '🧺', label: 'Maples' },
  { id: 'devoluciones', emoji: '♻️', label: 'Rotos y devoluciones' },
  { id: 'competencia', emoji: '🎯', label: 'Competencia' },
  { id: 'auditoria', emoji: '📝', label: 'Auditoría' },
  { id: 'app-movil', emoji: '📱', label: 'App móvil' },
  { id: 'faq', emoji: '❓', label: 'Preguntas frecuentes' },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{children}</h2>;
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-5">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">{children}</p>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-3">
      <span className="text-amber-500 flex-shrink-0 mt-0.5">💡</span>
      <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 mb-3">
      <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
      <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">{children}</p>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2 mb-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 font-bold text-xs flex items-center justify-center">{i + 1}</span>
          <span className="leading-relaxed pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function MarkerLegend({ color, shape, label, desc }: { color: string; shape: 'circle' | 'diamond'; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 w-8 flex items-center justify-center mt-0.5">
        {shape === 'circle' ? (
          <div className={`w-4 h-4 rounded-full border-2 border-white shadow ${color}`} />
        ) : (
          <div className={`w-3.5 h-3.5 rotate-45 border-2 border-white shadow ${color}`} />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-2">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{q}</span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800">
          {a}
        </div>
      )}
    </div>
  );
}

export default function ManualPage() {
  const [active, setActive] = useState('intro');

  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + 120;
      for (const s of [...sections].reverse()) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop <= scrollY) { setActive(s.id); break; }
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex gap-8 relative">
      {/* Sidebar */}
      <aside className="hidden lg:block w-48 flex-shrink-0">
        <div className="sticky top-6 space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Contenido</p>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-left transition
                ${active === s.id
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
            >
              <span>{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-10 pb-16">

        {/* Intro */}
        <section id="intro" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🥚 Introducción</SectionTitle>
          <P>
            <strong>Prodhin</strong> es un sistema de gestión de reparto de huevos. Permite al administrador organizar choferes, clientes, categorías de huevo y rutas de entrega, y brinda a cada chofer una app móvil con su mapa, navegación integrada y registro de entregas. Toda entrega registrada por el chofer queda guardada y alimenta los reportes y la sugerencia de carga.
          </P>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">💻 CORE Web (Admin)</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">Panel de administración donde se gestionan usuarios, clientes, asignaciones y rutas. Solo accesible para administradores.</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
              <p className="font-semibold text-green-800 dark:text-green-300 mb-1">📱 App móvil (Choferes)</p>
              <p className="text-sm text-green-700 dark:text-green-400">Aplicación Android que muestra a cada chofer sus clientes en un mapa interactivo, con la ruta del día resaltada.</p>
            </div>
          </div>
        </section>

        {/* Dashboard */}
        <section id="dashboard" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🏠 Dashboard (inicio)</SectionTitle>
          <P>Es la pantalla de resumen. Arriba, tarjetas con el estado general: choferes activos, clientes activos/inactivos, rutas activas, rutas sin chofer y delegaciones de hoy.</P>
          <SubTitle>Requiere tu atención</SubTitle>
          <P>Al entrar, si hay algo pendiente aparece un <strong>aviso 🔔</strong> arriba de todo que resume cuántas cosas tenés por aprobar o gestionar, con accesos directos a cada una.</P>
          <P>Debajo, una fila de tarjetas que se ponen en <strong>ámbar</strong> cuando hay algo: <strong>Maples por aprobar</strong>, <strong>Rotos/devoluciones por aprobar</strong>, <strong>Prospectos por gestionar</strong>, <strong>Competencia por aprobar</strong> (marcada por choferes) y el total de <strong>cajas plásticas en locales</strong>. Cada tarjeta es un acceso directo al módulo correspondiente.</P>
          <SubTitle>Estado de rutas y accesos rápidos</SubTitle>
          <P>Debajo ves las rutas activas con su chofer, y una grilla de accesos rápidos a todos los módulos (Usuarios, Clientes, Asignaciones, Rutas, Reportes, Categorías, Stock, Maples, Rotos y devoluciones, Auditoría y Manual).</P>
        </section>

        {/* Usuarios */}
        <section id="usuarios" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>👤 Módulo Usuarios</SectionTitle>
          <P>Desde aquí se crean y gestionan los choferes que usarán la app móvil. Solo los usuarios con rol <strong>Chofer</strong> acceden a la app.</P>

          <SubTitle>Crear un chofer</SubTitle>
          <Steps items={[
            'Ir a Usuarios → botón "Nuevo usuario".',
            'Completar nombre completo, email, teléfono y contraseña temporal.',
            'Seleccionar el rol (Chofer o Admin). Por defecto se marca "Forzar cambio de contraseña en el próximo inicio de sesión".',
            'Entregar el email y la contraseña temporal al chofer para que inicie sesión en la app.',
          ]} />
          <Tip>La primera vez que el chofer ingrese, la app le pedirá que cambie su contraseña temporal. Tras hacerlo, será redirigido al login automáticamente.</Tip>

          <SubTitle>Cambiar la contraseña de un usuario</SubTitle>
          <P>Si un chofer olvida su contraseña, el administrador puede establecerle una nueva directamente desde el CORE:</P>
          <Steps items={[
            'En la lista de usuarios, hacer clic en "Cambiar pass" en la fila del chofer.',
            'Escribir la nueva contraseña temporal (mínimo 6 caracteres).',
            'El sistema activa automáticamente "forzar cambio en próximo login".',
            'Comunicar la contraseña temporal al chofer. Al ingresar, deberá establecer una propia.',
          ]} />

          <SubTitle>Forzar cambio de contraseña</SubTitle>
          <P>El ícono de candado 🔒 en cada fila permite activar o desactivar el forzado de cambio de contraseña sin abrir el modal de edición. Cuando está activo, el badge <strong>"Cambio pendiente"</strong> aparece en amarillo junto al estado del usuario.</P>
          <Warning>Si el chofer ya está logueado en la app cuando se le fuerza el cambio, verá la pantalla de cambio de contraseña la próxima vez que la app se reinicie o al cerrar y volver a abrir sesión.</Warning>

          <SubTitle>Activar / Desactivar usuario</SubTitle>
          <P>Desde la lista de usuarios podés activar o desactivar un usuario con el botón correspondiente. Un usuario inactivo no puede iniciar sesión en la app móvil.</P>
          <Warning>Desactivar un usuario no elimina sus clientes asignados ni sus rutas. Si lo reactivás, todo vuelve a funcionar como antes.</Warning>
        </section>

        {/* Clientes */}
        <section id="clientes" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📍 Módulo Clientes</SectionTitle>
          <P>Los clientes son los puntos de entrega que aparecen en el mapa de los choferes. Pueden ser personas físicas o empresas.</P>

          <SubTitle>Tipos de cliente</SubTitle>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Persona física</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Requiere nombre y apellido. El marcador muestra "Nombre Apellido".</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Empresa / Local</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Requiere razón social. Opcionalmente RUT y nombre de contacto.</p>
            </div>
          </div>

          <SubTitle>Cómo obtener las coordenadas</SubTitle>
          <Steps items={[
            'Abrir Google Maps y buscar la dirección del cliente.',
            'Hacer clic derecho sobre el pin → aparece la latitud y longitud.',
            'Copiar los valores (ej: -34.9011, -54.9595) en los campos Lat y Lng.',
          ]} />
          <Tip>Las coordenadas son esenciales: sin ellas el cliente no aparecerá en el mapa del chofer.</Tip>

          <SubTitle>Número de cliente</SubTitle>
          <P>Cada cliente lleva un <strong>número que asigna administración</strong> (campo obligatorio, numérico). Es único: el sistema no deja guardar dos clientes con el mismo número. Aparece en la lista (ej: <code>#125</code>), se puede buscar por él, y el chofer lo ve en el detalle del cliente.</P>

          <SubTitle>Validaciones al crear/editar</SubTitle>
          <div className="space-y-2 mb-3">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Número de cliente único (bloqueante)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Obligatorio y numérico. No se puede repetir entre clientes.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">RUT: 12 dígitos y único (bloqueante)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">El RUT es opcional, pero si se ingresa debe tener exactamente 12 dígitos y no puede repetirse. Los clientes viejos con RUT de otra longitud no se ven afectados mientras no se modifique ese campo.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Teléfono repetido (solo aviso)</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Como un mismo dueño puede tener varias empresas/locales con el mismo teléfono, no se bloquea: aparece un aviso "¿crear de todas formas?" para confirmar.</p>
            </div>
          </div>

          <SubTitle>📲 Autoservicio: que el cliente cargue sus datos</SubTitle>
          <P>Podés generar un <strong>link de un solo uso</strong> para que el propio cliente complete o corrija sus datos (nombre, RUT, dirección) y capture su <strong>ubicación GPS</strong> desde el celular. Ideal para conseguir la ubicación exacta sin ir al lugar.</P>
          <Steps items={[
            'Crear el cliente con su número asignado y una ubicación aproximada (podés ajustarla luego).',
            'Editar el cliente → sección "📲 Autoservicio del cliente" → "Generar link de autoservicio".',
            'Tocar "Enviar por WhatsApp": se abre el chat del cliente con el link listo para enviar.',
            'El cliente abre el link, completa sus datos, toca "Usar mi ubicación actual" y envía.',
            'Sus datos y ubicación se actualizan solos en el sistema.',
          ]} />
          <Tip>El link vence a los 7 días y sirve una sola vez. Si el cliente necesita corregir de nuevo, generá uno nuevo.</Tip>
          <Warning>El link deja modificar los datos del cliente sin necesidad de iniciar sesión. Enviáselo solo al cliente correcto por WhatsApp; no lo publiques.</Warning>

          <SubTitle>🥚 Tipos de huevo habituales del cliente</SubTitle>
          <P>Cada cliente puede tener asociados los tipos de huevo que suele comprar (uno o varios), con uno marcado como <strong>principal</strong>. Sirve de referencia y prellena la entrega en la app del chofer.</P>
          <Steps items={[
            'En la lista de clientes, hacer clic en el botón "🥚 Huevos" de la fila.',
            'Tocar los tipos que el cliente compra habitualmente (se marcan en azul).',
            'Con la estrella (⭐/☆) marcar cuál es el principal.',
            'Los cambios se guardan al instante y el chofer los ve en su app.',
          ]} />
          <Tip>El chofer igual puede entregar cualquier tipo, esté o no en los habituales. Además, si entrega un tipo nuevo, la app le ofrece agregarlo a los habituales automáticamente.</Tip>

          <SubTitle>📦 Cajas plásticas en el local</SubTitle>
          <P>La columna "Cajas" de la lista muestra cuántas cajas plásticas hay actualmente en el local de cada cliente (prestadas, pendientes de recoger). Se calcula solo: cajas dejadas en las entregas (modo "deja cajas") menos las cajas recogidas por el chofer en cada visita.</P>
        </section>

        {/* Categorías de huevo */}
        <section id="categorias" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🥚 Módulo Categorías de huevo</SectionTitle>
          <P>Define los tipos de huevo que existen en el sistema (ej: Rojo Mediano, Blanco Especial, H). Estos tipos aparecen en la app del chofer al registrar entregas y al configurar los habituales de cada cliente.</P>

          <SubTitle>Gestionar categorías</SubTitle>
          <Steps items={[
            'Ir a Categorías → "Nueva categoría".',
            'Escribir el nombre, elegir el color (rojo, blanco o sin color) y el orden de aparición.',
            'Guardar. La categoría queda activa y disponible en la app.',
            'Para editar o cambiar el estado, usar los botones de cada fila.',
          ]} />

          <SubTitle>Tipo: suelto vs. envasado</SubTitle>
          <P>Cada categoría se clasifica como <strong>huevo suelto</strong> (se vende en maples de cartón) o <strong>huevo envasado</strong> (paquetes). En las envasadas definís <strong>huevos por paquete</strong> y <strong>paquetes por caja plástica</strong> (ej: "Doña Clara x6" → 6 huevos/paquete y 24 paquetes/caja). Con eso, cuando un chofer devuelve productos vencidos, el sistema muestra el equivalente en huevos y cajas (ej: 4 paquetes = 24 huevos). En "Rotos y devoluciones", el chofer solo puede elegir categorías <strong>envasadas</strong> para los vencidos.</P>

          <SubTitle>Desactivar vs. eliminar</SubTitle>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-700">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Desactivar (recomendado)</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">La categoría deja de aparecer en la app pero se conserva todo el historial de entregas. Es la baja segura.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Eliminar</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Solo se puede si la categoría no tiene entregas ni preferencias asociadas. Si las tiene, el sistema pide desactivarla en su lugar.</p>
            </div>
          </div>
          <Warning>Los nombres de categoría no se repiten. Si intentás crear una con un nombre que ya existe, el sistema lo impide.</Warning>
        </section>

        {/* Asignaciones */}
        <section id="asignaciones" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📋 Módulo Asignaciones</SectionTitle>
          <P>Las asignaciones vinculan clientes con choferes. Un chofer solo ve en su app los clientes que le fueron asignados.</P>

          <SubTitle>Asignar clientes a un chofer</SubTitle>
          <Steps items={[
            'Ir a Asignaciones → en la card del chofer, desplegar con el botón "▾".',
            'Hacer clic en "Asignar" para abrir el modal de asignación.',
            'Seleccionar el chofer en el desplegable (si no estaba preseleccionado).',
            'Usar el buscador para filtrar por nombre, RUT o teléfono.',
            'Marcar los clientes deseados con los checkboxes (o usar "Seleccionar todos").',
            'Hacer clic en "Asignar N clientes" para confirmar.',
          ]} />
          <Warning>Un cliente solo puede estar asignado a un chofer a la vez. El sistema no muestra como disponibles los clientes que ya tienen un chofer asignado. Para reasignar un cliente, primero desasignarlo del chofer actual.</Warning>

          <SubTitle>Ver y gestionar clientes asignados</SubTitle>
          <Steps items={[
            'En la card del chofer, desplegar con "▾" y hacer clic en "Ver clientes".',
            'Se abre un modal con la lista completa de clientes del chofer.',
            'Usar el buscador para encontrar un cliente específico por nombre, teléfono o RUT.',
            'Para quitar un cliente, hacer clic en la ✕ a la derecha de su nombre.',
          ]} />

          <SubTitle>Delegaciones de cobertura</SubTitle>
          <P>Cuando un chofer está ausente, podés delegar su cartera a otro chofer temporalmente.</P>
          <Steps items={[
            'En Asignaciones → sección Delegaciones → "Nueva delegación".',
            'Seleccionar el chofer ausente y el chofer que lo cubre.',
            'Definir fecha de inicio y fin de la cobertura.',
            'El chofer cubridor verá los clientes del ausente con marcador naranja (diamante) en su mapa.',
          ]} />
          <Tip>La delegación es automática por fecha. Al llegar la fecha de fin, los clientes naranjas desaparecen del mapa del cubridor sin ninguna acción adicional.</Tip>
          <Warning>Los clientes del ausente aparecen en el mapa del cubridor pero no forman parte de su ruta propia. Si necesitás que el cubridor los vea resaltados en verde, deberás agregarlos a su ruta manualmente.</Warning>
        </section>

        {/* Rutas */}
        <section id="rutas" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🗺️ Módulo Rutas</SectionTitle>
          <P>Las rutas definen qué clientes visita un chofer cada día de la semana. El chofer ve en verde los clientes de su ruta para el día actual.</P>

          <SubTitle>Crear una ruta</SubTitle>
          <Steps items={[
            'Ir a Rutas → "Nueva ruta".',
            'Asignar un nombre descriptivo y el chofer responsable.',
            'La ruta se crea activa. Hacer clic en ella para abrirla.',
            'Seleccionar el día (ej: Miércoles) y agregar clientes desde la lista.',
            'Los clientes aparecerán en el mapa del chofer ese día con marcador verde pulsante.',
          ]} />

          <SubTitle>Agregar/quitar clientes de un día</SubTitle>
          <P>Al abrir una ruta y elegir un día, se muestra <strong>una sola lista</strong> de los clientes del chofer con un check por cada uno:</P>
          <Steps items={[
            'Elegir el día arriba (Lun–Vie, o Lun–Sáb en verano).',
            'Buscar el cliente por nombre o RUT.',
            'Tocar la fila para agregarlo (check verde) o quitarlo del día.',
            'El filtro "Solo en ruta / Todos" y el contador ayudan a revisar de un vistazo.',
          ]} />
          <Tip>Los que ya están en ruta aparecen primero, con la etiqueta "EN RUTA". El buscador es clave cuando el chofer tiene muchos clientes.</Tip>

          <SubTitle>🗓️ Copiar día</SubTitle>
          <P>Si las rutas se repiten (ej: los clientes del lunes son casi los mismos del miércoles), usá "Copiar día": el botón muestra los otros días y, al elegir uno, copia todos sus clientes al día actual (omite los que ya están). Ahorra mucho tiempo de carga.</P>

          <SubTitle>Temporada y días disponibles</SubTitle>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-700">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">☀️ Temporada verano</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Noviembre a Febrero — habilita Lunes a Sábado (6 días).</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-700">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">❄️ Temporada normal</p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">Marzo a Octubre — habilita Lunes a Viernes (5 días).</p>
            </div>
          </div>
          <Tip>La temporada se calcula automáticamente según el mes. No requiere configuración manual.</Tip>
          <Warning>Si asignás un cliente a Sábado en temporada normal, ese cliente no aparecerá resaltado en verde porque el Sábado no es día de ruta fuera del verano.</Warning>
        </section>

        {/* Reportes */}
        <section id="reportes" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📊 Módulo Reportes</SectionTitle>
          <P>Muestra las entregas de huevo registradas por los choferes. Sirve para controlar qué se entregó, a quién y cuánto, y para responder consultas de clientes.</P>

          <SubTitle>Filtros disponibles</SubTitle>
          <div className="space-y-2 mb-3">
            {[
              { t: 'Rango de fechas', d: 'Desde / hasta (por defecto los últimos 30 días).' },
              { t: 'Chofer', d: 'Ver las entregas de un chofer específico o de todos.' },
              { t: 'Tipo de huevo', d: 'Filtrar por una categoría; las métricas y el detalle se ajustan a esa categoría.' },
              { t: 'Cliente (nombre / RUT / N°)', d: 'Escribí parte del nombre, el RUT o el número de cliente para ver SOLO las operaciones de ese cliente: todas las métricas, rankings y el detalle se recalculan para él.' },
            ].map((f) => (
              <div key={f.t} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.t}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{f.d}</p>
              </div>
            ))}
          </div>

          <SubTitle>Qué muestra</SubTitle>
          <P>Tarjetas con totales (cajones entregados, visitas, clientes atendidos, visitas sin venta, <strong>cajas en locales</strong> y <strong>cajas recogidas</strong>), rankings (más vendidos por tipo, clientes que más compran, cajas sin devolver por cliente, choferes que más entregaron), la evolución por día, y una tabla detallada de cada entrega. Se puede <strong>exportar a CSV</strong> (incluye cajas recogidas y devueltas en el acto).</P>
          <Tip>La unidad base es la caja plástica. 1 cajón = 2 cajas plásticas, por eso podés ver medios cajones (ej: 2,5 cajones = 5 cajas plásticas). Usá el filtro por cliente para responder rápido "¿qué le entregamos a este cliente y cuántas cajas tiene?".</Tip>

          <SubTitle>Corregir una entrega</SubTitle>
          <P>Si el chofer se equivocó (por ejemplo, marcó una categoría por otra), el admin puede corregirla:</P>
          <Steps items={[
            'En la tabla de detalle, hacer clic en "Corregir" en la fila de la entrega.',
            'Ajustar estado, tipos y cantidades, modo (deja cajas / cartones), cajas recogidas y cajas devueltas en el acto.',
            'Escribir el MOTIVO de la corrección (obligatorio).',
            'Guardar. El cambio queda registrado en la Auditoría con el motivo.',
          ]} />
        </section>

        {/* Auditoría */}
        <section id="auditoria" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📝 Módulo Auditoría</SectionTitle>
          <P>Registra automáticamente <strong>todas las acciones</strong> de los usuarios: creación, edición y borrado de entregas, cargas, recuentos, clientes, usuarios, rutas, categorías, etc. Solo el administrador puede verlo.</P>
          <P>Cada registro muestra quién lo hizo, qué acción, sobre qué, cuándo y —si aplica— el motivo (por ejemplo, la corrección de una entrega). Se puede filtrar por tabla y por tipo de acción, y desplegar el detalle del cambio.</P>
          <Tip>La auditoría se genera a nivel de base de datos (no depende de la app), así que no se puede saltear ni desactivar desde la interfaz.</Tip>
        </section>

        {/* Stock camiones */}
        <section id="stock" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🚚 Stock de camiones</SectionTitle>
          <P>Muestra qué hay en el camión de cada chofer <strong>ahora mismo</strong>, por tipo de huevo. El chofer mantiene su stock desde la app; acá el admin lo consulta.</P>
          <SubTitle>Cómo se calcula</SubTitle>
          <P>El stock se calcula solo, sin cargar nada a mano en el CORE:</P>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-3 text-sm text-gray-700 dark:text-gray-300 font-medium">
            Stock = último recuento + cargas posteriores − entregas con venta posteriores
          </div>
          <P>El sobrante pasa solo de un día a otro. Este stock además <strong>apalanca la "Carga del día"</strong> del chofer: la app sugiere cargar solo lo que falta (demanda estimada − lo que ya hay en el camión).</P>
          <SubTitle>Cargas y recuentos (solo admin)</SubTitle>
          <P>Las <strong>cargas</strong> (lo que sube al camión) y los <strong>recuentos</strong> (contar físicamente y fijar el valor real) los registra únicamente el administrador desde acá. El chofer solo <strong>ve</strong> su stock en la app.</P>
          <Steps items={[
            'En Stock camiones, tarjeta del chofer → "➕ Registrar carga" para sumar lo que se carga por tipo.',
            'O "🔢 Recuento" para fijar cuántas cajas plásticas hay realmente de cada tipo (corrige desvíos).',
            'Las entregas descuentan solas; el sobrante pasa de un día a otro.',
          ]} />

          <SubTitle>Confirmación de la carga por el chofer</SubTitle>
          <P>Cuando registrás una carga, el chofer recibe un aviso en la app y no puede registrar entregas hasta <strong>confirmar</strong> esa carga. Puede confirmar "todo correcto" o "con diferencias" (informando las cantidades reales por tipo y una nota).</P>
          <Tip>Todo queda en <strong>Auditoría</strong> (tabla "Confirmaciones de carga"): quién confirmó, cuándo, y si hubo diferencias con el detalle asignado vs. real. Si el chofer reporta diferencias, el stock NO se ajusta solo: revisá y, si corresponde, hacé un "🔢 Recuento".</Tip>
        </section>

        {/* Maples */}
        <section id="maples" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🧺 Entregas de maples</SectionTitle>
          <P>Cuando el chofer recoge maples plásticos, los entrega en la empresa. Desde la app registra cuántos entrega; acá el administrador los cuenta y <strong>aprueba o rechaza</strong>.</P>
          <SubTitle>Flujo</SubTitle>
          <Steps items={[
            'El chofer registra en la app cuántos maples entrega (ej: 40). Queda "Pendiente".',
            'En Maples → pestaña "Pendientes", contás físicamente los maples recibidos.',
            'Ingresás la cantidad que contaste y "Aprobar" (o "Rechazar" si no corresponde). Podés dejar una nota.',
            'Si contaste distinto a lo declarado, aprobás con la cantidad real: queda registrada la diferencia.',
          ]} />
          <Tip>El chofer recibe un aviso en la app con el resultado. Todo queda en Auditoría (tabla "Entregas de maples"): declarado, aprobado, quién revisó y las notas.</Tip>
        </section>

        {/* Rotos y devoluciones */}
        <section id="devoluciones" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>♻️ Rotos y devoluciones</SectionTitle>
          <P>Los choferes devuelven a la empresa <strong>huevos rotos</strong> (para cambio) y <strong>productos envasados vencidos</strong> (por fecha de caducidad). El chofer lo registra desde la app y acá lo <strong>controlás y aprobás</strong>.</P>
          <SubTitle>Flujo</SubTitle>
          <Steps items={[
            'El chofer registra: total de huevos rotos y/o productos vencidos (con la fecha del envase). Queda "Pendiente".',
            'En "Rotos y devoluciones" → pestaña Pendientes, controlás físicamente lo recibido.',
            'Registrás cuántos le DEVOLVÉS al chofer: rotos sanos y/o envasados de reposición (con la fecha del envase que le das).',
            'Aprobás (o rechazás, con nota). El chofer recibe el aviso.',
          ]} />
          <Tip>Todo queda en Auditoría ("Rotos y devoluciones" y su detalle): lo declarado, lo devuelto y las fechas de caducidad.</Tip>
        </section>

        {/* Competencia */}
        <section id="competencia" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>🎯 Módulo Competencia (inteligencia de mercado)</SectionTitle>
          <P>Combina un <strong>mapa de calor de la competencia</strong> con un <strong>módulo de prospectos</strong> (potenciales clientes que los choferes relevan en la calle).</P>
          <SubTitle>Mapa</SubTitle>
          <P>En el mapa ves dos capas: los <strong>competidores</strong> como zonas rojas (marca su ubicación y un <strong>radio de acción</strong> estimado en metros), y los <strong>prospectos</strong> como puntos de calor —<strong>naranja</strong> si el local ya tiene oferta de la competencia, <strong>turquesa</strong> si no—. Así visualizás rápido dónde está operando la competencia y dónde hay oportunidades.</P>
          <SubTitle>Marcar competidores</SubTitle>
          <Steps items={[
            'Activá "Agregar competidor" y hacé clic en el mapa donde opera.',
            'Poné un nombre y el radio de acción estimado (en metros, por defecto 500).',
            'Guardá. Podés editar o eliminar cada zona desde su globo en el mapa.',
          ]} />
          <SubTitle>Competidores marcados por los choferes</SubTitle>
          <P>Como la administración no está en la calle, los <strong>choferes</strong> pueden marcar desde la app (con su GPS) dónde ven operar a la competencia. Esas propuestas entran como <strong>pendientes</strong>: aparecen arriba en un aviso ámbar y en el mapa con borde <strong>punteado</strong>. Vos las revisás, ajustás el nombre/radio si hace falta y las <strong>aprobás</strong> (o las borrás). Solo las aprobadas cuentan como zona de competencia.</P>
          <SubTitle>Prospectos (captados por los choferes)</SubTitle>
          <P>Desde la app, el chofer entra a un local potencial, marca su ubicación (GPS), indica si ya tiene competencia y registra las <strong>ofertas que ve</strong>: tipo de huevo, formato (de a 30, 15, 6, etc.), precio y una <strong>foto</strong>. Todo eso aparece acá en fichas, filtrables por estado.</P>
          <Steps items={[
            'Revisás cada prospecto con sus ofertas y fotos.',
            'Cambiás su estado: Nuevo → Contactado, o Descartado.',
            'Si cerrás la venta, usás "Convertir en cliente": completás número de cliente y tipo, y se crea el cliente real con la ubicación y datos del prospecto.',
          ]} />
          <Tip>Todo queda en Auditoría (Competencia, Prospectos y Ofertas de prospecto).</Tip>
        </section>

        {/* App móvil */}
        <section id="app-movil" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📱 App móvil — Flujo del chofer</SectionTitle>
          <P>La app muestra un mapa interactivo con todos los clientes asignados al chofer. Al abrir la app, los marcadores ya están clasificados según la configuración del CORE.</P>

          <SubTitle>Primer login</SubTitle>
          <P>Si el administrador creó el usuario con "forzar cambio de contraseña" activado, la app mostrará una pantalla de cambio de contraseña antes de acceder al mapa. El chofer debe ingresar y confirmar su nueva contraseña. Tras confirmar, aparece un mensaje de éxito con cuenta regresiva de 4 segundos y la app redirige al login para ingresar con la nueva contraseña.</P>

          <SubTitle>Navegación — Menú lateral</SubTitle>
          <P>El botón de tres líneas (☰) arriba a la izquierda abre el menú lateral. Al tocar fuera del menú, se cierra y vuelve a la vista del mapa. Contiene:</P>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📍 Mis clientes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Todos los clientes asignados con buscador. Al tocar uno, el mapa vuela a su marcador.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🗓️ Ruta de hoy</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Del día: pendientes, entregados (con venta) y visitados sin venta, en listas separadas con contador.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🥚 Tipos de huevo</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Los tipos habituales de cada cliente. Buscador y paginación. Se pueden editar desde el detalle del cliente.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🚚 Carga del día</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Cuántas cajas plásticas cargar por tipo (demanda estimada según historial, +10%, menos lo que ya hay en el camión).</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📦 Stock del camión</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lo que hay arriba del camión por tipo (solo lectura). Las cargas y recuentos los hace el admin en la web; las entregas descuentan solas.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📦 Mis entregas</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Historial de entregas con resumen por categoría, filtro por fecha (día o rango), cliente/RUT y tipo de huevo.</p>
            </div>
          </div>

          <SubTitle>Registrar una entrega</SubTitle>
          <P>Desde el detalle de un cliente, el botón "🥚 Registrar entrega" abre el formulario de entrega:</P>
          <Steps items={[
            'Elegir el resultado de la visita (Entregado / Ausente / No quiso / Sin stock).',
            'Seleccionar uno o varios tipos de huevo (multi-selección). Se prellena con el tipo principal del cliente.',
            'Indicar la cantidad de cajas plásticas por cada tipo. La app valida el stock del camión y no deja entregar más de lo que hay.',
            'Elegir el modo: deja cajas plásticas (quedan en el local) o en cartones (no deja cajas).',
            'Indicar cuántas cajas plásticas vacías se recogen en la visita.',
            'Guardar. El cliente queda marcado como visitado automáticamente.',
          ]} />
          <Tip>Si no hay señal, la entrega se guarda igual y se envía sola al reconectar. Y si se entrega un tipo que no está en los habituales del cliente, la app ofrece agregarlo.</Tip>

          <SubTitle>Navegación integrada (GPS)</SubTitle>
          <P>Desde el detalle del cliente se puede navegar hasta él dentro de la app, sin salir a Google Maps. La flecha del chofer apunta hacia donde se desplaza y el mapa rota para que la calle quede siempre vertical, con indicaciones de giro por voz y recálculo automático si se sale de la ruta. Un botón 📍 (abajo a la derecha) recentra el mapa en la posición del chofer. Los tiles del mapa se van cacheando para funcionar mejor sin conexión.</P>

          <SubTitle>Leyenda de marcadores</SubTitle>
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-50 dark:divide-gray-800 mb-4">
            <MarkerLegend color="bg-green-500" shape="circle" label="Verde pulsante — Ruta de hoy" desc="Cliente incluido en la ruta del chofer para el día actual. Pendiente de visita." />
            <MarkerLegend color="bg-green-600" shape="circle" label="Verde con ✓ — Entregado" desc="El chofer registró una entrega con venta a este cliente hoy." />
            <MarkerLegend color="bg-gray-400" shape="circle" label="Gris con ✓ — Visitado sin venta" desc="El chofer visitó al cliente pero no hubo venta (ausente, no quiso o sin stock)." />
            <MarkerLegend color="bg-red-500" shape="circle" label="Rojo — Propio sin ruta hoy" desc="Cliente asignado al chofer pero no está en la ruta del día." />
            <MarkerLegend color="bg-orange-500" shape="diamond" label="Naranja (diamante) — Cobertura" desc="Cliente del chofer ausente que este chofer está cubriendo hoy por delegación." />
          </div>

          <SubTitle>Funciones principales</SubTitle>
          <div className="space-y-2 mb-4">
            {[
              { icon: '🔍', label: 'Buscador', desc: 'Filtra clientes por nombre o RUT. Al seleccionar uno, el mapa vuela al marcador y lo resalta en violeta.' },
              { icon: '↻', label: 'Actualizar', desc: 'Refresca clientes y ruta en tiempo real desde el servidor. Útil si el admin hizo cambios en el CORE.' },
              { icon: '✓', label: 'Marcar visitado', desc: 'En el popup de cada cliente de ruta hay un botón para marcarlo como visitado. El marcador pasa a gris.' },
              { icon: '→', label: 'Ver detalles', desc: 'Abre la ficha completa del cliente con teléfono, dirección y notas.' },
            ].map((f) => (
              <div key={f.label} className="flex gap-3 items-start">
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <SubTitle>Modal de aviso de ruta</SubTitle>
          <P>Al abrir la app, si hay un problema con la ruta configurada, se muestra un modal con cuenta regresiva de 8 segundos. El botón "Actualizar" cierra el modal y refresca los datos:</P>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🗺️ "Sin ruta configurada"</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">El chofer no tiene ninguna ruta asignada en el CORE.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">📋 "Sin clientes para el [día]"</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">La ruta existe pero no tiene clientes asignados para el día de hoy.</p>
            </div>
          </div>

          <SubTitle>Cierre de sesión por inactividad</SubTitle>
          <P>La app cierra sesión automáticamente si el chofer no interactúa durante un período prolongado. El proceso es:</P>
          <Steps items={[
            'Aparece un modal de advertencia: "¿Seguís ahí?" con un botón "Seguir conectado".',
            'Si no responde, aparece un segundo modal informando que la sesión fue cerrada.',
            'El modal de cierre desaparece automáticamente y la app vuelve al login.',
          ]} />
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>❓ Preguntas frecuentes</SectionTitle>
          <div className="mt-2">
            <FaqItem
              q="¿Por qué el chofer no ve sus clientes en el mapa?"
              a="Verificá que: (1) los clientes estén asignados al chofer en Asignaciones, (2) los clientes estén activos, (3) los clientes tengan coordenadas válidas (lat/lng). Si el admin acaba de hacer cambios, el chofer debe presionar Actualizar en la app."
            />
            <FaqItem
              q="¿Por qué los clientes de la ruta no aparecen en verde?"
              a="La ruta existe pero no tiene clientes asignados para el día de hoy. Ir a Rutas → seleccionar la ruta → pestaña del día correspondiente (ej: Miércoles) → agregar los clientes. El chofer debe presionar Actualizar en la app para ver los cambios."
            />
            <FaqItem
              q="¿Por qué los clientes del chofer cubierto no aparecen en el mapa del cubridor?"
              a="Verificar que la delegación esté activa (is_active = true) y que la fecha de hoy esté dentro del rango start_date–end_date. Los clientes del ausente aparecen como marcadores naranjas (diamante). Si los clientes ya están asignados también al cubridor, no aparecerán duplicados."
            />
            <FaqItem
              q="¿Puedo asignar el mismo cliente a dos choferes?"
              a="No. El sistema valida que cada cliente tenga un único chofer. Al abrir el modal de asignación, solo aparecen clientes sin chofer asignado. Para reasignar un cliente a otro chofer, primero hay que quitarlo del chofer actual desde 'Ver clientes'."
            />
            <FaqItem
              q="¿Cómo resetear la contraseña de un chofer que la olvidó?"
              a="Ir a Usuarios → fila del chofer → botón 'Cambiar pass'. Ingresar una contraseña temporal y confirmar. El sistema activa automáticamente 'forzar cambio en próximo login'. Comunicar la contraseña temporal al chofer; la app le pedirá que la cambie al ingresar."
            />
            <FaqItem
              q="¿Cómo cambiar de temporada (verano/invierno)?"
              a="Actualmente la temporada se calcula de forma automática según el mes: noviembre–febrero = verano (Lun–Sáb), marzo–octubre = normal (Lun–Vie). No requiere configuración manual."
            />
            <FaqItem
              q="¿Las entregas del chofer se guardan?"
              a="Sí. Cada entrega registrada (tipo de huevo, cantidad, estado y fecha) se guarda en la base de datos y aparece en Reportes y en 'Mis entregas' de la app. Funciona también sin conexión: se envía sola al reconectar. En cambio, la marca visual de 'visitado' en el mapa es local a la sesión y se reinicia al reabrir la app."
            />
            <FaqItem
              q="¿Cómo defino qué tipos de huevo compra un cliente?"
              a="En Clientes → botón '🥚 Huevos' de la fila. Marcá los tipos habituales y elegí el principal con la estrella. El chofer los ve prellenados al registrar la entrega, pero puede entregar cualquier tipo igual."
            />
            <FaqItem
              q="¿Puedo eliminar una categoría de huevo?"
              a="Solo si no tiene entregas ni preferencias asociadas. Si ya se usó, el sistema no deja borrarla para no perder el historial: en ese caso, desactivala. Una categoría desactivada deja de aparecer en la app pero conserva todo lo registrado."
            />
            <FaqItem
              q="¿Cómo funciona la 'Carga del día' del chofer?"
              a="Estima cuántas cajas plásticas de cada tipo conviene cargar para la ruta del día, según lo que cada cliente suele comprar (cantidad típica × frecuencia), sumado sobre la ruta y con un 10% de margen, menos lo que ya hay en el camión. Necesita historial: las primeras semanas será poco precisa y mejora sola a medida que se registran entregas."
            />
            <FaqItem
              q="El chofer se equivocó de categoría en una entrega, ¿cómo la corrijo?"
              a="En Reportes → botón 'Corregir' en la fila de la entrega. Podés cambiar estado, tipos, cantidades, modo y cajas recogidas. Es obligatorio escribir un motivo, que queda registrado en la Auditoría."
            />
            <FaqItem
              q="¿Qué significan las 'Cajas en el local' del cliente?"
              a="Son las cajas plásticas prestadas que hay en el local del cliente, pendientes de recoger. Se calcula solo: cajas dejadas en las entregas (modo 'deja cajas') menos las cajas recogidas por el chofer en cada visita. Se ve en la lista de clientes (web) y en el detalle del cliente (app)."
            />
            <FaqItem
              q="¿Quién puede hacer recuentos del camión?"
              a="Solo el administrador, desde Stock camiones (botón 'Hacer recuento'). El chofer únicamente registra cargas desde la app; las entregas descuentan solas. El recuento fija el stock real y corrige desvíos."
            />
            <FaqItem
              q="¿Se registra quién hizo cada cambio?"
              a="Sí. El módulo Auditoría (solo admin) guarda automáticamente toda creación, edición y borrado en las tablas clave, con el usuario, la acción, el motivo (si aplica) y el detalle del cambio. Se genera a nivel de base de datos, así que no se puede saltear."
            />
            <FaqItem
              q="¿Qué pasa si desactivo un cliente que está en una ruta?"
              a="El cliente desaparecerá del mapa del chofer (está inactivo), pero seguirá configurado en la ruta. Si lo reactivás, volverá a aparecer con el marcador verde si ese día le corresponde."
            />
            <FaqItem
              q="¿Puedo asignar la misma ruta a dos choferes?"
              a="No. Cada ruta tiene un único chofer asignado. Si necesitás que dos choferes cubran la misma zona, creá una ruta para cada uno con los clientes correspondientes."
            />
          </div>
        </section>

      </div>
    </div>
  );
}
