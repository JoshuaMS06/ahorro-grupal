import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarDatosResponsable,modificarPlazaRaiz} from '../lib/gestionarResponsables.js';

const base=()=>({
  roles:{adminGeneralUid:'admin-general',responsables:{'2026-2027-A':{'107':{'1':'u1'},'307':{}}},porUsuario:{u1:{periodo:'2026-2027-A',salon:'107',plaza:'1'}}},
  periodos:{'2026-2027-A':{meta:{nombre:'2026–2027 A'},salones:{'107':{nombre:'107'},'307':{nombre:'307'}}}},
  aulas:{'2026-2027-A':{'107':{integrantes:{uno:{nombre:'Estudiante'}},pagos:{uno_s0004:{estado:'pagado',monto:10}}}}}
});
const datos={periodo:'2026-2027-A',salon:'107',plaza:'2',adminUid:'admin-general'};

test('responsable nuevo ocupa plaza vacía y conserva estudiantes y pagos',()=>{
  const anterior=base();const siguiente=modificarPlazaRaiz(anterior,{accion:'asignar',uid:'u2',...datos});
  assert.equal(siguiente.roles.responsables['2026-2027-A']['107']['2'],'u2');
  assert.deepEqual(siguiente.roles.porUsuario.u2,{periodo:'2026-2027-A',salon:'107',plaza:'2'});
  assert.deepEqual(siguiente.aulas,anterior.aulas);
  assert.equal(anterior.roles.porUsuario.u2,undefined);
});
test('rechaza una tercera plaza o un UID asignado a otra plaza',()=>{
  assert.throws(()=>verificarDatosResponsable({...datos,plaza:'3'}),/plazas/);
  assert.throws(()=>modificarPlazaRaiz(base(),{accion:'asignar',uid:'u1',...datos}),/otra plaza/);
  assert.throws(()=>modificarPlazaRaiz(base(),{accion:'asignar',uid:'u3',...datos,plaza:'1'}),/ya tiene responsable/);
});
test('no puede convertir al administrador general en responsable',()=>{
  assert.throws(()=>modificarPlazaRaiz(base(),{accion:'asignar',uid:'admin-general',...datos}),/No es posible/);
});
test('revocar corta acceso y no borra los pagos',()=>{
  const anterior=base();const siguiente=modificarPlazaRaiz(anterior,{accion:'revocar',...datos,plaza:'1'});
  assert.equal(siguiente.roles.porUsuario.u1,undefined);
  assert.equal(siguiente.roles.responsables['2026-2027-A']['107']['1'],undefined);
  assert.deepEqual(siguiente.aulas,anterior.aulas);
});
test('semestre cerrado, salón desconocido o admin diferente no pueden asignar',()=>{
  const cerrado=base();cerrado.periodos['2026-2027-A'].meta.cerradoEn=Date.now();
  assert.throws(()=>modificarPlazaRaiz(cerrado,{accion:'asignar',uid:'u2',...datos}),/cerrado/);
  assert.throws(()=>modificarPlazaRaiz(base(),{accion:'asignar',uid:'u2',...datos,salon:'999'}),/no existe/);
  assert.throws(()=>modificarPlazaRaiz(base(),{accion:'asignar',uid:'u2',...datos,adminUid:'atacante'}),/no tienes acceso/);
});
test('datos de correo y nombre son obligatorios para altas',()=>{
  assert.throws(()=>verificarDatosResponsable({...datos,nombre:'',correo:'persona@example.com'}),/nombre/);
  assert.throws(()=>verificarDatosResponsable({...datos,nombre:'Persona De Prueba',correo:'no-es-correo'}),/correo/);
  assert.doesNotThrow(()=>verificarDatosResponsable({...datos,nombre:'Persona De Prueba',correo:'persona@example.com'}));
});
