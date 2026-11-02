import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {digestCodigoSalon} from './codigosSalon.js';

// Se deriva exclusivamente en el servidor a partir de las credenciales
// privadas ya configuradas. No guardar esta clave en el cliente ni en GitHub.
export function clavePinServidor(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(raw){
    const cuenta=JSON.parse(raw);
    if(cuenta.project_id!=='ahorro-grupal-industrial'||!cuenta.private_key)
      throw Error('Configuración privada de PIN inválida.');
    return createHash('sha256').update('ahorro-grupal:pin-cifrado:v1\0').update(cuenta.private_key).digest();
  }
  if(!process.env.VERCEL && process.env.AHORRO_DEMO_EMULADOR==='true'
     && process.env.FIREBASE_DATABASE_EMULATOR_HOST==='127.0.0.1:9000'
     && process.env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:9099')
    return createHash('sha256').update('solo-para-emulador-ahorro-grupal').digest();
  throw Error('No se configuraron credenciales privadas para recuperar códigos.');
}

export function cifrarPin(codigo,periodo,salon,clave){
  if(typeof codigo!=='string'||!clave||clave.length!==32)throw Error('PIN o clave inválida.');
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',clave,iv);
  cipher.setAAD(Buffer.from(`codigo-salon:${periodo}/${salon}`));
  const ciphertext=Buffer.concat([cipher.update(codigo,'utf8'),cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function descifrarPin(cifrado,periodo,salon,clave){
  if(typeof cifrado!=='string'||!clave||clave.length!==32)return null;
  const [v,iv,tag,ciphertext,...extra]=cifrado.split(':');
  if(v!=='v1'||extra.length||!iv||!tag||!ciphertext)return null;
  try{
    const decipher=createDecipheriv('aes-256-gcm',clave,Buffer.from(iv,'base64url'));
    decipher.setAAD(Buffer.from(`codigo-salon:${periodo}/${salon}`));
    decipher.setAuthTag(Buffer.from(tag,'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64url')),decipher.final()]).toString('utf8');
  }catch{return null;}
}

// Las claves de cuatro cifras anteriores se guardaron solamente como SHA256.
// Solo el endpoint del administrador llama a esta recuperación; jamás la app.
// Las claves antiguas largas no se pueden reconstruir de este modo.
export function recuperarPin4(digest){
  if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))return null;
  for(let n=0;n<10000;n++){
    const codigo=String(n).padStart(4,'0');
    if(digestCodigoSalon(codigo)===digest)return codigo;
  }
  return null;
}
