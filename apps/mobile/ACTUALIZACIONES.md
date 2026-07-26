# Actualizaciones de la APK (auto-chequeo al abrir)

La app avisa al chofer cuando hay una versión nueva y le ofrece descargarla.
Funciona con un archivo `update.json` público + la APK hospedada públicamente.

Usamos un **repo PÚBLICO de GitHub** para hospedar todo, porque:

- Las APK son grandes (74 MB hoy). GitHub Releases soporta archivos de hasta
  **2 GB** por archivo. (Supabase free corta en 50 MB, por eso NO sirve.)
- En un repo **público**, tanto el `update.json` como los assets de los
  Releases se descargan **sin login**.

> Este repo es solo para distribuir la APK: no lleva código fuente. El código
> sigue en el repo privado `prodhin`.

## Cómo funciona (resumen)

1. La app guarda su versión instalada en `src/lib/appVersion.ts` (`APP_VERSION`).
2. Al abrir (y al volver del segundo plano) descarga `update.json`.
3. Si `latestVersion` del JSON es mayor que `APP_VERSION`, muestra un aviso con
   botón **Descargar e instalar** que abre la URL de la APK.
4. Sin conexión o si algo falla, no molesta: se ignora en silencio.

---

## Configuración inicial (se hace UNA sola vez)

### 1. Crear el repo público de releases

1. En GitHub, creá un repo nuevo, ej: **`prodhin-releases`**, en la org
   `aragontechsolutions-dev`, marcado como **Public**.
2. Agregá un `update.json` inicial en la raíz (podés copiar
   `update.example.json` de este proyecto). Con que exista alcanza.

### 2. Poner la URL del manifiesto en el código

En `apps/mobile/src/lib/appVersion.ts`, reemplazá `<REPO-PUBLICO>` por el
nombre del repo que creaste. Queda algo así:

```ts
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/aragontechsolutions-dev/prodhin-releases/main/update.json';
```

> Esta URL se compila dentro de la APK, así que este paso solo hace falta la
> primera vez.

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

### 3. Crear un Release en GitHub y adjuntar la APK

1. En el repo `prodhin-releases` → **Releases** → **Draft a new release**.
2. **Tag**: `v1.1.0` (mismo número que la versión).
3. Arrastrá la APK (`prodhin-1.1.0.apk`) a la zona de **assets**.
4. **Publish release**.
5. La URL de descarga directa queda así (copiala):
   `https://github.com/aragontechsolutions-dev/prodhin-releases/releases/download/v1.1.0/prodhin-1.1.0.apk`

### 4. Actualizar `update.json` en el repo público

Editá el `update.json` en la raíz de `prodhin-releases` (botón lápiz en
GitHub) y dejalo así:

```json
{
  "latestVersion": "1.1.0",
  "apkUrl": "https://github.com/aragontechsolutions-dev/prodhin-releases/releases/download/v1.1.0/prodhin-1.1.0.apk",
  "mandatory": false,
  "notes": "Qué cambió en esta versión."
}
```

- `latestVersion`: la versión nueva.
- `apkUrl`: la URL del asset del Release (paso 3).
- `mandatory`: `true` obliga a actualizar (no se puede tocar "Más tarde").
- `notes`: texto corto que verá el chofer.

Guardá el commit.

### 5. ¡Listo!

La próxima vez que un chofer abra la app, verá el aviso de actualización.

---

## Notas

- **Instalación:** al descargar la APK, Android pedirá permiso para "instalar
  apps de orígenes desconocidos". El chofer debe aceptarlo una vez. Esto es
  normal fuera de Google Play.
- **`raw.githubusercontent` puede cachear ~5 min:** si acabás de editar el
  `update.json` y no aparece el aviso al toque, esperá unos minutos. (La app ya
  agrega un parámetro anti-caché, pero el CDN de GitHub a veces demora.)
- **Cambios solo de JS vs nativos:** este método sirve para cualquier cambio
  porque siempre instalás una APK completa. (Si algún día querés updates
  automáticos sin reinstalar para cambios de JS, eso es EAS Update / Opción A.)
- **No pongas datos sensibles en el repo público:** es solo para la APK y el
  `update.json`.
