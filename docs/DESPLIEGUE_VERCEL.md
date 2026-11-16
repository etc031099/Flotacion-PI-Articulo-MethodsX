# Despliegue de FlotaLab

Fecha: 16 de noviembre de 2026. URL de producción: **https://flotacion-pi-methodsx.vercel.app**. Acceso anónimo HTTP 200 comprobado con curl, Chrome y Edge. Es la dirección que debe incluirse en el informe; no utilizar direcciones de preview ni localhost.

## Proyecto y construcción

- Cuenta CLI verificada: `lumanvil-5502`; espacio `undac-proy` (UNDAC_PROY).
- Proyecto nuevo: `flotacion-pi-methodsx`. No se modificó el proyecto preexistente `proy_api2`.
- Git: https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX, rama de producción `main`, directorio raíz del repositorio.
- Framework Preset: Other (`framework: null`). Sitio estático, sin funciones ni Python en Vercel.
- Install Command: `npm ci --omit=dev --ignore-scripts`.
- Build Command: `node scripts/build-static.mjs`.
- Output Directory: `dist`.
- El build usa sólo Node y copia 22 archivos explícitos. La auditoría pública sustituye la ruta del PDF original por una descripción portable. No hay rutas Windows en dist.
- `.vercelignore` limita las fuentes subidas por CLI; el directorio publicado lo determina el manifiesto de build. El ZIP está en GitHub Releases, fuera del bundle web.
- Cabecera `X-Content-Type-Options: nosniff`; `index.html` sin caché persistente. No hay variables secretas requeridas.

## Acciones realmente realizadas

Se revisaron estructura, `.gitignore`, `git status`, ausencia de remoto y patrones de credenciales antes del staging. El repositorio no existía: se creó uno exclusivo y se verificó que el remoto proporcionado por el usuario estaba vacío. El usuario autorizó Vercel y renovó GitHub por sus flujos oficiales de dispositivo; no se guardaron tokens en el proyecto.

```powershell
git init -b main
git remote add origin https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX.git
git add -- .gitignore .vercelignore index.html web configs schemas scripts tests docs examples flotation README.md package.json package-lock.json vercel.json INICIAR_PYTHON.bat LEEME_PYTHON.txt comprobar_dependencias.py configuracion_servidor.json requirements-api.txt requirements-dev.txt requirements-python.lock.txt servidor.py simulacion_flotacion.py
git diff --cached --stat
git diff --cached --name-only
git commit -m "Publica FlotaLab estatico y paquete Python con CORS de produccion"
git push -u origin main
```

Commit inicial publicado: `6b84922`. Se publican después las guías y pruebas de fase 4 con staging explícito de sus rutas. No se usó `git add .`. Entornos, cachés, temporales, capturas, entrega y credenciales están ignorados.

El CLI Vercel 65.16.0 se instaló únicamente en `tmp/vercel-cli`, fuera de las dependencias de producción. Los comandos `vercel` siguientes se ejecutaron mediante `tmp/vercel-cli/node_modules/.bin/vercel.cmd`:

```powershell
vercel login
vercel whoami
vercel teams ls
vercel deploy --prod --yes --name flotacion-pi-methodsx --scope undac-proy
vercel git connect https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX.git --yes --scope undac-proy
vercel ls flotacion-pi-methodsx --scope undac-proy
```

Primer build: falló porque `*` en `.vercelignore` excluía subdirectorios pese a negaciones. Se corrigió a `/*`, con directorios permitidos y exclusiones internas. Segundo build CLI: READY, despliegue `dpl_Fof4uaPr1juaLg3468VgUPm7ZNdb`. El push a GitHub generó también producción READY: `https://flotacion-pi-methodsx-p5xz85vqn-undac-proy.vercel.app`. El alias estable permanece https://flotacion-pi-methodsx.vercel.app.

La producción es pública sin bypass ni token. Las URLs de inspección o previews pueden exigir autenticación; no se entregan como URL docente. El enlace Git quedó confirmado por `vercel git connect` y por el despliegue automático posterior al push.

## Entrega Python

Release: https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/tag/v1.0.0.

Descarga: https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/download/v1.0.0/Python_Flotacion.zip.

ZIP: 19 187 bytes, 16 archivos. SHA-256: `c68a64c529d9fb9f92afb5abf036da091efdff3d2b25553e25806cb83a1447aa`. Descargado realmente desde la página publicada; el hash coincide con el ZIP local validado. No se distribuye `.venv`.

## Mantenimiento

Los pushes a `main` despliegan el sitio. Mantener la URL estable: cambiarla exige actualizar `url_web`, LEEME, enlaces y regenerar/validar/republicar el paquete. Un preview distinto no está autorizado por CORS. No se necesita un backend remoto ni túnel.

Fuentes: [lista de exclusiones Vercel](https://vercel.com/docs/deployments/vercel-ignore), [despliegue CLI](https://vercel.com/docs/projects/deploy-from-cli), [inicio de sesión](https://vercel.com/docs/cli/login). La guía de incorporación solicitada en el mensaje de autorización se consultó en https://vercel.com/get-started.md; se reutilizó el CLI autenticado. La integración MCP opcional sugerida no se presenta como instalada: la publicación se realizó y comprobó con el CLI oficial.
