import { sign } from 'node:crypto';
import { semanaActualMexico, ZONA_HORARIA_AHORRO } from '../lib/semanaAutomatica.js';

// Función privada de Vercel: únicamente modifica ahorro/semana.
// Se autentica con un OAuth2 de la cuenta de servicio; nunca se carga
// información privilegiada en el navegador, la PWA ni el repositorio.
const DATABASE_URL = 'https://ahorro-grupal-industrial-default-rtdb.firebaseio.com';
const OAUTH_URL = 'https://oauth2.googleapis.com/token';

function firmaJwt(json) {
  if (json.project_id !== 'ahorro-grupal-industrial' || !json.client_email || !json.private_key) {
    throw new Error('Las credenciales del servidor no corresponden al proyecto Ahorro Grupal.');
  }
  const segundos = Math.floor(Date.now() / 1000);
  const encabezado = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: json.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: OAUTH_URL,
    iat: segundos,
    exp: segundos + 3600,
  };
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${base64(encabezado)}.${base64(payload)}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), json.private_key).toString('base64url')}`;
}

async function tokenParaFirebase() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT_JSON en el proyecto Vercel.');
  let credenciales;
  try { credenciales = JSON.parse(raw); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no contiene JSON válido.'); }
  const solicitud = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: firmaJwt(credenciales),
    }),
    cache: 'no-store',
  });
  if (!solicitud.ok) throw new Error(`Error OAuth de Google: HTTP ${solicitud.status}`);
  const datos = await solicitud.json();
  if (!datos.access_token) throw new Error('Google no entregó un token de acceso.');
  return datos.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido.' });
  // Un endpoint con credenciales de servicio nunca puede quedar público.
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const semana = semanaActualMexico();
    const token = await tokenParaFirebase();
    const ruta = `${DATABASE_URL}/ahorro/semana.json`;
    const encabezados = { Authorization: `Bearer ${token}` };
    // Solo se modifica el nodo semana; jamás se sobreescriben integrantes o pagos.
    const actual = await fetch(ruta, { headers: encabezados, cache: 'no-store' });
    if (!actual.ok) throw new Error(`No se pudo consultar la semana: HTTP ${actual.status}`);
    const semanaGuardada = await actual.json();
    if (semanaGuardada === semana) {
      return res.status(200).json({ ok: true, semana, actualizado: false, zonaHoraria: ZONA_HORARIA_AHORRO });
    }
    // Asignación ABSOLUTA (idempotente), nunca "semana + 1". Aunque se ejecute
    // dos veces un lunes, no se duplica el avance ni se cambian aportaciones.
    const respuesta = await fetch(ruta, {
      method: 'PUT',
      headers: { ...encabezados, 'Content-Type': 'application/json' },
      body: JSON.stringify(semana),
      cache: 'no-store',
    });
    if (!respuesta.ok) throw new Error(`No se pudo sincronizar la semana: HTTP ${respuesta.status}`);
    return res.status(200).json({ ok: true, semana, actualizado: true, zonaHoraria: ZONA_HORARIA_AHORRO });
  } catch (error) {
    console.error('Error en tarea de semanas:', error?.message || error);
    return res.status(500).json({ error: 'Falló la sincronización semanal. Revisa los registros de la función.' });
  }
}
