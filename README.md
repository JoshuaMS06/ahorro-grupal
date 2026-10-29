# AhorroGrupal — Bloque 2: roles y permisos por salón (SOLO PRUEBAS)

**No desplegar en Vercel, no hacer `git push` y no publicar todavía las nuevas reglas de Firebase.** Esta es una versión de desarrollo local para comprobar la seguridad antes de reemplazar el proyecto actual.

## Funciones implementadas

- **1 administrador general** cuyo UID se almacena en `roles/adminGeneralUid` (string). Esa ruta solo puede modificarse desde Firebase Console o mediante una operación privilegiada, no desde la app.
- **2 plazas por salón y ciclo escolar**, administradas desde la pestaña «Responsables». Cada plaza contiene un UID de Firebase Authentication.
- El administrador general puede ver todos los grupos, dar de alta estudiantes, importar listas, cerrar periodos, corregir pagos, aprobar/rechazar retiros y asignar/revocar responsables.
- Cada responsable ve **únicamente su grupo y ciclo**, registra aportaciones nuevas y solicita retiros; **no puede aprobar retiros, anular pagos, cambiar estudiantes, crear ciclos ni asignar permisos**.
- Al revocar un UID se corta el acceso a datos de su salón sin borrar pagos ni estudiantes.
- Se conserva el sistema de una caja por salón, las cuotas de $10 para 107/307/707/907 y $20 para 507, nombres cortos, ícono y PWA. Sin alterar los datos ya guardados.
- El administrador general no se ha elegido todavía: **debe seleccionarse expresamente cuál de las cuentas actuales tendrá el cargo** antes de cualquier migración.

## Probar sin usar Firebase real (recomendado)

1. Copia la carpeta actual `C:\Proyectos\AppAhorro` a `C:\Proyectos\AppAhorro-Pruebas` (incluye archivos de Git solo si realmente los necesitas; no hagas `git push`).
2. Extrae el ZIP del Bloque 2 directamente en **AppAhorro-Pruebas**. Conserva el proyecto original intacto.
3. Abre la copia en VS Code / PowerShell y ejecuta:

   ```powershell
   npm install
   npm test
   npm run build
   npm install -g firebase-tools
   firebase emulators:start --project demo-ahorro-grupal --only database,auth
   ```

4. Mantén esa terminal abierta. Abre una SEGUNDA terminal en la misma carpeta:

   ```powershell
   node scripts/crear-demostracion-local.mjs
   npm run dev
   ```

5. Entra a la dirección local que muestre Vite (normalmente http://localhost:5173). Verás la app conectada a Firebase **EMULATOR**, no al proyecto de producción. Prueba las cuentas ficticias:

   - General: `general@pruebas.local`
   - Responsable 107: `responsable107@pruebas.local`
   - Responsable 307: `responsable307@pruebas.local`
   - Contraseña temporal para las tres: `DemoAhorro2026!` (**solo para emuladores**).

6. Confirma que el administrador general ve los tres salones de prueba, puede abrir «Responsables» y gestionar las plazas. Confirma que 107 no puede ver el 307, y viceversa. Comprueba que solo el general puede aprobar retiros y anular pagos. Los datos de prueba son completamente ficticios.
7. **Nunca utilices estos correos ni esta contraseña de demostración en producción.**

El proyecto usa los emuladores por defecto solo durante `npm run dev`. Para no usarlos explícitamente en desarrollo, configura `VITE_USE_FIREBASE_EMULATORS=false` en un archivo `.env.local`, **pero no lo hagas durante estas pruebas**. En `npm run build` de producción la app siempre utiliza Firebase real.

## Prueba automatizada real de reglas (opcional, pero recomendada antes de publicar)

En una copia de pruebas con los emuladores disponibles:

```powershell
npm install --no-save @firebase/rules-unit-testing
firebase emulators:exec --project demo-ahorro-grupal --only database "node --test tests-emulator/*.test.mjs"
```

`tests-emulator/roles.rules.test.mjs` comprueba lecturas y escrituras permitidas/denegadas, intentos entre salones, pagos, retiros y revocaciones. El comando no tiene acceso a datos reales. Las pruebas `npm test` validan lógica de aplicación, **pero no sustituyen estas pruebas de reglas**.

## Migración a producción — NO EJECUTAR TODAVÍA

1. Respaldar `ahorro`, `periodos`, `aulas`, `adminUids` y las reglas actuales de Realtime Database.
2. Elegir cuál de las dos cuentas de administrador existentes será el **único administrador general** y confirmar su UID exacto (sin espacios).
3. Crear en la raíz de RTDB el nodo `roles/adminGeneralUid` como **String**, con ese UID. No eliminar los datos existentes ni las cuentas de Firebase Authentication.
4. Solo tras las pruebas, publicar `firebase-database.rules.json` (y mantener una copia de las anteriores). Las reglas nuevas dejan de usar `adminUids` como fuente de permisos globales; el nodo viejo queda como legado sin capacidad de crear más administradores.
5. Crear cuentas de los 10 responsables en Firebase Authentication, una por persona. Desde «Responsables» asignar 2 UID por salón y verificar su acceso en teléfonos diferentes.
6. Verificar que el usuario sin permiso no lee listas; que un responsable 107 no lee/modifica 307; que no puede aprobar retiros ni modificar las reglas; y que el admin general puede seguir viendo el historial anterior del 507.
7. Publicar únicamente después de superar esas comprobaciones y revisar el historial. Conservar el ZIP/commit anterior para revertir si hiciera falta.

**Nota de seguridad:** los responsables pueden registrar pagos nuevos de su salón pero no anular históricos. El administrador general sigue siendo un usuario privilegiado, por lo que una futura fase de auditoría con servidor y registros inmutables es recomendable. El calendario semanal y los pagos existentes no se reescriben.
