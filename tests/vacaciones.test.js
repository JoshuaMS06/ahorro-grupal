import test from 'node:test';
import assert from 'node:assert/strict';
import { semanaPeriodo } from '../lib/aulas.js';
import {iniciarVacaciones,reanudarVacaciones,aplicarVacaciones,seleccionarCicloActivo,lunesDeSemanaMexico,esConfirmacionValida} from '../lib/vacaciones.js';

const base={nombre:'2026–2027 A',lunesBase:'2026-10-19',semanaBase:4,creadoEn:1};
const fecha=s=>Date.parse(s);

test('activar vacaciones congela la semana sin modificar fechas ni registros',()=>{
  const pausa=iniciarVacaciones(base,fecha('2026-10-27T12:00:00-06:00'));
  assert.equal(pausa.vacaciones.semanaPausada,5);
  assert.equal(pausa.vacaciones.activas,true);
  assert.equal(pausa.lunesBase,base.lunesBase);
  assert.equal(semanaPeriodo(pausa,fecha('2026-12-22T10:00:00-06:00')),5);
  assert.equal(semanaPeriodo(base,fecha('2026-12-22T10:00:00-06:00'))>5,true);
});

test('reanudar conserva la semana y la semana siguiente empieza el próximo lunes',()=>{
  const pausa=iniciarVacaciones(base,fecha('2026-10-27T12:00:00-06:00'));
  const activo=reanudarVacaciones(pausa,fecha('2026-12-05T10:00:00-06:00'));
  assert.equal(activo.vacaciones.activas,false);
  assert.equal(activo.lunesBase,'2026-11-30');
  assert.equal(activo.semanaBase,5);
  assert.equal(semanaPeriodo(activo,fecha('2026-12-05T20:00:00-06:00')),5);
  assert.equal(semanaPeriodo(activo,fecha('2026-12-07T07:00:00-06:00')),6);
});

test('reanudar en lunes también mantiene la semana hasta el siguiente lunes',()=>{
  const pausa=iniciarVacaciones(base,fecha('2026-10-27T12:00:00-06:00'));
  const activo=reanudarVacaciones(pausa,fecha('2026-11-16T10:00:00-06:00'));
  assert.equal(semanaPeriodo(activo,fecha('2026-11-16T20:00:00-06:00')),5);
  assert.equal(semanaPeriodo(activo,fecha('2026-11-23T09:00:00-06:00')),6);
});

test('un segundo inicio o una reanudación sin pausa son rechazados',()=>{
  const pausa=iniciarVacaciones(base,fecha('2026-10-27T12:00:00-06:00'));
  assert.throws(()=>iniciarVacaciones(pausa,fecha('2026-10-29T12:00:00-06:00')), /activas/);
  assert.throws(()=>reanudarVacaciones(base), /no hay vacaciones/i);
  assert.throws(()=>aplicarVacaciones(base,'borrar'), /no válida/);
});

test('un semestre archivado no se puede detener ni reanudar',()=>{
  const archivado={...base,cerradoEn:12345};
  assert.throws(()=>iniciarVacaciones(archivado), /archivado/);
  assert.throws(()=>reanudarVacaciones(archivado), /archivado/);
});

test('lunes de México funciona en límites de día y de año',()=>{
  assert.equal(lunesDeSemanaMexico(fecha('2026-11-02T00:10:00-06:00')),'2026-11-02');
  assert.equal(lunesDeSemanaMexico(fecha('2027-01-01T10:00:00-06:00')),'2026-12-28');
});

test('cron toma exclusivamente el semestre activo, no uno archivado',()=>{
  const ciclo=seleccionarCicloActivo({'2026-2027-A':{meta:{...base,cerradoEn:10}},'2026-2027-B':{meta:base}});
  assert.equal(ciclo.id,'2026-2027-B');
  assert.throws(()=>seleccionarCicloActivo({'2026-2027-A':{meta:base},'2026-2027-B':{meta:base}}),/exactamente un/);
});

test('las dos acciones requieren exactamente CONFIRMAR',()=>{
  assert.equal(esConfirmacionValida('CONFIRMAR'),true);
  for(const v of ['confirmar','CONFIRMAR ',' CONFIRMAR','CONFIRMA','',null,undefined])assert.equal(esConfirmacionValida(v),false);
});
