import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararCambioInmediato} from '../lib/avanceInmediato.js';
import {primerLunesDesdeFecha} from '../lib/semestres.js';

const origen='2026-2027-A';
function ejemplo(){return {
 roles:{adminGeneralUid:'general',lectores:{lector507:{periodo:origen,salon:'507',aprobadoEn:123},lectorFin:{periodo:origen,salon:'1007',aprobadoEn:124}},porUsuario:{responsable:{periodo:origen,salon:'507',plaza:'1'},fin:{periodo:origen,salon:'1007',plaza:'2'}},responsables:{[origen]:{'507':{'1':'responsable'},'1007':{'2':'fin'}}}},
 periodos:{[origen]:{meta:{nombre:'Actual',lunesBase:'2026-10-19',semanaBase:4,creadoEn:1,reinicioContable:{version:1,semanaInicio:5,activadoEn:1}},salones:{'507':{nombre:'507'},'107':{nombre:'107'},'1007':{nombre:'1007'}}}},
 codigosSalon:{[origen]:{'507':{digest:'x',version:1},'107':{digest:'y',version:2}}},
 ahorro:{integrantes:{'Uno':{pagos:3}}},
 aulas:{[origen]:{
  '507':{meta:{cuotaSemanal:20,creadoEn:1},integrantes:{s001:{nombre:'Uno',aliasLegado:'Uno'}},pagos:{p1:{estado:'pagado',monto:20}}},
  '107':{meta:{cuotaSemanal:10},integrantes:{s002:{nombre:'Dos'}}},
  '1007':{meta:{cuotaSemanal:10},integrantes:{s003:{nombre:'Tres'}},retiros:{r1:{estado:'rechazado'}}}
 }}}
}
test('el botón registra fecha efectiva, no pide lunes ni programa cron',()=>{
 const fecha=new Date('2026-10-31T23:00:00.000Z').getTime(); // sábado en México
 const datos=ejemplo();const antes=structuredClone(datos);
 const {raiz,detalles}=prepararCambioInmediato(datos,origen,fecha);
 assert.equal(detalles.fechaCambio,'2026-10-31');
 assert.equal(detalles.lunesBase,'2026-11-02');
 assert.equal(raiz.periodos['2026-2027-B'].meta.cambiadoEn,fecha);
 assert.equal(raiz.periodos['2026-2027-B'].meta.lunesBase,'2026-11-02');
 assert.equal(raiz.periodos[origen].meta.migradoA,'2026-2027-B');
 assert.equal(raiz.aulas['2026-2027-B']['607'].meta.cuotaSemanal,20);
 assert.equal(raiz.aulas['2026-2027-B']['607'].pagos,undefined);
 assert.deepEqual(raiz.aulas[origen]['507'].pagos,antes.aulas[origen]['507'].pagos);
 assert.deepEqual(raiz.ahorro,antes.ahorro);
 assert.equal(raiz.codigosSalon[origen],undefined);
 assert.deepEqual(datos.codigosSalon,antes.codigosSalon);
 assert.equal(raiz.aulas['2026-2027-B']['1007'],undefined);
 assert.equal(detalles.salonesArchivados,1);
 assert.equal(raiz.roles.porUsuario.responsable.salon,'607');
 assert.equal(raiz.roles.porUsuario.fin,undefined);
 assert.equal(raiz.roles.lectores.lector507.salon,'607');
 assert.equal(raiz.roles.lectores.lector507.periodo,'2026-2027-B');
 assert.equal(raiz.roles.lectores.lectorFin,undefined);
 assert.deepEqual(datos,antes);
});
test('se toma el lunes de la semana si el botón se pulsa un lunes',()=>{
 assert.equal(primerLunesDesdeFecha('2026-11-02'),'2026-11-02');
 assert.equal(primerLunesDesdeFecha('2026-11-03'),'2026-11-09');
 assert.equal(primerLunesDesdeFecha('2026-11-08'),'2026-11-09');
 assert.throws(()=>primerLunesDesdeFecha('2026-02-30'));
});
test('no permite cambiar dos veces ni reutilizar destino existente',()=>{
 const fecha=Date.parse('2026-11-02T12:00:00Z');
 const r=prepararCambioInmediato(ejemplo(),origen,fecha);
 assert.throws(()=>prepararCambioInmediato(r.raiz,origen,fecha),/cerrado|cambiado/);
 const u=ejemplo();u.periodos['2026-2027-B']={meta:{}};
 assert.throws(()=>prepararCambioInmediato(u,origen,fecha),/ya existe/);
});
test('un retiro pendiente bloquea el avance completo, sin cambios',()=>{
 const u=ejemplo();u.aulas[origen]['507'].retiros={x:{estado:'solicitado'}};
 const original=structuredClone(u);
 assert.throws(()=>prepararCambioInmediato(u,origen,Date.now()),/retiros pendientes/);
 assert.deepEqual(u,original);
});

test('no permite avanzar el semestre original sin activar el reinicio contable',()=>{
 const d=ejemplo();delete d.periodos[origen].meta.reinicioContable;
 assert.throws(()=>prepararCambioInmediato(d,origen,Date.now()),/Activa el ahorro nuevo/);
});
