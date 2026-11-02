// Prueba integrada del endpoint: SOLO emuladores locales de Firebase.
// Ejecutar con: firebase emulators:exec --project demo-ahorro-grupal --only auth,database "node --test tests-emulator/activar-reinicio.api.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';

const PROJECT = 'demo-ahorro-grupal';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
// Los datos de prueba se cargan con Firebase Admin SDK conectado al emulador.
// auth=owner en REST no evita siempre las reglas y provocó 401 Permission denied.

if (process.env.VERCEL || process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw Error('Prueba detenida: entorno de producción o credenciales privadas detectadas. No ejecutar con secretos reales.');
}
for (const [name, expected] of [
  ['FIREBASE_DATABASE_EMULATOR_HOST', '127.0.0.1:9000'],
  ['FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099'],
]) {
  if (process.env[name] !== expected) {
    throw Error(`Prueba detenida: ${name} debe ser exactamente ${expected}. Arranca ambos emuladores locales.`);
  }
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROJECT) {
  throw Error('Prueba detenida: proyecto distinto al demo.');
}
// adminServidor exige explícitamente esta marca para aceptar el emulador.
process.env.AHORRO_DEMO_EMULADOR = 'true';

const { default: handler } = await import('../api/activar-reinicio.js');

async function authDemo(correo) {
  const respuesta = await fetch(`${AUTH}/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: {'Content-Type': 'application/json', 'Connection':'close'}, signal: AbortSignal.timeout(10000),
    body: JSON.stringify({email: correo, password: 'DemoAhorro2026!', returnSecureToken: true}),
  });
  const datos = await respuesta.json();
  assert.equal(respuesta.status, 200, `No se creó usuario emulado: ${JSON.stringify(datos.error || datos)}`);
  return {uid: datos.localId, token: datos.idToken};
}

async function database(action = 'GET', root) {
  // Solo para esta prueba: la instancia Admin tiene permisos de servidor en
  // el emulador. Los clientes siguen sometidos a firebase-database.rules.json.
  // lib/adminServidor.js bloquea cualquier intento de usar credenciales reales
  // mientras AHORRO_DEMO_EMULADOR y ambos hosts locales estén configurados.
  const { adminDatabase } = await import('../lib/adminServidor.js');
  const referencia = adminDatabase().ref('/');
  if (action === 'PUT') {
    await referencia.set(root);
    return root;
  }
  if (action === 'GET') return (await referencia.get()).val();
  throw new Error(`Acción de base de datos no prevista en la prueba: ${action}`);
}

async function llamar(method, token = '', body) {
  const req = {method, headers: token ? {authorization: `Bearer ${token}`} : {}, body};
  let status = 200;
  let resultado;
  const res = {
    setHeader() {return this;},
    status(n) {status = n; return this;},
    json(data) {resultado = data; return this;},
  };
  // Mantener el temporizador activo permite diagnosticar promesas colgadas
  // en vez de terminar con "Promise resolution is still pending...".
  let temporizador;
  try {
    await Promise.race([
      handler(req, res),
      new Promise((_, reject) => {
        temporizador = setTimeout(() => reject(new Error(
          `La API no respondió a ${method} en 15 segundos; verifica los emuladores.`,
        )), 15000);
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
  return {status, body: resultado};
}

// Un único test secuencial evita modificar simultáneamente la base del emulador.
test('API activación: validación de administrador, diagnóstico y escritura única en DEMO', {timeout: 45000}, async () => {
  let etapa = 'inicio';
  try {
  // Las comprobaciones locales anteriores ya impiden conectar a Firebase real.
  console.log('[DEMO] Creando cuentas ficticias en Authentication Emulator...');
  etapa = 'crear cuenta general';
  const general = await authDemo('general-integracion@pruebas.local');
  etapa = 'crear cuenta no administradora';
  const ajeno = await authDemo('ajeno-integracion@pruebas.local');
  const salones = ['107','307','507','707','907'];
  const datos = {
    roles: {adminGeneralUid: general.uid},
    ahorro: {semana: 5, integrantes: {legado: {nombre: 'Dato histórico privado de prueba'}}},
    periodos: {'2026-2027-A': {
      meta: {nombre: '2026-2027 A', lunesBase: '2026-10-19', semanaBase: 4},
      salones: Object.fromEntries(salones.map(s => [s, {nombre: `Salón ${s}`}]))
    }},
    aulas: {'2026-2027-A': Object.fromEntries(salones.map(s => [s, {
      meta: {cuotaSemanal: s === '507' ? 20 : 10, inicioDetalle: s === '507' ? 6 : 5},
      integrantes: {ejemplo: {nombre: 'Estudiante ficticio'}},
      ...(s === '507' ? {pagos: {pagoAntiguo: {estado: 'pagado', semana: 5, monto: 20, creadoEn: 12345}}} : {}),
    }]))},
  };
  etapa = 'cargar datos ficticios en Realtime Database Emulator';
  console.log('[DEMO] Preparando datos ficticios...');
  await database('PUT', datos);

  etapa = 'rechazar acceso sin sesión';
  console.log('[DEMO] Validando acceso sin sesión...');
  const sinSesion = await llamar('GET');
  assert.equal(sinSesion.status, 401, `Respuesta sin sesión: ${JSON.stringify(sinSesion.body)}`);
  etapa = 'rechazar acceso de usuario ajeno';
  console.log('[DEMO] Validando permisos de usuario ajeno...');
  const noAdmin = await llamar('GET', ajeno.token);
  assert.equal(noAdmin.status, 403, `Respuesta usuario ajeno: ${JSON.stringify(noAdmin.body)}`);
  etapa = 'diagnóstico del administrador';
  console.log('[DEMO] Consultando diagnóstico de administrador...');
  const diagnostico = await llamar('GET', general.token);
  assert.equal(diagnostico.status, 200, JSON.stringify(diagnostico.body));
  assert.equal(diagnostico.body.listo, true);
  assert.equal(diagnostico.body.diagnostico.totalIntegrantes, 5);
  assert.equal(diagnostico.body.diagnostico.saldoInicial, 0);
  assert.equal(JSON.stringify(diagnostico.body).includes('Estudiante ficticio'), false);

  etapa = 'rechazar activación sin confirmar';
  console.log('[DEMO] Rechazando activación sin CONFIRMAR...');
  const sinConfirmar = await llamar('POST', general.token, {confirmacion: 'NO', respaldoConfirmado: true});
  assert.equal(sinConfirmar.status, 400);
  assert.deepEqual(await database(), datos, 'La base emulada no debe cambiar sin confirmar');

  etapa = 'activar ahorro una sola vez';
  console.log('[DEMO] Activando ahorro ficticio...');
  const activado = await llamar('POST', general.token, {confirmacion: 'CONFIRMAR', respaldoConfirmado: true});
  assert.equal(activado.status, 200, JSON.stringify(activado.body));
  assert.equal(activado.body.ok, true);
  const despues = await database();
  const marcador = despues.periodos['2026-2027-A'].meta.reinicioContable;
  assert.equal(marcador.version, 1);
  assert.equal(marcador.semanaInicio, 5);
  assert.ok(marcador.activadoEn > 0);
  delete despues.periodos['2026-2027-A'].meta.reinicioContable;
  assert.deepEqual(despues, datos, 'La activación no debe borrar ni modificar otros registros');

  etapa = 'rechazar segunda activación';
  console.log('[DEMO] Verificando bloqueo de una segunda activación...');
  const duplicado = await llamar('POST', general.token, {confirmacion: 'CONFIRMAR', respaldoConfirmado: true});
  assert.equal(duplicado.status, 409);
  console.log('[DEMO] Prueba integrada completada correctamente.');
  } catch (error) {
    console.error(`[DEMO] Error en la etapa: ${etapa}`);
    throw error;
  } finally {
    // El SDK Admin mantiene conexiones abiertas; cerrarlas evita esperas prolongadas al salir.
    const {getApps, deleteApp} = await import('firebase-admin/app');
    const app = getApps().find(x => x.name === 'ahorro-admin');
    if (app) {
      try {
        const {adminDatabase} = await import('../lib/adminServidor.js');
        adminDatabase().goOffline();
      } catch (error) {
        console.error('[DEMO] No se pudo desconectar el SDK Admin:', error?.message);
      }
      try {await deleteApp(app);} catch (error) {
        console.error('[DEMO] No se pudo liberar la aplicación Firebase:', error?.message);
      }
    }
  }
});
