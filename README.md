**NOVEDAD BLOQUE 1 (2026-10-28):** Lee `LEEME_BLOQUE_1_CUOTAS_Y_AVATARES.txt`. La cuota es $20 para 507 y $10 para los demás grupos. Aún NO se implementan permisos por salón ni promociones de semestres.

# AhorroGrupal — versión multi-salón, ciclo escolar 2026–2027 A

App web instalable (PWA) con Firebase Authentication + Realtime Database y Vercel. **Esta versión requiere configurar reglas nuevas e importar las listas. No publiques sin respaldar la base y probarla.**

## Qué cambió

- Un fondo único por salón, con **$10 MXN por semana** para 107/307/707/907 y **$20 MXN** para 507. Los importes de pagos anteriores se conservan.
- Salones y ciclos independientes: 107, 307, 507, 707 y 907 en el archivo de importación. En el futuro el administrador puede crear otros ciclos y salones.
- Registro de pago por semana, alumno y administrador, sin doble pago activo de una misma semana.
- Estado «Pagó» o «Pendiente» **de la semana seleccionada**; no muestra cantidades adeudadas, semanas de deuda acumuladas ni un resumen mensual.
- Historial de pagos nuevos con fecha de registro; anulaciones permanecen visibles en el historial.
- Avisos de solicitud, aprobación y rechazo de retiros. Solo al **aprobar** el retiro se descuenta del saldo visible. Los mensajes se sincronizan en tiempo real; avisos del dispositivo opcionales mientras la app está abierta (NO push con la app cerrada).
- Directorio de ocho profesores; no se consideran integrantes ni deudores.
- Cerdito morado, PWA instalable, pantalla en español y tarea automática de Vercel intactos.

## Privacidad de los estudiantes

Se leyeron las hojas **107, 307, 507, 707, 907** del Excel. La hoja «Todos» es un concentrado y **no** se importó como salón adicional. El archivo `datos_importacion/salones_2026-2027-A.json` contiene **119 nombres**, distribuidos 51 + 26 + 19 + 16 + 7. Se excluyeron CURP, fecha y lugar de nacimiento, sexo, estatus y números de control. Solo los nombres se importan. La carpeta `datos_importacion` está en `.gitignore` para que no se suba al repositorio accidentalmente.

**Atención:** las reglas actuales autorizan consulta pública a `aulas` (nombres y estados de pago). Si los integrantes no deben ser públicos, antes de utilizar datos reales hay que diseñar un acceso autenticado por estudiante; esta versión conserva la consulta pública de la app anterior para no bloquear a los compañeros.

## Instalación y publicación segura — en este orden

1. **Respaldar Firebase:** Firebase Console → Realtime Database → Data → menú de tres puntos → Export JSON. Guarda el archivo fuera del repositorio.
2. Guarda una copia de tu carpeta actual `AppAhorro`.
3. Extrae este ZIP **directamente en `AppAhorro`**, reemplazando archivos y conservando `.git` y variables privadas. No se incluyen `node_modules` ni `.git`.
4. En Firebase Console → Realtime Database → Rules, revisa y publica las reglas de `firebase-database.rules.json` **solo si esa base contiene `ahorro`, `adminUids` y los nuevos nodos**. Las reglas nuevas añaden `periodos` y `aulas`. Conserva los UID que ya funcionan. No actives `.write: true` públicamente.
5. En VS Code, terminal del proyecto:

   ```powershell
   npm install
   npm test
   npm run build
   npm run dev
   ```

