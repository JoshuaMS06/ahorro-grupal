import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizarCodigoSalon,generarCodigoSalon,digestCodigoSalon,codigoSalonCoincide,sesionCodigoValida} from '../lib/codigosSalon.js';

test('los códigos por salón tienen 16 caracteres aleatorios y formato legible',()=>{
 const codigos=Array.from({length:30},()=>generarCodigoSalon());
 assert.equal(new Set(codigos).size,30);
 for(const codigo of codigos){
   assert.match(codigo,/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/);
   assert.equal(normalizarCodigoSalon(codigo).length,16);
 }
});

test('el código no se guarda en claro; acepta guiones y espacios al introducirlo',()=>{
 const codigo=generarCodigoSalon(),digest=digestCodigoSalon(codigo);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.equal(digest.includes(normalizarCodigoSalon(codigo)),false);
 assert.equal(codigoSalonCoincide(codigo,digest),true);
 assert.equal(codigoSalonCoincide(' '+codigo.toLowerCase()+' ',digest),true);
 assert.equal(codigoSalonCoincide(generarCodigoSalon(),digest),false);
 assert.equal(codigoSalonCoincide('1234',digest),false);
 assert.equal(codigoSalonCoincide(codigo,'not_a_digest'),false);
});

test('un token solo autoriza el salón y la versión activa; rotar revoca',()=>{
 const token={rolSalon:'consulta',periodoCodigo:'2026-2027-A',salonCodigo:'507',versionCodigo:2};
 assert.equal(sesionCodigoValida(token,'2026-2027-A','507',2),true);
 assert.equal(sesionCodigoValida(token,'2026-2027-A','107',2),false);
 assert.equal(sesionCodigoValida(token,'2026-2027-B','507',2),false);
 assert.equal(sesionCodigoValida(token,'2026-2027-A','507',3),false);
 assert.equal(sesionCodigoValida({...token,rolSalon:'lector'},'2026-2027-A','507',2),false);
});
