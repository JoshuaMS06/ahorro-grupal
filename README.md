# AhorroGrupal — Bloque 3 (fondos separados y avance semestral)

**Versión de VALIDACIÓN. No publicar todavía en GitHub, Vercel ni Firebase.**

Proyecto real: `C:\Proyectos\AppAhorro`.

## Cambios que contiene este paquete

- Cada pago nuevo de la **generación que comenzó en el 507 en 2026-2027-A** es único de **$20**: $10 para su ahorro exclusivo y $10 para el fondo de carrera. Esta condición identifica a la generación, NO a cualquier salón que se llame 507 en el futuro.
- Los otros salones registran un pago nuevo de **$10**, totalmente para la carrera.
- Las cuotas históricas del módulo `/ahorro/integrantes` (20 pesos cada una) siguen **al 100 % en el fondo del grupo**. No se modifican ni se duplican.
- Nuevo informe privado con **ahorro propio de la generación especial**, **aportación de la generación al fondo común** y **saldo total de carrera**. El informe exige autenticación de administrador general o responsable de la sala solicitada y no incluye datos personales.
- Los retiros nuevos identifican el fondo (`grupo` o `carrera`); el servidor no permite que el fondo de carrera se descuente del fondo propio. Un retiro aprobado que carezca de clasificación se señala para revisión manual.
- Avance semestral (107→207, 307→407, 507→607, 707→807, 907→1007, 1007→archivo). La cuota especial de $20 permanece con la generación, incluso cuando sea 607. Se copian únicamente los integrantes; no se copian pagos ni retiros. El nuevo periodo se crea vacío de movimientos y el anterior se archiva.
- El admin general debe **programar expresamente el lunes de cambio y el periodo destino** en «Ciclos y salones». Sin fecha configurada, la tarea diaria no realiza cambios. No se avanza si hay solicitudes de retiro pendientes. La nueva tarea cron está protegida por `CRON_SECRET`.

## Preparación local

1. Mantén guardado el respaldo privado de Firebase fuera del repositorio y de cualquier carpeta pública.
2. En tu misma carpeta `C:\Proyectos\AppAhorro`, extrae el ZIP **directamente sobre los archivos del proyecto**. No borres la carpeta ni sustituyas tu `package-lock.json` por uno anterior (el ZIP no lo incluye).
3. Abre PowerShell en esa carpeta. Ejecuta **un comando por vez**:

   ```powershell
   npm install
   npm test
   npm run build
   npm audit
   ```

4. Comprueba que `npm test` tenga **al menos 33 pruebas**, todas aprobadas, y que el build no tenga errores. El aviso de tamaño del paquete no es error.
5. **Prueba las reglas con el emulador antes de publicarlas en Firebase**:

   ```powershell
   firebase emulators:exec --project demo-ahorro-grupal --only database "node --test tests-emulator/roles.rules.test.mjs"
   ```

6. NO copies los datos de producción al emulador si pueden exponerse. Utiliza el script de demostración local y usuarios ficticios para validar permisos y pagos.
7. Cuando todo pase, revisa visualmente el panel y el formato de cada fondo. En `npm run dev`, la función `/api/resumen-carrera` no se ejecuta con Vite solo: en el sitio real funciona por Vercel, pero requiere probar antes que las credenciales privadas estén bien configuradas.

## Validación adicional ANTES de publicar

- Abrir la pestaña «Responsables» como admin general y validar que un responsable vea sólo su salón.
- Confirmar las cifras del respaldo: cinco salones, 119 estudiantes, **54 cuotas históricas de $20** en el 507 = **$1,080 sólo del fondo propio** en la copia aportada. Si ya registraron pagos reales posteriores al respaldo, las cifras serán mayores.
- Hacer simulaciones de pago de $10 y $20, anulación, solicitud de retiro por fondo, rechazo y aprobación con datos de prueba.
- Simular el avance 107→207 y 507→607; constatar que no se transportan pagos, y que no hay avance doble.
- Probar en Vercel los endpoint privados antes de procesar retiros reales; GET sin credenciales de `/api/resumen-carrera` debe responder 400/401, nunca mostrar información privada.

## Límites y pendientes importantes

- **No se implementan todavía las bajas/reingresos ni las devoluciones individuales**: requieren saldo por estudiante y un procedimiento de pago comprobable. No se deben usar retiros genéricos como sustituto de una devolución individual.
- El archivo de semestre 1007 conserva el historial para administración, pero los casos de devolución posteriores al cierre necesitarán el módulo individual antes de activarlo en producción.
- La tarea automática se programa para ejecutarse una vez al día y podría correr dentro de la hora de inicio indicada por Vercel. Si queda «migracionEnCurso» por una falla, **no borres ni reinicies datos manualmente**; revisa los registros del servidor y el destino antes de reintentar.
- En esta entrega no se modificó Firebase ni se realizaron publicaciones remotas.
- Para evitar mezclar dinero, **no publiques parcialmente** frontend, API y reglas: deben validarse como un bloque coherente.
