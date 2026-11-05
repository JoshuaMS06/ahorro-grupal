import test from 'node:test';
import assert from 'node:assert/strict';
import {crearIngresoExtra,sumarIngresosExtras} from '../lib/ingresosExtras.js';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {informeVisibleSegunRol} from '../lib/informeRoles.js';
const periodo='2026-2027-A';
const periodos={[periodo]:{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}}};
const pago=(monto,grupo,carrera)=>({
 estado:'pagado',estudianteId:'estudiante',semana:5,monto,fondoGrupo:grupo,fondoCarrera:carrera,creadoEn:200
});
const aulas={[periodo]:{
 '507':{meta:{cuotaSemanal:20},pagosReinicio:{a:pago(20,10,10)}},
 '107':{meta:{cuotaSemanal:10},pagosReinicio:{a:pago(10,0,10)}}
}};
test('administrador registra extra sin atribuir a una persona o salón',()=>{
 const e=crearIngresoExtra({uid:'general',monto:75,periodo,ahora:300});
 assert.deepEqual(Object.keys(e).sort(),['creadoEn','estado','fondo','monto','periodo','registradoPor','tipo'].sort());
 assert.equal(e.monto,75);
 assert.equal(e.estado,'confirmado');
 assert.equal('estudianteId' in e,false);
 assert.equal('salon' in e,false);
 assert.equal('motivo' in e,false);
});
test('extra aumenta el fondo general una sola vez, sin afectar el ahorro privado 507 ni aportación de salones',()=>{
 const extras={[periodo]:{i1:crearIngresoExtra({uid:'general',monto:75,periodo,ahora:300})}};
 const antes=structuredClone(aulas);
 const r=resumirAhorroReiniciado(aulas,periodos,extras);
 assert.equal(r.aportado,20);
 assert.equal(r.extraIngresado,75);
 assert.equal(r.totalCarrera,95);
 assert.equal(r.totalAhorro507,10);
 assert.equal(r.generaciones['gen-2026-2027-A-507'].aportacionCarrera,10);
 assert.equal(r.generaciones['gen-2026-2027-A-107'].aportacionCarrera,10);
 assert.deepEqual(aulas,antes);
 const propio=informeVisibleSegunRol(r,{tipo:'responsable'},'gen-2026-2027-A-107');
 assert.equal(propio.aportacionCarrera,10);
 assert.equal(propio.saldoCarreraSalon,10);
 assert.equal('extraIngresado' in propio,false);
 const admin=informeVisibleSegunRol(r,{tipo:'general'},'gen-2026-2027-A-107');
 assert.equal(admin.extraIngresado,75);
});
test('retiros de Industrial restan del total incluidos los extras y permanecen aprobados',()=>{
 const extras={[periodo]:{i1:crearIngresoExtra({uid:'general',monto:100,periodo,ahora:300})}};
 const actual=structuredClone(aulas);
 actual[periodo]['107'].retirosReinicio={r1:{
  monto:6,fondo:'carrera',estado:'aprobado',tipo:'directo',creadoEn:350,respondidoEn:350
 }};
 const r=resumirAhorroReiniciado(actual,periodos,extras);
 assert.equal(r.totalCarrera,114); // 10+10+100 - 6
 assert.equal(r.totalAhorro507,10);
 assert.equal(r.retirado,6);
});
test('no se vuelven a incorporar extras del corte anterior ni ingresos fallidos',()=>{
 const ingresos={[periodo]:{
  antiguo:crearIngresoExtra({uid:'general',monto:40,periodo,ahora:99}),
  vigente:crearIngresoExtra({uid:'general',monto:15,periodo,ahora:300}),
  cancelado:{...crearIngresoExtra({uid:'general',monto:100,periodo,ahora:301}),estado:'cancelado'}
 }};
 assert.deepEqual(sumarIngresosExtras(ingresos,100),{total:15,cantidad:1});
 assert.throws(()=>sumarIngresosExtras({[periodo]:{a:{tipo:'ingresoExtra',estado:'confirmado',monto:-5,creadoEn:200}}},100),/importe/);
});
