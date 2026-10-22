# Ahorro Grupal — versión renovada 🐷

## NUEVO — SEMANAS AUTOMÁTICAS (22 de octubre de 2026)

**Lee primero `SEMANA_AUTOMATICA_LEEME_PRIMERO.txt`.** La semana 4 inicia el lunes 19 de octubre de 2026; desde el lunes 26 a las **00:00 (America/Mexico_City)** la aplicación mostrará semana 5, luego semana 6 el 2 de noviembre y así sucesivamente. La interfaz cambia sin acciones del administrador y sin modificar los pagos.

En Vercel se añadió un cron semanal (`0 6 * * 1`, UTC) para guardar el número en `ahorro/semana` aun cuando nadie abra la app. **Debes agregar en Vercel las variables secretas `CRON_SECRET` y `FIREBASE_SERVICE_ACCOUNT_JSON`** para que funcione la sincronización desatendida. Sin estas variables, el calendario visual sigue funcionando y un administrador autenticado puede sincronizar Firebase al entrar. El plan Hobby no garantiza exactitud horaria del cron (puede ejecutarse dentro de la hora).

El botón manual de avanzar semana se retiró para prevenir dobles incrementos. El diseño morado, el cerdito, Firebase Auth y todas las aportaciones se mantienen.

---

PWA responsive en **React + Vite**, con **Firebase Realtime Database** y **Firebase Authentication**.
Se conservan el proyecto Firebase `ahorro-grupal-industrial` y las rutas originales `ahorro/semana` y `ahorro/integrantes/<nombre>/pagos`. **El código no elimina ni reinicia pagos existentes**.

## Ajustes visuales (22 de octubre de 2026)

- Fondo, tarjetas y acentos en tonos morado oscuro; cerdito con fondo violeta.
- Retirados los textos promocionales solicitados y la banda de motivación.
- El encabezado de ahorro total ahora muestra únicamente «$20 por semana».
- Eliminado el texto «Sincronizado con Firebase». El enlace a Firebase continúa funcionando normalmente.
- No se cambiaron las consultas de Firebase, las credenciales, los controles de administrador ni las reglas.
- Actualizados el color de PWA y la versión de caché para que la app instalada reciba la nueva apariencia.

## Novedades

- Interfaz morado/oscuro para móviles, tabletas y escritorio, con búsquedas, filtros y perfil fijado.
- Cerdito con fondo violeta para favicon, pantalla de inicio, iconos instalables y marca visual.
- Idioma español (`es-MX`, etiquetas en español y supresión de sugerencias automáticas de traducción de Google).
- PWA instalable en Chrome/Edge compatibles e instalable desde Safari en iOS por "Añadir a pantalla de inicio".
- Acceso administrativo real por correo y contraseña en Firebase Authentication, autorizado por **UID** en reglas de Realtime Database.
- Escrituras atómicas (`runTransaction`) para evitar perder actualizaciones simultáneas.
- Totales, pendientes y semanas calculados a partir de la base actual, sin duplicar registros.

## 1. Probar en VS Code

Abrir esta carpeta en VS Code. En Terminal:

```powershell
npm install
npm run dev
```

Abrir la URL local mostrada, generalmente `http://localhost:5173`.

Para verificar la compilación:

```powershell
npm run build
```

## 2. IMPORTANTE: configurar los administradores en Firebase

El formulario anterior que solo pedía un correo **NO era una autenticación segura**. Por seguridad ahora requiere cuenta real y lista de usuarios autorizados.

1. Abrir Firebase Console → proyecto **ahorro-grupal-industrial** → **Authentication** → **Sign-in method**.
2. Habilitar **Correo electrónico/contraseña**.
3. En Authentication → **Users**, agregar una cuenta con correo y contraseña para cada administrador. Mantener las contraseñas privadas (no escribirlas en el código ni en GitHub).
4. Copiar el **UID** de cada cuenta desde la tabla de usuarios en Authentication.
5. En **Realtime Database → Datos** agregar una nueva clave **`adminUids`** en la raíz (al lado de `ahorro`, no dentro). Dentro agregar cada UID como clave y asignarle el valor booleano **true** (no la cadena "true"). Ejemplo, usando IDs ficticios:

