import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

// Alfabeto sin 0, 1, I y O. Cada carácter representa 5 bits.
const ALFABETO='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizarCodigoSalon(codigo) {
  if(typeof codigo!=='string')return '';
  return codigo.replace(/[\s-]/g,'').toUpperCase();
}

export function generarCodigoSalon() {
  const bytes=randomBytes(16);
  const limpio=Array.from(bytes,b=>ALFABETO[b%32]).join('');
  return limpio.match(/.{4}/g).join('-');
}

export function digestCodigoSalon(codigo){
  const limpio=normalizarCodigoSalon(codigo);
  if(!/^[A-HJ-NP-Z2-9]{16}$/.test(limpio))return null;
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
