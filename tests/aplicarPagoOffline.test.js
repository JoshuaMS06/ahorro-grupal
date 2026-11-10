import test from 'node:test';
import assert from 'node:assert/strict';
import {aplicarMovimientoOffline} from '../lib/aplicarPagoOffline.js';
import {versionPago} from '../lib/offlinePayments.js';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
const meta={'2026-2027-A':{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:1}}}};
const base={
 estudianteId:'e123',semana:6,uid:'resp507',id:'offline-12345678',ahora:1762700000000,
 cuota:20,distribucion:{grupo:10,carrera:10},anterior:false,
 nombre:'Estudiante'
};
const primero={...base,deseado:'pagado',baseVersion:versionPago(null)};
test('sin red: primer pago 507 genera un único $20, mitad para cada fondo',()=>{
 const pago=aplicarMovimientoOffline(null,primero);
 assert.equal(pago.estado,'pagado');assert.equal(pago.monto,20);
 assert.equal(pago.fondoGrupo,10);assert.equal(pago.fondoCarrera,10);
 assert.equal(pago.historial[primero.id].tipo,'registro');
 assert.equal(aplicarMovimientoOffline(pago,primero),null,'mismo folio no puede cobrarse dos veces');
 const r=resumirAhorroReiniciado({'2026-2027-A':{'507':{meta:{cuotaSemanal:20},pagosReinicio:{e123_s0006:pago}}}},meta);
 assert.equal(r.totalCarrera,10);assert.equal(r.totalAhorro507,10);
});
test('responsable puede cancelar y restaurar con dos folios distintos; sin duplicar saldo',()=>{
 const pagado=aplicarMovimientoOffline(null,primero);
 const cancel=aplicarMovimientoOffline(pagado,{...base,deseado:'anulado',id:'offline-22345678',baseVersion:versionPago(pagado)});
 assert.equal(cancel.estado,'anulado');assert.equal(cancel.correcciones,1);
 assert.equal(cancel.fondoGrupo,10);assert.equal(cancel.fondoCarrera,10);
 const restore=aplicarMovimientoOffline(cancel,{...base,deseado:'pagado',id:'offline-32345678',baseVersion:versionPago(cancel)});
 assert.equal(restore.estado,'pagado');assert.equal(restore.correcciones,2);
 assert.equal(Object.keys(restore.historial).length,3);
 assert.equal(restore.fondoCarrera,10);
 assert.equal(restore.fondoGrupo,10);
});
test('un pago modificado por otro dispositivo bloquea la cola offline sin sobreescribir',()=>{
 const pagado=aplicarMovimientoOffline(null,primero);
 assert.throws(()=>aplicarMovimientoOffline(pagado,{
  ...base,deseado:'anulado',id:'offline-22345678',baseVersion:'sin-pago'
 }),/cambió/);
 assert.throws(()=>aplicarMovimientoOffline(pagado,{
  ...base,deseado:'pagado',id:'offline-32345678',baseVersion:versionPago(pagado)
 }),/existe/);
});
test('pagos anteriores se mantienen fuera de fondo común y privado',()=>{
 const p=aplicarMovimientoOffline(null,{
  ...base,semana:3,deseado:'pagado',anterior:true,baseVersion:'sin-pago'
 });
 assert.equal(p.tipoRegistro,'anterior');
 assert.equal(p.fondoGrupo,0);assert.equal(p.fondoCarrera,0);
 assert.equal(p.monto,20);
});
test('un salón normal cobra $10 sólo para carrera',()=>{
 const p=aplicarMovimientoOffline(null,{...base,cuota:10,distribucion:{grupo:0,carrera:10},baseVersion:'sin-pago',deseado:'pagado'});
 assert.equal(p.monto,10);assert.equal(p.fondoCarrera,10);assert.equal(p.fondoGrupo,0);
});
test('rechaza suma distinta de cuota o importes inválidos',()=>{
 assert.throws(()=>aplicarMovimientoOffline(null,{...primero,distribucion:{grupo:20,carrera:10}}),/válido/);
 assert.throws(()=>aplicarMovimientoOffline(null,{...primero,cuota:-5}),/válido/);
});
