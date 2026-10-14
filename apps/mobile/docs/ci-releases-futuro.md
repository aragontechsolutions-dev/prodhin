# (Futuro) Automatizar el build + release con GitHub Actions

> Esto NO está implementado todavía. Es una guía para cuando quieras dar el
> siguiente paso: que al crear un tag, GitHub compile la APK y publique el
> release solo, sin buildear en tu laptop.

Hoy el flujo es: subís la versión en el código → buildeás la APK en tu PC →
corrés `publish-release.ps1`. Con GitHub Actions, el objetivo sería:

```
git tag v1.2.0 && git push origin v1.2.0     →     CI compila, firma y publica
```

## Qué hace falta (una sola vez)

1. **Keystore de firma de Android.** Para que la APK se pueda instalar como
   actualización de la anterior, TODAS deben estar firmadas con la MISMA clave.
   - Generás un keystore (`.jks`) una vez y lo guardás bien (si lo perdés, no
     podés volver a firmar con la misma clave → los usuarios tendrían que
     desinstalar y reinstalar).
   - Lo subís como **secret** del repo (en base64), junto con las contraseñas.

2. **Secrets en el repo** (Settings → Secrets and variables → Actions):
   - `ANDROID_KEYSTORE_BASE64` — el `.jks` en base64.
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
   - Un token para poder pushear al repo `prodhin-releases` (o publicar el
     release ahí): un **Personal Access Token** con permiso `contents:write`
     sobre ese repo, guardado como `RELEASES_TOKEN`.

3. **Decidir dónde vive el workflow.** Como el código está en el repo privado
   `prodhin` y la APK se publica en el público `prodhin-releases`, el workflow
   corre en `prodhin` y publica en `prodhin-releases` usando `RELEASES_TOKEN`.

## Dos caminos para compilar en CI

- **A) EAS Build (Expo, en la nube).** El workflow llama a `eas build`. Expo
  compila y firma en sus servidores (maneja el keystore por vos). Más simple,
  pero el free tier tiene límite de builds/mes.
- **B) Gradle en el runner de GitHub.** El workflow hace `expo prebuild` +
  `./gradlew assembleRelease` firmando con tu keystore. Sin depender de EAS,
  pero configurás la firma a mano.

## Ejemplo de workflow (camino B, gradle)

`.github/workflows/release-apk.yml` en el repo `prodhin`:

```yaml
name: Release APK
on:
  push:
    tags: ["v*"]          # se dispara al pushear un tag v1.2.0, etc.

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }

      - run: npm ci

      # Genera el proyecto android nativo desde la config de Expo
      - run: npx expo prebuild --platform android --no-install

      # Restaura el keystore desde el secret
      - name: Restaurar keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/release.jks

      # Compila la APK release firmada
      - name: Build APK
        working-directory: apps/mobile/android
        run: ./gradlew assembleRelease
        env:
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}

      # Renombra con la versión (el tag sin la "v")
      - name: Renombrar APK
        run: |
          VER="${GITHUB_REF_NAME#v}"
          cp android/app/build/outputs/apk/release/app-release.apk "prodhin-$VER.apk"

      # Publica el release en el repo público con la APK adjunta
      - name: Publicar release
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: |
          VER="${GITHUB_REF_NAME#v}"
          gh release create "$GITHUB_REF_NAME" "prodhin-$VER.apk" \
            --repo aragontechsolutions-dev/prodhin-releases \
            --title "$GITHUB_REF_NAME" --notes "Release $VER"

      # Actualiza update.json en el repo público
      - name: Actualizar update.json
        env:
          GH_TOKEN: ${{ secrets.RELEASES_TOKEN }}
        run: |
          VER="${GITHUB_REF_NAME#v}"
          URL="https://github.com/aragontechsolutions-dev/prodhin-releases/releases/download/$GITHUB_REF_NAME/prodhin-$VER.apk"
          git clone https://x-access-token:${GH_TOKEN}@github.com/aragontechsolutions-dev/prodhin-releases.git rel
          cd rel
          printf '{\n  "latestVersion": "%s",\n  "apkUrl": "%s",\n  "mandatory": false,\n  "notes": "Release %s"\n}\n' "$VER" "$URL" "$VER" > update.json
          git config user.name "ci"; git config user.email "ci@prodhin"
          git commit -am "release $VER"
          git push
```

## Flujo resultante

1. Subís `version` en `app.json` y `APP_VERSION` en `appVersion.ts`, commit.
2. `git tag v1.2.0 && git push origin v1.2.0`.
3. GitHub compila, firma, publica la APK y actualiza `update.json` solo.

## Cuándo conviene dar este paso

- Si empezás a sacar versiones seguido y el build local se hace tedioso.
- Si querés que otra persona pueda publicar sin tener el entorno armado.

Para 1 camión / pocas versiones al mes, el script `publish-release.ps1` ya
alcanza. Dejá esto anotado para cuando escale.
