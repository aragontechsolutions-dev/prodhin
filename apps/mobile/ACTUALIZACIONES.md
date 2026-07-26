# Actualizaciones de la APK (auto-chequeo al abrir)

La app avisa al chofer cuando hay una versión nueva y le ofrece descargarla.
Funciona con un archivo `update.json` público + la APK hospedada en un lugar
público. Acá usamos **Supabase Storage** (bucket público), pero podés usar
cualquier URL pública.

## Cómo funciona (resumen)

1. La app guarda su versión instalada en `src/lib/appVersion.ts` (`APP_VERSION`).
2. Al abrir (y al volver del segundo plano) descarga `update.json`.
3. Si `latestVersion` del JSON es mayor que `APP_VERSION`, muestra un aviso con
   botón **Descargar e instalar** que abre la URL de la APK.
4. Sin conexión o si algo falla, no molesta: se ignora en silencio.

---

## Configuración inicial (se hace UNA sola vez)

### 1. Crear el bucket público en Supabase

1. Entrá a tu proyecto en https://supabase.com → **Storage**.
2. **New bucket** → nombre: `app` → marcá **Public bucket** → crear.

### 2. Poner la URL del manifiesto en el código

En `apps/mobile/src/lib/appVersion.ts`, reemplazá `<TU-PROYECTO>` por el ref
de tu proyecto de Supabase (lo ves en la URL del dashboard o en
Settings → API). Queda algo así:

```ts
export const UPDATE_MANIFEST_URL =
  'https://abcd1234.supabase.co/storage/v1/object/public/app/update.json';
```

> Esta URL se compila dentro de la APK, así que este paso solo hace falta la
> primera vez (o si cambiás de proyecto/hosting).

---

## Publicar una versión nueva (cada vez que quieras actualizar)

### 1. Subir el número de versión en el código

- En `apps/mobile/app.json` → subí `"version"` (ej: `1.0.0` → `1.1.0`).
- En `apps/mobile/src/lib/appVersion.ts` → poné el **mismo** número en
  `APP_VERSION`.

> Ambos tienen que coincidir. Usá versiones tipo `MAYOR.MENOR.PARCHE`.

### 2. Generar la APK

```bash
cd apps/mobile
# tu comando habitual de build (EAS o local con gradlew)
```

Renombrá el archivo resultante a algo claro, ej: `prodhin-1.1.0.apk`.

### 3. Subir la APK a Supabase Storage

1. Storage → bucket `app` → **Upload file** → subí `prodhin-1.1.0.apk`.
2. Copiá su URL pública (botón **Copy URL** o **Get URL**). Tiene la forma:
   `https://TU-PROYECTO.supabase.co/storage/v1/object/public/app/prodhin-1.1.0.apk`

### 4. Actualizar `update.json`

Tomá `update.example.json` como plantilla y armá el `update.json` con los
datos nuevos:

```json
{
  "latestVersion": "1.1.0",
  "apkUrl": "https://TU-PROYECTO.supabase.co/storage/v1/object/public/app/prodhin-1.1.0.apk",
  "mandatory": false,
  "notes": "Qué cambió en esta versión."
}
```

- `latestVersion`: la versión nueva.
- `apkUrl`: la URL de la APK del paso 3.
- `mandatory`: `true` obliga a actualizar (no se puede tocar "Más tarde").
- `notes`: texto corto que verá el chofer.

Subí ese `update.json` al bucket `app` (**Upload file**, sobreescribiendo el
anterior).

### 5. ¡Listo!

La próxima vez que un chofer abra la app, verá el aviso de actualización.

---

## Notas

- **Instalación:** al descargar la APK, Android pedirá permiso para "instalar
  apps de orígenes desconocidos". El chofer debe aceptarlo una vez. Esto es
  normal fuera de Google Play.
- **Cambios solo de JS vs nativos:** este método sirve para cualquier cambio
  porque siempre instalás una APK completa. (Si algún día querés updates
  automáticos sin reinstalar para cambios de JS, eso es EAS Update / Opción A.)
- **Privacidad del bucket:** el bucket `app` es público solo para poder
  descargar la APK y el JSON sin login. No pongas datos sensibles ahí.