```json
{
  "ahorro": { "semana": 1, "integrantes": { "Ejemplo": { "pagos": 0 } } },
  "adminUids": {
    "UID_DEL_ADMIN_1": true,
    "UID_DEL_ADMIN_2": true
  }
}
```

**No importes el JSON de ejemplo completo:** `ahorro` en el ejemplo es ilustrativo. **No borres, sustituyas ni importes encima del árbol `ahorro` real**, ya que contiene las aportaciones reales. Crea solo `adminUids` y sus entradas en la consola, dejando lo demás intacto.

6. En **Realtime Database → Reglas**, reemplazar las reglas con el contenido de `firebase-database.rules.json` y **Publicar**.
7. Probar desde una ventana privada: cualquier persona debería poder **consultar**; solo el usuario autorizado y autenticado podrá **escribir** o avanzar semanas.

**Nota de privacidad:** La lectura pública de `ahorro` significa que nombres, montos y estado de aportaciones serán visibles para quien visite la página (igual que en el diseño actual). Confirma que el grupo autoriza esta publicación. Si se necesita privacidad, habría que introducir acceso para integrantes y cambiar las reglas de lectura.

**Nota sobre cambios pendientes:** Si el árbol `ahorro` todavía está vacío, inicia sesión como administrador y utiliza el botón **Crear lista inicial**. La operación solo crea el árbol cuando no existe; si ya existe, **no borra ningún pago**.

**No dejes reglas como `.write: true` para una página pública.** El formulario por sí solo no protege la base: debes publicar las reglas adjuntas.

## 3. Instalar la página como app

Esta PWA funciona bajo **HTTPS** (Vercel) o `localhost`. Incluye manifest, iconos de 192 y 512 px, iconos maskable y service worker.

- **Windows/macOS/Linux:** en Chrome o Edge, abrir la página y elegir el ícono Instalar de la barra de direcciones (o menú → Instalar aplicación).
- **Android:** en Chrome, menú ⋮ → Instalar aplicación o Añadir a pantalla principal.
- **iPhone/iPad:** abrir en **Safari**, usar Compartir → **Añadir a pantalla de inicio**.

El botón **Instalar app** dentro de la página ofrece ayuda y, cuando el navegador lo permite, muestra la instalación automática. La compatibilidad exacta depende de navegador, versión y dispositivo; algunos navegadores solo permiten añadir un acceso a inicio.

**Modo sin conexión:** el service worker almacena la interfaz, pero las lecturas en tiempo real y los cambios de aportaciones requieren conectividad y permisos válidos de Firebase. No guarda movimientos de dinero localmente.

## 4. Publicar en GitHub y Vercel

Desde la terminal de VS Code dentro de esta carpeta, en el repositorio que **ya está enlazado a tu GitHub**, si sustituiste los archivos del proyecto existente:

```powershell
git add .
git commit -m "Rediseño Ahorro Grupal, icono y PWA"
git push origin main
```

Vercel desplegará el nuevo commit si el repositorio correcto ya está conectado, sin desplegar manualmente. La configuración es **Vite**, build command `npm run build`, output directory `dist`. Si la rama de producción es distinta a `main`, usa su nombre.

**No subas `node_modules`, `dist`, contraseñas ni llaves privadas**. El `.gitignore` del proyecto ya omite dependencias y compilación.

Tras desplegar, comprueba `https://ahorro-grupal.vercel.app/` en incógnito y actualiza con Ctrl+F5 si tienes la versión anterior en caché. La protección de Vercel se cambia por separado en Vercel → Settings/Security → Deployment Protection; este ZIP no modifica aquella configuración.

## Archivos relevantes

- `src/App.jsx`: aplicación y Firebase (conserva configuración original).
- `src/App.css`, `src/index.css`: diseño adaptable.
- `index.html`: idioma español, títulos, metas, iconos y manifest.
- `public/favicon.png`: icono de la pestaña.
- `public/icons/`: iconos para instalación.
- `public/manifest.webmanifest`: configuración PWA.
- `public/sw.js`: caché de la interfaz, nunca de Firebase.
- `firebase-database.rules.json`: **reglas que debes publicar manualmente en Firebase**.
