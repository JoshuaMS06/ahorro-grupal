import test from 'node:test';
import assert from 'node:assert/strict';
import {verificarDatosResponsable,modificarPlazaRaiz,modificarPlazaRoles,proponerTransaccionRoles,salonDisponibleResponsable} from '../lib/gestionarResponsables.js';

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

test('el salón 507 admite dos responsables en plazas separadas y nunca cambia los fondos',()=>{
 const inicial=base();
 inicial.periodos['2026-2027-A'].salones['507']={nombre:'Salón 507'};
 inicial.aulas['2026-2027-A']['507']={
   meta:{nombre:'Salón 507',cuotaSemanal:20},
   integrantes:{alumno1:{nombre:'Persona de prueba'}},
   pagosReinicio:{p1:{estado:'pagado',monto:20,fondoGrupo:10,fondoCarrera:10}}
 };
 const rolesAntes=structuredClone(inicial.roles),aulasAntes=structuredClone(inicial.aulas);
 const r1=modificarPlazaRoles(inicial.roles,{accion:'asignar',periodo:'2026-2027-A',
   salon:'507',plaza:'1',uid:'responsable507uno',adminUid:'admin-general'});
 const r2=modificarPlazaRoles(r1,{accion:'asignar',periodo:'2026-2027-A',
   salon:'507',plaza:'2',uid:'responsable507dos',adminUid:'admin-general'});
 assert.equal(r2.responsables['2026-2027-A']['507']['1'],'responsable507uno');
 assert.equal(r2.responsables['2026-2027-A']['507']['2'],'responsable507dos');
 assert.deepEqual(r2.porUsuario.responsable507uno,{periodo:'2026-2027-A',salon:'507',plaza:'1'});
 assert.deepEqual(r2.porUsuario.responsable507dos,{periodo:'2026-2027-A',salon:'507',plaza:'2'});
 assert.deepEqual(inicial.roles,rolesAntes);
 assert.deepEqual(inicial.aulas,aulasAntes);
});
test('la transacción no aborta con lectura inicial null y reconfirma el estado real',()=>{
 const inicial=base().roles;
 const args={accion:'asignar',periodo:'2026-2027-A',salon:'507',plaza:'1',
   uid:'responsable507uno',adminUid:'admin-general'};
 const propuesta=proponerTransaccionRoles(null,inicial,args);
 assert.equal(propuesta.responsables['2026-2027-A']['507']['1'],'responsable507uno');
 const actual=structuredClone(inicial);
 actual.responsables['2026-2027-A']['507']={'1':'personaAnterior'};
 assert.throws(()=>proponerTransaccionRoles(actual,inicial,args),/ya tiene responsable/i);
});
test('no sustituye ni revierte los datos financieros al revocar permisos',()=>{
 const inicial=base();
 const pagos=structuredClone(inicial.aulas);
 const cambiado=modificarPlazaRoles(inicial.roles,{accion:'revocar',periodo:'2026-2027-A',salon:'107',plaza:'1',adminUid:'admin-general'});
 assert.equal(cambiado.porUsuario.u1,undefined);
 assert.deepEqual(inicial.aulas,pagos);
});
test('reconoce salones activos y emite mensajes distintos si falta o está cerrado',()=>{
 assert.doesNotThrow(()=>salonDisponibleResponsable({nombre:'2026-2027-A'},{nombre:'Salón 507'}));
 assert.throws(()=>salonDisponibleResponsable({nombre:'Ciclo'},null),/no aparece/);
 assert.throws(()=>salonDisponibleResponsable({cerradoEn:1794000000000},{nombre:'507'}),/cerrado/);
});
test('la cuenta general no debe ocupar una segunda plaza en el salón 507',()=>{
 assert.throws(()=>modificarPlazaRoles(base().roles,{accion:'asignar',periodo:'2026-2027-A',salon:'507',plaza:'1',uid:'admin-general',adminUid:'admin-general'}),/administrador general/);
});
