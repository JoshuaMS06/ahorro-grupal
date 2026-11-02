import {createHash,randomInt,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';

// Los códigos nuevos son PIN de 4 dígitos. Por compatibilidad, los
// códigos existentes de 8 dígitos y 16 caracteres siguen funcionando hasta su rotación.
const CODIGO_NUMERICO=/^\d{4}$/;
const CODIGO_NUMERICO_ANTERIOR=/^\d{8}$/;
const CODIGO_ANTERIOR=/^[A-HJ-NP-Z2-9]{16}$/;

export function normalizarCodigoSalon(codigo) {
  if(typeof codigo!=='string')return '';
  return codigo.replace(/[\s-]/g,'').toUpperCase();
}

export function esCodigoSalonValido(codigo) {
  const limpio=normalizarCodigoSalon(codigo);
  return CODIGO_NUMERICO.test(limpio) || CODIGO_NUMERICO_ANTERIOR.test(limpio) || CODIGO_ANTERIOR.test(limpio);
}

export function generarCodigoSalon() {
  // randomInt evita el sesgo y conserva ceros iniciales (ej.: 0047).
  return String(randomInt(0,10_000)).padStart(4,'0');
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