6. En tu navegador local, inicia sesión con el administrador de Firebase Authentication. Abre **«Ciclos y salones»**, selecciona `datos_importacion/salones_2026-2027-A.json` con el selector de archivos, comprueba que indica **5 salones y 119 estudiantes** y presiona **Confirmar importación segura**.
7. **Antes de publicar**, comprueba salón 507: los totales históricos anteriores ($20 por pago) deben coincidir con tu base `ahorro/integrantes`. Esos importes quedan intactos y se suman al nuevo historial, pero **NO se les inventan semanas ni fechas exactas**. Por precaución, el registro detallado del 507 comienza a partir de la semana siguiente al momento de importar; los otros salones empiezan en la semana actual al importar. (Puedes ajustar el campo `inicioDetalle` de la configuración del salón si haces primero una conciliación real de pagos.)
8. Prueba un pago nuevo de $10 en 107 y otro de $20 en 507, anúlalos y comprueba ambos historiales. Prueba solicitar un retiro, aprobarlo y verificar que cambie el saldo. **No uses fondos reales para estas pruebas**; si lo haces en producción, registra movimientos de prueba en un salón de pruebas y deja la caja conciliada.
9. Publica en GitHub y Vercel cuando las pruebas sean correctas:

   ```powershell
   git add .
   git status
   git commit -m "Escalar AhorroGrupal a salones y ciclos con pagos de 20"
   git push origin main
   ```

   Comprueba con `git status` que **no** estás agregando el JSON de estudiantes, archivos de credenciales o respaldo de Firebase. **Nunca subas el respaldo ni la clave privada a GitHub**.

## Datos y compatibilidad

Se conserva sin modificar el nodo antiguo `ahorro` (y el cron `/api/actualizar-semana` sigue actualizando únicamente `ahorro/semana`). El salón 507 del ciclo `2026-2027-A` incorpora en los totales las contribuciones anteriores de `ahorro/integrantes`, usando las 19 equivalencias de nombres. Los nuevos pagos se guardan en:

```text
periodos/{ciclo}/meta
periodos/{ciclo}/salones/{salon}
aulas/{ciclo}/{salon}/meta
aulas/{ciclo}/{salon}/integrantes/{id}
aulas/{ciclo}/{salon}/pagos/{id}_s{semana}
aulas/{ciclo}/{salon}/retiros/{id}
```

El saldo por salón se calcula como **ingresos anteriores (solo 507) + pagos semanales confirmados − retiros aprobados**. Los retiros solicitados o rechazados no descuentan dinero. Las anulaciones de aportaciones conservan sus detalles en el registro; para agregar otra vez una semana anulada se conserva la información de corrección en la misma entrada. Los cambios administrativos se protegen con `adminUids` y Firebase Security Rules. **No son registros inmutables frente a un administrador privilegiado**; para auditoría completa y reportes firmados sería necesaria una fase adicional con funciones de servidor.

## Escalar año tras año

Cada ciclo almacena su `lunesBase` (lunes de inicio) y `semanaBase`. La aplicación calcula automáticamente la semana correcta en horario `America/Mexico_City`, independientemente del cron anterior. El administrador puede archivar un ciclo cuando termina (se congela la última semana y no se aceptan más movimientos desde la interfaz; resuelve primero los retiros pendientes). Después crea un nuevo ciclo (por ejemplo `2027-2028-A`) y nuevos salones sin borrar los viejos; después agrega alumnos individualmente o importa otro JSON de listas con la misma estructura. Los integrantes de años anteriores **no se copian automáticamente** para evitar asignar pagos a alumnos que ya cambiaron de grupo.

## Profesores

Ubaldo Jerónimo Carrera; Nicolas Hernández Ruiz; Rafael Rios Esperanza; Francisco Javier Sol Sampedro; Eduardo Martínez Mendoza; Néstor Hernández Silva; Adán Acosta Banda; Tania Castillo Villegas. Directorio general, sin asignación específica a salones (el Excel no contiene ese dato).

## Limitaciones actuales

- No hay push remoto con la PWA cerrada, solo avisos en pantalla y notificación local mientras está abierta, previo permiso.
- Una solicitud de retiro solo puede crearla una cuenta administradora autenticada, porque no hay cuentas individuales de estudiantes todavía. Los demás sí pueden consultar los avisos.
- La base del ciclo 507 conserva contadores históricos sin fechas de aportación. Requiere conciliación manual para construir un historial semanal anterior verificable.
- La función de cron existente en Vercel actualiza solo el contador antiguo; los salones/ciclos nuevos calculan la semana automáticamente al abrir la app.
- No se publica resumen mensual de ingresos/egresos, como solicitaste.

## Reversión

Antes de publicar, guarda tu ZIP anterior y el respaldo de Firebase. Si debes revertir, hazlo desde Git/Vercel y revisa los nodos nuevos; no restaures un JSON antiguo sobre la base completa sin respaldar antes los movimientos generados después de la publicación.
