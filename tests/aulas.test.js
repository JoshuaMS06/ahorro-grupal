import test from 'node:test';
import assert from 'node:assert/strict';
import { CUOTA_SEMANAL, semanaPeriodo, estadoSemana, pagosActivos, resumenCaja, pagoClave, validarImportacion, esLunes } from '../lib/aulas.js';
const period={lunesBase:'2026-10-19',semanaBase:4};
test('fecha de semana 4 y 5 en México',()=>{
  assert.equal(semanaPeriodo(period,Date.parse('2026-10-26T05:59:59Z')),4);
  assert.equal(semanaPeriodo(period,Date.parse('2026-10-26T06:00:00Z')),5);
});
test('lunes válido',()=>{assert.equal(esLunes('2026-10-19'),true);assert.equal(esLunes('2026-10-20'),false);});
test('ingresos separados de retiros, nunca en dos fondos',()=>{
  assert.equal(CUOTA_SEMANAL,20);
  assert.deepEqual(resumenCaja({a:{estado:'pagado',monto:20},b:{estado:'anulado',monto:20}},{x:{estado:'solicitado',monto:10},y:{estado:'aprobado',monto:5}},40),{recaudado:60,retirado:5,saldo:55});
});
test('un registro por estudiante y semana',()=>{
 const k=pagoClave('s001',5);assert.equal(k,'s001_s0005');
 assert.equal(estadoSemana({[k]:{estado:'pagado'}},'s001',5),'pagado');
 assert.equal(estadoSemana({[k]:{estado:'anulado'}},'s001',5),'pendiente');
 assert.equal(pagosActivos({[k]:{estado:'pagado'}}).length,1);
});
test('importación de listas: estructura válida y deduplicación',()=>{
 const data={version:1,periodo:{id:'2026-2027-A',lunesBase:'2026-10-19'},salones:{'507':[{id:'s001',nombre:'Persona de prueba'}]}};
 assert.deepEqual(validarImportacion(data),{total:1,salones:1});
 assert.throws(()=>validarImportacion({...data,salones:{'507':[data.salones['507'][0],data.salones['507'][0]]}}));
});

test('un ciclo archivado conserva su última semana mientras pasan los años',()=>{
  assert.equal(semanaPeriodo({lunesBase:'2026-10-19',semanaBase:4,cerradoEn:12345,semanaCierre:5},Date.parse('2028-10-25T07:00:00Z')),5);
});
