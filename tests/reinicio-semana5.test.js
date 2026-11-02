import test from 'node:test';
import assert from 'node:assert/strict';
import {corteActivo,inicioAportaciones,rutaPagos,rutaRetiros,resumirAhorroReiniciado} from '../lib/reinicioContable.js';
const periodos={'2026-2027-A':{meta:{lunesBase:'2026-10-19',semanaBase:4,reinicioContable:{version:1,semanaInicio:5,activadoEn:123456}}}};
const pago=(semana,monto,creadoEn=200000)=>({estado:'pagado',semana,monto,creadoEn,fondoGrupo:0,fondoCarrera:monto});
test('la semana 5 permanece en el calendario y las semanas 1 a 4 no generan adeudos',()=>{
  assert.equal(corteActivo(periodos),true);
  assert.equal(inicioAportaciones(periodos,'2026-2027-A',{inicioDetalle:6}),5);
  assert.equal(rutaPagos(periodos,'2026-2027-A'),'pagosReinicio');
  assert.equal(rutaRetiros(periodos,'2026-2027-A'),'retirosReinicio');
  assert.equal(rutaPagos(periodos,'2026-2027-B'),'pagos');
});
test('todos los saldos arrancan en cero aunque ya existan pagos y retiros de semana 5',()=>{
  const aulas={'2026-2027-A':{'107':{meta:{},pagos:{pago_antiguo:pago(5,10)},retiros:{antiguo:{estado:'aprobado',fondo:'carrera',monto:500}}},'507':{meta:{},pagos:{pago_antiguo:pago(5,20)}}}};
  const r=resumirAhorroReiniciado(aulas,periodos);
  assert.equal(r.totalCarrera,0);assert.equal(r.aportado,0);assert.equal(r.retirado,0);
  assert.equal(r.cifrasConfiables,true);
});
test('el pago NUEVO de semana 5 suma una sola vez a la carrera y los anteriores siguen fuera',()=>{
 const aulas={'2026-2027-A':{'107':{pagos:{a:pago(5,10)},pagosReinicio:{pago_nuevo:pago(5,10)}},'507':{pagos:{b:pago(5,20)},pagosReinicio:{nuevo:pago(5,20)}}}};
 let r=resumirAhorroReiniciado(aulas,periodos);
 assert.equal(r.totalCarrera,30);
 aulas['2026-2027-A']['507'].retirosReinicio={r1:{estado:'aprobado',fondo:'carrera',monto:7,creadoEn:200000}};
 r=resumirAhorroReiniciado(aulas,periodos);assert.equal(r.totalCarrera,23);
});
test('ciclos siguientes suman sus pagos sin transportar movimientos viejos',()=>{
 const aulas={'2026-2027-A':{'507':{pagos:{a:pago(5,20)},pagosReinicio:{b:pago(5,20)}}},'2026-2027-B':{'607':{pagos:{c:pago(1,20),viejo:pago(1,999,10)}}}};
 assert.equal(resumirAhorroReiniciado(aulas,periodos).totalCarrera,40);
});
test('el reinicio no se activa silenciosamente sin la marca administrada',()=>{
 assert.equal(corteActivo({'2026-2027-A':{meta:{semanaBase:4}}}),false);
 assert.throws(()=>resumirAhorroReiniciado({},{}),/no ha sido activado/);
});

test('507 reparte nuevos $20 en $10 de carrera y $10 de su fondo; pagos anteriores conservan su distribución',()=>{
  const aulas={'2026-2027-A':{'507':{meta:{generacionId:'gen-2026-2027-A-507'},pagosReinicio:{
    yaRegistrado:pago(5,20),
    nuevo:{...pago(6,20),fondoGrupo:10,fondoCarrera:10}
  }}}};
  const r=resumirAhorroReiniciado(aulas,periodos);
  assert.equal(r.totalCarrera,30); // Pago previo $20 entero sigue así; nuevo solo $10 a carrera
  assert.equal(r.totalAhorro507,10);
  assert.equal(r.generaciones['gen-2026-2027-A-507'].ahorroGrupo,10);
});
