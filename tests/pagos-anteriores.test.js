import test from 'node:test';
import assert from 'node:assert/strict';
import {esSemanaAnterior,rutaPagoSeleccionado,primeraSemanaVisible,esPagoLegado,resumenPagosAnteriores} from '../lib/pagosAnteriores.js';
import {resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {semanaPeriodo,pagoClave} from '../lib/aulas.js';

const periodos={'2026-2027-A':{meta:{lunesBase:'2026-10-19',semanaBase:4,reinicioContable:{version:1,semanaInicio:5,activadoEn:100}}}};

test('semanas 1–4 visibles y registrables exclusivamente como pagos anteriores',()=>{
 for(const n of [1,2,3,4]){
  assert.equal(esSemanaAnterior(periodos,'2026-2027-A',n),true);
  assert.equal(rutaPagoSeleccionado(periodos,'2026-2027-A',n),'pagosAnteriores');
 }
 assert.equal(primeraSemanaVisible(periodos,'2026-2027-A',periodos['2026-2027-A'].meta,{inicioDetalle:6}),1);
 for(const n of [5,6,7]){
  assert.equal(esSemanaAnterior(periodos,'2026-2027-A',n),false);
  assert.equal(rutaPagoSeleccionado(periodos,'2026-2027-A',n),'pagosReinicio');
 }
 assert.equal(rutaPagoSeleccionado(periodos,'2026-2027-B',1),'pagos');
});

test('sin activación no se abre ruta nueva de pagos anteriores',()=>{
 const periodosSinCorte={'2026-2027-A':{meta:{lunesBase:'2026-10-19',semanaBase:4}}};
 assert.equal(esSemanaAnterior(periodosSinCorte,'2026-2027-A',4),false);
 assert.equal(rutaPagoSeleccionado(periodosSinCorte,'2026-2027-A',4),'pagos');
});

test('los pagos anteriores no modifican el saldo nuevo desde la semana 5',()=>{
 const anterior={tipoRegistro:'anterior',estudianteId:'e1',semana:3,monto:10,fondoCarrera:0,fondoGrupo:0,estado:'pagado',creadoEn:200};
 const aulas={'2026-2027-A':{'107':{meta:{cuotaSemanal:10},pagosAnteriores:{[pagoClave('e1',3)]:anterior},pagosReinicio:{}}}};
 assert.deepEqual(resumenPagosAnteriores(aulas['2026-2027-A']['107'].pagosAnteriores),{registros:1,importeHistorico:10});
 assert.equal(resumirAhorroReiniciado(aulas,periodos).totalCarrera,0);
 aulas['2026-2027-A']['107'].pagosReinicio[pagoClave('e1',5)]={...anterior,semana:5,monto:10,fondoCarrera:10,fondoGrupo:0,creadoEn:300,tipoRegistro:undefined};
 assert.equal(resumirAhorroReiniciado(aulas,periodos).totalCarrera,10);
});

test('se respeta pago legado sin duplicarlo y el resumen histórico ignora anulados',()=>{
 const legado={[pagoClave('e1',2)]:{estado:'pagado'}};
 assert.equal(esPagoLegado(legado,'e1',2),true);
 assert.equal(esPagoLegado(legado,'e1',3),false);
 assert.deepEqual(resumenPagosAnteriores({a:{tipoRegistro:'anterior',semana:1,estado:'pagado',monto:20},b:{tipoRegistro:'anterior',semana:2,estado:'anulado',monto:10},c:{tipoRegistro:'anterior',semana:7,estado:'pagado',monto:100}}),{registros:1,importeHistorico:20});
});

test('el calendario sigue avanzando automáticamente los lunes en horario de México',()=>{
 const meta=periodos['2026-2027-A'].meta;
 // 2026-11-01 en México (domingo) y 2026-11-02 (lunes)
 assert.equal(semanaPeriodo(meta,Date.parse('2026-11-02T05:59:00Z')),5);
 assert.equal(semanaPeriodo(meta,Date.parse('2026-11-02T06:00:00Z')),6);
});
