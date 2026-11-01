import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticarActivacion,prepararActivacionSegura} from '../lib/activacionSegura.js';
import {corteActivo, inicioAportaciones, resumirAhorroReiniciado} from '../lib/reinicioContable.js';

const periodo='2026-2027-A';
function base() {
  const codigos=['107','307','507','707','907'];
  return {roles:{adminGeneralUid:'admin',porUsuario:{}},ahorro:{integrantes:{antiguo:{pagos:99}}},
    periodos:{[periodo]:{meta:{nombre:'2026-2027 A',lunesBase:'2026-10-19',semanaBase:4},
      salones:Object.fromEntries(codigos.map(s=>[s,{nombre:`Salón ${s}`}]))}},
    aulas:{[periodo]:Object.fromEntries(codigos.map(s=>[s,{meta:{cuotaSemanal:s==='507'?20:10,inicioDetalle:s==='507'?6:5},integrantes:{s001:{nombre:'Ejemplo'}}}]))}};
}
const tiempo=1793577000000;

test('diagnóstico devuelve solo conteos y cuotas, sin nombres de estudiantes',()=>{
  const r=diagnosticarActivacion(base());
  assert.equal(r.totalIntegrantes,5);
  assert.equal(r.saldoInicial,0);
  assert.equal(r.salones.find(x=>x.salon==='507').cuotaSemanal,20);
  assert.equal(r.salones.find(x=>x.salon==='507').inicioDetalleAnterior,6);
  assert.equal(JSON.stringify(r).includes('Ejemplo'),false);
});
test('activación solo agrega marcador, mantiene salones, pagos, historial y roles',()=>{
  const d=base();d.aulas[periodo]['507'].pagos={viejo:{estado:'pagado',monto:20,creadoEn:tiempo-1000}};
  const copia=structuredClone(d);
  const salida=prepararActivacionSegura(d,'admin',tiempo).raiz;
  assert.deepEqual(d,copia);
  assert.deepEqual(salida.aulas,copia.aulas);
  assert.deepEqual(salida.ahorro,copia.ahorro);
  assert.deepEqual(salida.roles,copia.roles);
  assert.equal(salida.periodos[periodo].meta.reinicioContable.activadoEn,tiempo);
  assert.equal(corteActivo(salida.periodos),true);
  assert.equal(inicioAportaciones(salida.periodos,periodo,{inicioDetalle:6}),5);
  assert.equal(resumirAhorroReiniciado(salida.aulas,salida.periodos).totalCarrera,0);
});
test('no se puede activar dos veces ni reemplazar un marcador parcial',()=>{
  const primera=prepararActivacionSegura(base(),'admin',tiempo).raiz;
  assert.throws(()=>prepararActivacionSegura(primera,'admin',tiempo),/Ya existe/);
  const d=base();d.periodos[periodo].meta.reinicioContable={version:1};
  assert.throws(()=>diagnosticarActivacion(d),/Ya existe/);
});
test('impide activación sin administrador válido y con retiro pendiente',()=>{
  assert.throws(()=>prepararActivacionSegura(base(),'intruso',tiempo),/autorización/);
  const d=base();d.aulas[periodo]['107'].retiros={uno:{estado:'solicitado',monto:10}};
  assert.throws(()=>diagnosticarActivacion(d),/retiros pendientes/);
});
test('impide perder pagos nuevos, datos incompletos o calendario no comprobado',()=>{
  const d=base();d.aulas[periodo]['507'].pagosReinicio={a:{estado:'pagado'}};
  assert.throws(()=>diagnosticarActivacion(d),/Ya existen movimientos/);
  delete d.aulas[periodo]['507'].pagosReinicio;
  d.periodos[periodo].meta.semanaBase=5;
  assert.throws(()=>diagnosticarActivacion(d),/base del calendario/);
  d.periodos[periodo].meta.semanaBase=4;
  delete d.aulas[periodo]['707'];
  assert.throws(()=>diagnosticarActivacion(d),/cinco salones/);
});
test('filtro de marcador incompleto evita mostrar saldo o admitir pagos prematuramente',()=>{
  const d=base();d.periodos[periodo].meta.reinicioContable={version:1,semanaInicio:5};
  assert.equal(corteActivo(d.periodos),false);
});
