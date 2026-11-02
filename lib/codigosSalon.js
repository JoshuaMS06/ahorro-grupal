import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';

// Los códigos nuevos son 8 dígitos. Los anteriores de 16 caracteres
// siguen siendo válidos hasta que el administrador los reemplace.
const CODIGO_NUMERICO=/^\d{8}$/;
const CODIGO_ANTERIOR=/^[A-HJ-NP-Z2-9]{16}$/;

export function normalizarCodigoSalon(codigo) {
  if(typeof codigo!=='string')return '';
  return codigo.replace(/[\s-]/g,'').toUpperCase();
}

export function esCodigoSalonValido(codigo) {
  const limpio=normalizarCodigoSalon(codigo);
  return CODIGO_NUMERICO.test(limpio) || CODIGO_ANTERIOR.test(limpio);
}

export function generarCodigoSalon() {
  // randomInt evita el sesgo de distribución y conserva los ceros iniciales.
  const limpio=String(randomInt(0,100_000_000)).padStart(8,'0');
  return `${limpio.slice(0,4)}-${limpio.slice(4)}`;
}

export function digestCodigoSalon(codigo){
  const limpio=normalizarCodigoSalon(codigo);
  if(!esCodigoSalonValido(limpio))return null;
  return createHash('sha256').update(limpio,'utf8').digest('hex');
}

export function codigoSalonCoincide(codigo,digestGuardado) {
  const digest=digestCodigoSalon(codigo);
  if(!digest || typeof digestGuardado!=='string' || !/^[a-f0-9]{64}$/.test(digestGuardado))return false;
  return timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(digestGuardado,'hex'));
}

export function sesionCodigoValida(claims,periodo,salon,version) {
  return Boolean(claims?.rolSalon==='consulta' && claims.periodoCodigo===periodo
    && claims.salonCodigo===salon && Number.isSafeInteger(version) && version>0
    && claims.versionCodigo===version);
}
