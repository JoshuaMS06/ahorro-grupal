import test from 'node:test';
import assert from 'node:assert/strict';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {informeVisibleSegunRol} from '../lib/informeRoles.js';
import {GENERACION_ESPECIAL,distribucionNueva} from '../lib/fondos.js';

const periodos={
 '2026-2027-A':{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}},
 '2026-2027-B':{meta:{creadoEn:200}}
};
const pago=(id,semana,monto,grupo,carrera,estado='pagado')=>({
 estudianteId:id,semana,monto,fondoGrupo:grupo,fondoCarrera:carrera,
 estado,creadoEn:300,registradoPor:'resp507'
});
test('un pago de $20 del 507 suma exactamente $10 a Industrial y $10 al privado',()=>{
 const aulas={'2026-2027-A':{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{a_s0005:pago('a',5,20,10,10)}},
   '107':{meta:{cuotaSemanal:10},pagosReinicio:{b_s0005:pago('b',5,10,0,10)}}
 }};
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(resumen.aportado,20); // $10 del 507 + $10 del 107
 assert.equal(resumen.totalCarrera,20);
 assert.equal(resumen.totalAhorro507,10);
 assert.equal(resumen.conciliacion507.cobros,1);
 assert.equal(resumen.conciliacion507.recaudado,20);
 assert.equal(resumen.conciliacion507.industrial,10);
 assert.equal(resumen.conciliacion507.privado,10);
 assert.equal(resumen.conciliacion507.conciliado,true);
 const informe=informeVisibleSegunRol(resumen,{tipo:'responsable'},GENERACION_ESPECIAL);
 assert.equal(informe.totalAportadoSalon,20);
 assert.equal(informe.aportacionCarrera,10);
 assert.equal(informe.ahorroPropioSalon,10);
});
test('dos pagos del 507 no duplican $40 por cada alumno',()=>{
 const aulas={'2026-2027-A':{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{
     a_s0005:pago('a',5,20,10,10),b_s0005:pago('b',5,20,10,10)
   }}
 }};
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(resumen.aportado,20);
 assert.equal(resumen.totalAhorro507,20);
 assert.equal(resumen.conciliacion507.recaudado,40);
 assert.equal(resumen.totalCarrera+resumen.totalAhorro507,40);
});
test('el 507 que conserva la misma generación en semestre B sigue dividido 10/10',()=>{
 const aulas={'2026-2027-B':{
   '507B':{meta:{cuotaSemanal:20,generacionId:GENERACION_ESPECIAL},
     pagos:{a_s0006:pago('a',6,20,10,10)}}
 }};
 assert.deepEqual(distribucionNueva('2026-2027-B','507B',aulas['2026-2027-B']['507B'].meta),
   {grupo:10,carrera:10,cuota:20});
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(resumen.totalCarrera,10);
 assert.equal(resumen.totalAhorro507,10);
 assert.equal(resumen.conciliacion507.conciliado,true);
});
test('anulaciones no se cuentan de nuevo ni aparecen en saldo activo',()=>{
 const aulas={'2026-2027-A':{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{
     a_s0005:pago('a',5,20,10,10,'anulado'),b_s0005:pago('b',5,20,10,10)
   }}
 }};
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(resumen.conciliacion507.cobros,1);
 assert.equal(resumen.conciliacion507.recaudado,20);
 assert.equal(resumen.totalAhorro507,10);
 assert.equal(resumen.totalCarrera,10);
});
test('marca repartos incorrectos preexistentes, sin modificar los pagos',()=>{
 const incorrecto=pago('a',5,20,0,20);
 const aulas={'2026-2027-A':{'507':{
   meta:{cuotaSemanal:20},pagosReinicio:{a_s0005:incorrecto}
 }}};
 const original=structuredClone(aulas);
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(resumen.conciliacion507.registrosIncorrectos,1);
 assert.equal(resumen.conciliacion507.conciliado,false);
 assert.deepEqual(aulas,original);
});
test('no expone conciliación privada del 507 en informes de otros salones',()=>{
 const aulas={'2026-2027-A':{
   '507':{meta:{cuotaSemanal:20},pagosReinicio:{a_s0005:pago('a',5,20,10,10)}},
   '107':{meta:{cuotaSemanal:10},pagosReinicio:{b_s0005:pago('b',5,10,0,10)}}
 }};
 const resumen=resumirAhorroReiniciado(aulas,periodos);
 const informe=informeVisibleSegunRol(resumen,{tipo:'responsable'},'gen-2026-2027-A-107');
 assert.equal(informe.ahorroPropioSalon,0);
 assert.equal(informe.totalAportadoSalon,10);
 assert.equal(informe.conciliacion507,null);
});
