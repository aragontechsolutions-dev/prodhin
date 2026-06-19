import { useState, useEffect } from 'react';

const sections = [
  { id: 'intro', emoji: '🥚', label: 'Introducción' },
  { id: 'usuarios', emoji: '👤', label: 'Usuarios' },
  { id: 'clientes', emoji: '📍', label: 'Clientes' },
  { id: 'asignaciones', emoji: '📋', label: 'Asignaciones' },
  { id: 'rutas', emoji: '🗺️', label: 'Rutas' },
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
            <strong>Prodhin</strong> es un sistema de gestión de reparto diseñado para empresas de distribución. Permite al administrador organizar choferes, clientes y rutas de entrega, y brinda a cada chofer una app móvil con su mapa personalizado.
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
            'Seleccionar el día (ej: Miércoles) y agregar clientes desde el panel.',
            'Los clientes aparecerán en el mapa del chofer ese día con marcador verde pulsante.',
          ]} />

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

        {/* App móvil */}
        <section id="app-movil" className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 scroll-mt-6">
          <SectionTitle>📱 App móvil — Flujo del chofer</SectionTitle>
          <P>La app muestra un mapa interactivo con todos los clientes asignados al chofer. Al abrir la app, los marcadores ya están clasificados según la configuración del CORE.</P>

          <SubTitle>Primer login</SubTitle>
          <P>Si el administrador creó el usuario con "forzar cambio de contraseña" activado, la app mostrará una pantalla de cambio de contraseña antes de acceder al mapa. El chofer debe ingresar y confirmar su nueva contraseña. Tras confirmar, aparece un mensaje de éxito con cuenta regresiva de 4 segundos y la app redirige al login para ingresar con la nueva contraseña.</P>

          <SubTitle>Navegación — Menú lateral</SubTitle>
          <P>El botón de tres líneas (☰) en la esquina superior izquierda abre un menú lateral deslizante con dos vistas:</P>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">📍 Mis clientes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Lista de todos los clientes asignados con buscador. Al tocar un cliente el mapa vuela a su marcador.</p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">🗓️ Ruta de hoy</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Muestra los clientes pendientes (verde) y visitados (gris con ✓) del día. Al tocar un cliente pendiente el mapa vuela a él.</p>
            </div>
          </div>

          <SubTitle>Leyenda de marcadores</SubTitle>
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl divide-y divide-gray-50 dark:divide-gray-800 mb-4">
            <MarkerLegend color="bg-green-500" shape="circle" label="Verde pulsante — Ruta de hoy" desc="Cliente incluido en la ruta del chofer para el día actual. Pendiente de visita." />
            <MarkerLegend color="bg-gray-400" shape="circle" label="Gris con ✓ — Visitado" desc="El chofer marcó este cliente como visitado durante el día." />
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
              q="¿Los datos de visitas del chofer se guardan en la base de datos?"
              a="No. Las marcas de 'visitado' son locales a la sesión de la app. Al cerrar y reabrir la app, los marcadores vuelven a su estado original. Esto es por diseño para no acumular datos históricos innecesarios."
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
