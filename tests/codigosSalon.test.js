import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarCodigoSalon,generarCodigoSalon,digestCodigoSalon,codigoSalonCoincide,sesionCodigoValida} from '../lib/codigosSalon.js';

test('los códigos nuevos son PIN de 4 dígitos generados de forma segura',()=>{
 const codigos=Array.from({length:30},()=>generarCodigoSalon());
 // Con 10 000 combinaciones, una coincidencia aleatoria entre 30 muestras es posible.
 assert.ok(new Set(codigos).size >= 25);
 for(const codigo of codigos){
   assert.match(codigo,/^\d{4}$/);
   assert.equal(normalizarCodigoSalon(codigo).length,4);
 }
});

test('el código no se guarda en claro; acepta guiones y espacios al introducirlo',()=>{
 const codigo=generarCodigoSalon(),digest=digestCodigoSalon(codigo);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.notEqual(digest,normalizarCodigoSalon(codigo));
 assert.equal(codigoSalonCoincide(codigo,digest),true);
 assert.equal(codigoSalonCoincide(' '+codigo.toLowerCase()+' ',digest),true);
 assert.equal(codigoSalonCoincide(generarCodigoSalon(),digest),false);
 assert.equal(codigoSalonCoincide('1234',digest),false);
 assert.equal(codigoSalonCoincide(codigo,'not_a_digest'),false);
});

test('se mantienen válidos los códigos anteriores hasta que se roten',()=>{
 const anterior='ABCD-EFGH-JKLM-NPQR';
 const ocho='1234-5678';
 assert.equal(codigoSalonCoincide(anterior,digestCodigoSalon(anterior)),true);
 assert.equal(codigoSalonCoincide(ocho,digestCodigoSalon(ocho)),true);
 assert.equal(digestCodigoSalon('12'),null);
});
test('un token solo autoriza el salón y la versión activa; rotar revoca',()=>{
 const token={rolSalon:'consulta',periodoCodigo:'2026-2027-A',salonCodigo:'507',versionCodigo:2};
 assert.equal(sesionCodigoValida(token,'2026-2027-A','507',2),true);
 assert.equal(sesionCodigoValida(token,'2026-2027-A','107',2),false);
 assert.equal(sesionCodigoValida(token,'2026-2027-B','507',2),false);
 assert.equal(sesionCodigoValida(token,'2026-2027-A','507',3),false);
 assert.equal(sesionCodigoValida({...token,rolSalon:'lector'},'2026-2027-A','507',2),false);
});
