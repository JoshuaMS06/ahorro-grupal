import test from 'node:test';
import assert from 'node:assert/strict';
import {PROFESORES, CUOTA_PROFESOR, claveSemanaProfesor, esPagoProfesorAnterior, crearPagoProfesor, resumenAhorroProfesor, resumenAcumuladoProfesor} from '../lib/profesoresAhorro.js';

test('ocho profesores tienen identificadores estables y cuota semanal $10',()=>{
  assert.equal(PROFESORES.length,8);
  assert.equal(new Set(PROFESORES.map(p=>p.id)).size,8);
  assert.equal(CUOTA_PROFESOR,10);
  assert.equal(claveSemanaProfesor(5),'s0005');
  assert.throws(()=>claveSemanaProfesor(0));
});
test('el profesor tiene saldo propio, con semanas 1-4 como historial separado',()=>{
  const a=crearPagoProfesor('p01',1,'admin','evento1',100);
  const b=crearPagoProfesor('p01',5,'admin','evento2',200);
  assert.equal(a.tipoRegistro,'anterior');
  assert.equal(b.tipoRegistro,'actual');
  assert.equal(esPagoProfesorAnterior('2026-2027-A',4),true);
  const r=resumenAhorroProfesor({s0001:a,s0005:b},'2026-2027-A');
  assert.deepEqual(r,{saldo:10,historico:10,actuales:1,anteriores:1});
});
test('anular un aporte personal no afecta al saldo propio ni al de carrera',()=>{
  const pago=crearPagoProfesor('p02',6,'admin','folio',500);
  assert.equal(resumenAhorroProfesor({a:pago}).saldo,10);
  assert.equal(resumenAhorroProfesor({a:{...pago,estado:'anulado'}}).saldo,0);
  assert.throws(()=>crearPagoProfesor('p99',5,'admin','folio',500));
});

test('ahorro de profesores se conserva y suma a través de varios semestres',()=>{
 const actual=crearPagoProfesor('p01',5,'admin','f1',300,'2026-2027-A');
 const nuevo=crearPagoProfesor('p01',1,'admin','f2',400,'2026-2027-B');
 const r=resumenAcumuladoProfesor({'2026-2027-A':{p01:{s0005:actual}},'2026-2027-B':{p01:{s0001:nuevo}}},'p01');
 assert.equal(r.saldo,20); assert.equal(r.historico,0);
});
