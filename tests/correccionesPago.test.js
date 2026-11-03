import test from 'node:test';
import assert from 'node:assert/strict';
import {corregirRegistroPago} from '../lib/correccionesPago.js';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
const inicial={estudianteId:'e3',nombre:'Alumno',semana:5,monto:20,fondoGrupo:10,fondoCarrera:10,
 estado:'pagado',creadoEn:200,registradoPor:'responsable1',
 historial:{ev1:{tipo:'registro',fecha:200,uid:'responsable1'}}};
const args={accion:'anular',estudianteId:'e3',semana:5,uid:'responsable2',
 motivo:'Se registró por equivocación',folio:'ev2',ahora:300};
test('anular 507 conserva 10/10, deja auditoría y descuenta al no contar como pagado',()=>{
 const original=structuredClone(inicial),actualizado=corregirRegistroPago(original,args);
 assert.equal(actualizado.estado,'anulado');
 assert.equal(actualizado.fondoGrupo,10);
 assert.equal(actualizado.fondoCarrera,10);
 assert.equal(actualizado.monto,20);
 assert.equal(actualizado.creadoEn,200);
 assert.equal(actualizado.registradoPor,'responsable1');
 assert.equal(actualizado.anuladoPor,'responsable2');
 assert.equal(actualizado.historial.ev2.motivo,args.motivo);
 assert.deepEqual(inicial,original);
});
test('reactivar sin perder historial ni registrar dos veces el mismo pago',()=>{
 const anulado=corregirRegistroPago(inicial,args);
 const restaurado=corregirRegistroPago(anulado,{...args,accion:'restaurar',uid:'responsable1',
   motivo:'Pago confirmado por el alumno',folio:'ev3',ahora:400});
 assert.equal(restaurado.estado,'pagado');
 assert.equal(restaurado.creadoEn,200);
 assert.equal(restaurado.registradoPor,'responsable1');
 assert.deepEqual(Object.keys(restaurado.historial),['ev1','ev2','ev3']);
 assert.equal(restaurado.correcciones,2);
});
test('no se permite anular dos veces, reactivar sin anular ni reutilizar folios',()=>{
 const anulado=corregirRegistroPago(inicial,args);
 assert.throws(()=>corregirRegistroPago(anulado,{...args,folio:'ev3'}),/no está activo/);
 assert.throws(()=>corregirRegistroPago(inicial,{...args,accion:'restaurar'}),/no está anulado/);
 assert.throws(()=>corregirRegistroPago(inicial,{...args,folio:'ev1'}),/duplicada/);
});
test('no se cambian importes ni se aceptan pagos de otro alumno o semana',()=>{
 assert.throws(()=>corregirRegistroPago(inicial,{...args,estudianteId:'e8'}),/no coincide/);
 assert.throws(()=>corregirRegistroPago(inicial,{...args,semana:6}),/no coincide/);
 assert.throws(()=>corregirRegistroPago(inicial,{...args,motivo:'x'}),/motivo/);
 assert.throws(()=>corregirRegistroPago({...inicial,fondoCarrera:20},args),/división/);
});
test('pagos anteriores conservan fondos en cero',()=>{
 const anterior={...inicial,semana:3,tipoRegistro:'anterior',fondoGrupo:0,fondoCarrera:0};
 const corregido=corregirRegistroPago(anterior,{...args,semana:3});
 assert.equal(corregido.estado,'anulado');
 assert.equal(corregido.fondoGrupo,0);
 assert.equal(corregido.fondoCarrera,0);
});

test('al anular o restaurar $20 del 507, cambian ambos fondos $10 sin modificar otros salones',()=>{
 const periodos={'2026-2027-A':{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}}};
 const aulas={'2026-2027-A':{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{e3_s0005:structuredClone(inicial)}},
   '107':{meta:{cuotaSemanal:10},pagosReinicio:{e1_s0005:{
     estudianteId:'e1',semana:5,monto:10,fondoGrupo:0,fondoCarrera:10,
     estado:'pagado',creadoEn:250,registradoPor:'responsable107',historial:{e0:{tipo:'registro',fecha:250,uid:'responsable107'}}
   }}}
 }};
 const antes=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(antes.totalCarrera,20);
 assert.equal(antes.totalAhorro507,10);
 aulas['2026-2027-A']['507'].pagosReinicio.e3_s0005=corregirRegistroPago(inicial,args);
 const despues=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(despues.totalCarrera,10);
 assert.equal(despues.totalAhorro507,0);
 assert.equal(despues.generaciones['gen-2026-2027-A-107'].aportacionCarrera,10);
 aulas['2026-2027-A']['507'].pagosReinicio.e3_s0005=corregirRegistroPago(
   aulas['2026-2027-A']['507'].pagosReinicio.e3_s0005,
   {...args,accion:'restaurar',folio:'ev3',ahora:450,motivo:'Pago confirmado nuevamente'});
 const restaurado=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(restaurado.totalCarrera,20);
 assert.equal(restaurado.totalAhorro507,10);
});
