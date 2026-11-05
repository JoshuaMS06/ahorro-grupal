import test from 'node:test';
import assert from 'node:assert/strict';
import {saldoRetirableSalon,crearRetiroDirecto} from '../lib/retiroDirecto.js';
const periodo='2026-2027-A';
const periodos={[periodo]:{meta:{reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}}};
const pago=(monto,fondoGrupo,fondoCarrera)=>({
  estudianteId:'e1',semana:6,monto,fondoGrupo,fondoCarrera,
  estado:'pagado',creadoEn:200,registradoPor:'responsable'
});
const base=()=>({[periodo]:{
  '507':{meta:{generacionId:'gen-2026-2027-A-507',cuotaSemanal:20},
    pagosReinicio:{a:pago(20,10,10),b:{...pago(20,10,10),estudianteId:'e2'}},retirosReinicio:{}},
  '107':{meta:{cuotaSemanal:10},pagosReinicio:{a:pago(10,0,10)},retirosReinicio:{}}
}});
test('cada responsable solo dispone del fondo aportado por su generación',()=>{
 const aulas=base();
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'107','carrera').disponible,10);
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','carrera').disponible,20);
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','grupo').disponible,20);
 assert.throws(()=>saldoRetirableSalon(aulas,periodos,periodo,'107','grupo'),/solo pertenece/);
});
test('un retiro directo de carrera descuenta el aporte del grupo sin tocar el 507',()=>{
 const aulas=base();
 aulas[periodo]['107'].retirosReinicio.x={...crearRetiroDirecto({uid:'responsable107',monto:7,fondo:'carrera',ahora:300})};
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'107','carrera').disponible,3);
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','carrera').disponible,20);
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','grupo').disponible,20);
});
test('un retiro privado del 507 disminuye únicamente la caja del 507',()=>{
 const aulas=base();
 aulas[periodo]['507'].retirosReinicio.x=crearRetiroDirecto({uid:'responsable507',monto:15,fondo:'grupo',ahora:300});
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','grupo').disponible,5);
 assert.equal(saldoRetirableSalon(aulas,periodos,periodo,'507','carrera').disponible,20);
});
test('el retiro se registra sin justificación solicitada y conserva usuario e importe',()=>{
 const r=crearRetiroDirecto({uid:'responsable507',monto:20,fondo:'grupo',ahora:300});
 assert.equal(r.motivo,'Retiro directo');
 assert.equal(r.estado,'aprobado');
 assert.equal(r.solicitadoPor,'responsable507');
 assert.equal(r.respondidoPor,'responsable507');
 assert.equal(r.monto,20);
});
test('rechaza cantidades inválidas y cuentas sin saldo suficiente',()=>{
 assert.throws(()=>crearRetiroDirecto({uid:'a',monto:-20,fondo:'carrera',ahora:1}),/válidos/);
 assert.throws(()=>saldoRetirableSalon(base(),{},periodo,'107','carrera'),/activada/);
});
