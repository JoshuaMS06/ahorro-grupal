import test from 'node:test';
import assert from 'node:assert/strict';
import {semanaPeriodo,pagoClave} from '../lib/aulas.js';
import {etiquetaSemana,numeroSemanaVisible} from '../lib/semanaPresentacion.js';
import {semanaActualMexico} from '../lib/semanaAutomatica.js';
const meta={lunesBase:'2026-10-19',semanaBase:4};
test('lunes 2 de noviembre es semana 4 para todos, el siguiente lunes semana 5',()=>{
 const inicio=Date.parse('2026-11-02T00:00:00-06:00');
 const sig=Date.parse('2026-11-09T00:00:00-06:00');
 const interna4=semanaPeriodo(meta,inicio);
 assert.equal(interna4,6);
 assert.equal(numeroSemanaVisible('2026-2027-A',interna4),4);
 assert.equal(numeroSemanaVisible('2026-2027-A',semanaPeriodo(meta,sig)),5);
 assert.equal(semanaActualMexico(inicio),4);
 assert.equal(semanaActualMexico(sig),5);
});
test('semana 4 operativa conserva la clave de pago interna, sin reescribir importes',()=>{
 const interna=semanaPeriodo(meta,Date.parse('2026-11-04T12:00:00-06:00'));
 assert.equal(interna,6);
 assert.equal(pagoClave('e001',interna),'e001_s0006');
 assert.equal(etiquetaSemana('2026-2027-A',interna),'Semana 4');
 assert.equal(etiquetaSemana('2026-2027-A',5),'Semana 3');
 assert.equal(etiquetaSemana('2026-2027-A',3),'Histórica 3');
 assert.equal(etiquetaSemana('2026-2027-B',3),'Semana 3');
});
