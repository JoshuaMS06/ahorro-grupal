import test from 'node:test';
import assert from 'node:assert/strict';
import {permisoAdministrador} from '../lib/adminServidor.js';

function fakeDB(vals){
 return {ref:path=>({get:async()=>({val:()=>vals[path]??null})})};
}
const periodo='2026-2027-A';
const salon='107';
test('la lectura compartida requiere rol realmente autorizado',async()=>{
 const db=fakeDB({
  'roles/adminGeneralUid':'general',
  'roles/porUsuario/responsable':{periodo,salon,plaza:'1'},
  [`roles/responsables/${periodo}/${salon}`]:{'1':'responsable','2':'otraCuenta'}
 });
 assert.deepEqual(await permisoAdministrador(db,'general',periodo,'907'),{tipo:'general'});
 assert.deepEqual(await permisoAdministrador(db,'responsable',periodo,salon),{tipo:'responsable'});
 assert.equal(await permisoAdministrador(db,'responsable',periodo,'507'),null);
 assert.equal(await permisoAdministrador(db,'visitante_abcdef',periodo,salon),null);
 assert.equal(await permisoAdministrador(db,'sinRol',periodo,salon),null);
});
test('revocar una plaza invalida permisos aunque permanezca el índice viejo',async()=>{
 const db=fakeDB({
   'roles/adminGeneralUid':'general',
   'roles/porUsuario/responsable':{periodo,salon,plaza:'1'},
   [`roles/responsables/${periodo}/${salon}`]:{'1':'nuevoResponsable'}
 });
 assert.equal(await permisoAdministrador(db,'responsable',periodo,salon),null);
});
