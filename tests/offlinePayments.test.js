import test from 'node:test';
import assert from 'node:assert/strict';
import {versionPago,crearCambioPendiente,cambiarDeseado,estadoLocalPago} from '../lib/offlinePayments.js';
import {claveMovimiento,claveVista} from '../lib/offlineStore.js';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
const period='2026-2027-A';
const base={uid:'responsable507',periodo:period,salon:'507',estudianteId:'e123',semana:6,
 nombre:'Alumno del 507',id:'mov-12345678',creadoEn:1762500000000};
const pago={estado:'pagado',estudianteId:'e123',semana:6,monto:20,
 fondoGrupo:10,fondoCarrera:10,creadoEn:100,correcciones:0,registradoPor:'resp',
 historial:{folio1:{tipo:'registro',fecha:100,uid:'resp'}}};
test('una vista offline queda asociada al UID y salón, no a un PIN',()=>{
 assert.equal(claveVista('u1',period,'507'),'u1|2026-2027-A|507');
 assert.notEqual(claveVista('u2',period,'507'),claveVista('u1',period,'507'));
 assert.equal(claveMovimiento('u1',period,'507','e123',6),
 'u1|2026-2027-A|507|e123|6');
});
test('una versión cambia al corregirse el pago por otro responsable',()=>{
 assert.equal(versionPago(null),'sin-pago');
 assert.equal(versionPago(pago),'pagado|100|0|1');
 assert.notEqual(versionPago(pago),versionPago({...pago,correcciones:1}));
 assert.notEqual(versionPago(pago),versionPago({...pago,historial:{...pago.historial,ev2:{}}}));
 assert.notEqual(versionPago(pago),versionPago({...pago,estado:'anulado'}));
});
test('registro offline de + no cuenta como depósito nuevo confirmado',()=>{
 const mov=crearCambioPendiente({...base,base:{estado:'pendiente',version:'sin-pago'},deseado:'pagado'});
 assert.equal(mov.baseVersion,'sin-pago');
 assert.equal(mov.deseado,'pagado');
 assert.equal(mov.estado,'pendiente');
 assert.equal(estadoLocalPago(null,mov),'pagado');
 assert.equal(cambiarDeseado(mov,'anulado','pendiente'),null);
});
test('anular y restaurar sin señal se compensan sin generar dos cobros',()=>{
 const mov=crearCambioPendiente({...base,base:{estado:'pagado',version:versionPago(pago)},deseado:'anulado'});
 assert.equal(estadoLocalPago(pago,mov),'pendiente');
 assert.equal(cambiarDeseado(mov,'pagado','pagado'),null);
 assert.equal(versionPago(pago),'pagado|100|0|1');
});
test('una captura local por sí sola no altera los fondos del 507 ni de Industrial',()=>{
 const aulas={ [period]:{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{e123_s0006:pago}}
 }};
 const periodos={ [period]:{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:10}}}};
 const antes=resumirAhorroReiniciado(aulas,periodos);
 crearCambioPendiente({...base,base:{estado:'pagado',version:versionPago(pago)},deseado:'anulado'});
 const despues=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(antes.totalAhorro507,10);
 assert.equal(antes.totalCarrera,10);
 assert.deepEqual(despues,antes);
});
test('se rechaza pago offline con periodo, estudiante, folio o semana incorrectos',()=>{
 assert.throws(()=>crearCambioPendiente({...base,periodo:'../../roles',base:{estado:'pendiente',version:'sin-pago'},deseado:'pagado'}),/inválido/);
 assert.throws(()=>crearCambioPendiente({...base,semana:-5,base:{estado:'pendiente',version:'sin-pago'},deseado:'pagado'}),/inválido/);
 assert.throws(()=>crearCambioPendiente({...base,id:'x',base:{estado:'pendiente',version:'sin-pago'},deseado:'pagado'}),/inválido/);
});
