/**
 * Nombre breve para listas importadas con formato:
 * APELLIDO PATERNO [compuesto] + APELLIDO MATERNO + NOMBRE(S).
 * Nunca modifica datos originales ni identificadores de Firebase.
 * Los alumnos añadidos manualmente se muestran como fueron escritos.
 */
const PARTICULAS = new Set(['DE','DEL','LA','LAS','LOS']);

function titulo(palabra) {
  return palabra.toLocaleLowerCase('es-MX').replace(/(^|[-’'])(\p{L})/gu,
    (_, separador, letra) => separador + letra.toLocaleUpperCase('es-MX'));
}

function apellidoPaterno(partes) {
  let n = 1;
  if (partes[0] === 'DE') {
    n = ['LA','LAS','LOS'].includes(partes[1]) ? 3 : 2;
  } else if (partes[0] === 'DEL') {
    n = 2;
  }
  // Deben quedar al menos dos tokens: apellido materno y primer nombre.
  return Math.min(n, partes.length - 2);
}

export function nombreParaMostrar(nombre, id = '', formatoNombre = '') {
  const original = String(nombre ?? '').trim().replace(/\s+/g,' ');
  if (!original) return '';
  const esListaImportada = /^s\d{3,}$/i.test(String(id || '')) &&
    original === original.toLocaleUpperCase('es-MX');
  if (formatoNombre !== 'apellidos-nombres' && !esListaImportada) return original;

  const partes = original.split(' ');
  if (partes.length < 3) return original;
  const n = apellidoPaterno(partes);
  if (n < 1 || partes.length - n < 2) return original;
  const apellido = partes.slice(0,n).map((p,i)=> i<n-1 && PARTICULAS.has(p) ? p.toLocaleLowerCase('es-MX') : titulo(p)).join(' ');
  const primerNombre = titulo(partes[n+1]);
  return `${primerNombre} ${apellido}`;
}

export function normalizarBusquedaNombre(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX');
}
