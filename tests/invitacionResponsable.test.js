import test from 'node:test';
import assert from 'node:assert/strict';
import {responsableAutorizadoParaEnlace} from '../lib/invitacionResponsable.js';
const roles={adminGeneralUid:'general',responsables:{'2026-2027-A':{'507':{'1':'persona507','2':'otraPersona'},'107':{'1':'persona107'}}},
 porUsuario:{
   persona507:{periodo:'2026-2027-A',salon:'507',plaza:'1'},
   otraPersona:{periodo:'2026-2027-A',salon:'507',plaza:'2'},
   persona107:{periodo:'2026-2027-A',salon:'107',plaza:'1'}
 }};
const base={adminUid:'general',periodo:'2026-2027-A',salon:'507',plaza:'1'};
test('admin puede preparar enlace para responsable del 507 sin saber contraseña',()=>{
 assert.equal(responsableAutorizadoParaEnlace(roles,base),'persona507');
 assert.equal(responsableAutorizadoParaEnlace(roles,{...base,plaza:'2'}),'otraPersona');
});
test('no se puede preparar enlace para un salón distinto u ocupar otra plaza',()=>{
 assert.throws(()=>responsableAutorizadoParaEnlace(roles,{...base,salon:'307'}),/no tiene responsable/);
 assert.throws(()=>responsableAutorizadoParaEnlace(roles,{...base,plaza:'3'}),/plazas/);
 assert.throws(()=>responsableAutorizadoParaEnlace(roles,{...base,adminUid:'intruso'}),/administrador general/);
});
test('no se emite enlace si rol y plaza no coinciden',()=>{
 const falso=structuredClone(roles);
 falso.porUsuario.persona507.salon='107';
 assert.throws(()=>responsableAutorizadoParaEnlace(falso,base),/no coincide/);
});
test('no se emite enlace al administrador general',()=>{
 const falso=structuredClone(roles);
 falso.responsables['2026-2027-A']['507']['1']='general';
 falso.porUsuario.general={periodo:'2026-2027-A',salon:'507',plaza:'1'};
 assert.throws(()=>responsableAutorizadoParaEnlace(falso,base),/no necesita/);
});
