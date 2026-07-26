// ─────────────────────────────────────────────────────────────────────────
// Chequeo de actualizaciones (Opción B: APK auto-hospedada + manifiesto JSON)
//
// Cómo funciona:
//   1. APP_VERSION es la versión instalada. La subís a mano cada vez que
//      generás una APK nueva (debe coincidir con "version" en app.json).
//   2. Al abrir la app se descarga UPDATE_MANIFEST_URL (un JSON chico) y se
//      compara su "latestVersion" con APP_VERSION.
//   3. Si el remoto es mayor, la app avisa al chofer y le ofrece descargar
//      la APK nueva desde "apkUrl".
//
// Sin conexión o si el fetch falla, no pasa nada (se ignora en silencio).
// ─────────────────────────────────────────────────────────────────────────

// Versión ACTUALMENTE instalada. ⚠️ Subila junto con "version" en app.json
// cada vez que publiques una APK nueva.
export const APP_VERSION = '1.0.0';

// URL pública del manifiesto de versión. Debe devolver un JSON como:
//   {
//     "latestVersion": "1.1.0",
//     "apkUrl": "https://github.com/.../releases/download/v1.1.0/prodhin-1.1.0.apk",
//     "mandatory": false,
//     "notes": "Botones de WhatsApp y arreglos de pantalla."
//   }
//
// Se hospeda en un repo PÚBLICO de GitHub (ver ACTUALIZACIONES.md), servido
// vía raw.githubusercontent. La APK va como asset de un Release (soporta
// archivos grandes; el límite de 50 MB de Supabase no aplica acá).
// Reemplazá <REPO-PUBLICO> por el nombre del repo que crees (ej: prodhin-releases).
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/aragontechsolutions-dev/prodhin-releases/main/update.json';

export interface UpdateManifest {
  latestVersion: string;
  apkUrl: string;
  mandatory?: boolean;
  notes?: string;
}

export interface UpdateInfo extends UpdateManifest {
  updateAvailable: boolean;
}

// Compara dos versiones tipo "1.2.3". Devuelve:
//   > 0 si a > b,  < 0 si a < b,  0 si son iguales.
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

// Descarga el manifiesto y decide si hay actualización. Nunca lanza: ante
// cualquier error (sin red, JSON inválido, URL sin configurar) devuelve null.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  // Si todavía no configuraron la URL, no hacemos nada.
  if (UPDATE_MANIFEST_URL.includes('<REPO-PUBLICO>')) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    // cache-buster para evitar CDN/caché sirviendo un manifiesto viejo
    const url = `${UPDATE_MANIFEST_URL}?t=${Date.now()}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    // Leemos como texto y sacamos un posible BOM (U+FEFF) al inicio: algunos
    // editores/PowerShell lo agregan y rompería JSON.parse.
    const raw = (await res.text()).replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(raw) as UpdateManifest;
    if (!data?.latestVersion || !data?.apkUrl) return null;

    const updateAvailable = compareVersions(data.latestVersion, APP_VERSION) > 0;
    return {
      ...data,
      mandatory: !!data.mandatory,
      updateAvailable,
    };
  } catch {
    return null;
  }
}
