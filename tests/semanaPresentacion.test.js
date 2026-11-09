import test from 'node:test';
import assert from 'node:assert/strict';
import {semanaPeriodo,pagoClave} from '../lib/aulas.js';
import {etiquetaSemana,numeroSemanaVisible,rangoFechasSemana,fechasSemana,opcionSemana,textoConfirmacionRestaurarPago} from '../lib/semanaPresentacion.js';
import {semanaActualMexico,proximoLunesMexico} from '../lib/semanaAutomatica.js';
const periodo='2026-2027-A';
const meta={lunesBase:'2026-10-19',semanaBase:4};
const fecha=t=>Date.parse(`${t}T12:00:00-06:00`);

test('octubre 2026 empieza en Semana 1 y termina en Semana 4',()=>{
 assert.equal(etiquetaSemana(periodo,2,meta),'Semana 1 de octubre');
 assert.equal(etiquetaSemana(periodo,3,meta),'Semana 2 de octubre');
 assert.equal(etiquetaSemana(periodo,4,meta),'Semana 3 de octubre');
 assert.equal(etiquetaSemana(periodo,5,meta),'Semana 4 de octubre');
 assert.equal(rangoFechasSemana(periodo,2,meta),'05/10/2026 – 11/10/2026');
 assert.equal(rangoFechasSemana(periodo,5,meta),'26/10/2026 – 01/11/2026');
 assert.doesNotMatch(etiquetaSemana(periodo,3,meta),/históric/i);
});

test('noviembre reinicia en Semana 1 y progresa el siguiente lunes',()=>{
 const internaNov=semanaPeriodo(meta,fecha('2026-11-02'));
 assert.equal(internaNov,6);
 assert.equal(etiquetaSemana(periodo,internaNov,meta),'Semana 1 de noviembre');
 assert.equal(numeroSemanaVisible(periodo,internaNov,meta),1);
 assert.equal(rangoFechasSemana(periodo,internaNov,meta),'02/11/2026 – 08/11/2026');
 assert.equal(opcionSemana(periodo,internaNov,meta),'Sem. 1 nov · 02-08 nov');
 assert.equal(semanaActualMexico(fecha('2026-11-02')),1);
 assert.equal(etiquetaSemana(periodo,7,meta),'Semana 2 de noviembre');
 assert.equal(semanaActualMexico(fecha('2026-11-09')),2);
 assert.match(proximoLunesMexico(fecha('2026-11-09')),/16 de noviembre/);
});

test('la semana que cruza de mes pertenece al mes donde cayó su lunes',()=>{
 assert.equal(etiquetaSemana(periodo,5,meta),'Semana 4 de octubre');
 assert.equal(rangoFechasSemana(periodo,5,meta),'26/10/2026 – 01/11/2026');
 assert.equal(semanaActualMexico(fecha('2026-11-01')),4);
 assert.equal(semanaActualMexico(fecha('2026-11-02')),1);
 assert.equal(etiquetaSemana(periodo,1,meta),'Semana 4 de septiembre');
 assert.equal(rangoFechasSemana(periodo,1,meta),'28/09/2026 – 04/10/2026');
});

test('enero reinicia y diciembre conserva fechas al cruzar año nuevo',()=>{
 const siguiente={lunesBase:'2026-12-28',semanaBase:1};
 const period='2026-2027-B';
 assert.equal(etiquetaSemana(period,1,siguiente),'Semana 4 de diciembre');
 assert.equal(rangoFechasSemana(period,1,siguiente),'28/12/2026 – 03/01/2027');
 assert.equal(etiquetaSemana(period,2,siguiente),'Semana 1 de enero');
 assert.equal(rangoFechasSemana(period,2,siguiente),'04/01/2027 – 10/01/2027');
});

test('no inventa fechas en ciclos sin calendario válido',()=>{
 assert.equal(etiquetaSemana('2027-2028-A',3),'Semana 3');
 assert.equal(numeroSemanaVisible('2027-2028-A',3),3);
 assert.equal(rangoFechasSemana('2027-2028-A',3),'');
 assert.equal(fechasSemana('2027-2028-A',3,{lunesBase:'lunes',semanaBase:3}),null);
 assert.throws(()=>etiquetaSemana(period,0,meta),/inválida/);
});

test('una fecha visible NO altera la llave ni el importe de un pago existente',()=>{
 const semanaInterna=semanaPeriodo(meta,fecha('2026-11-04'));
 assert.equal(semanaInterna,6);
 assert.equal(pagoClave('e001',semanaInterna),'e001_s0006');
 assert.equal(etiquetaSemana(period,semanaInterna,meta),'Semana 1 de noviembre');
 const aviso=textoConfirmacionRestaurarPago(period,semanaInterna,'Alumno de prueba',meta);
 assert.match(aviso,/Alumno de prueba \(Semana 1 de noviembre\)/);
 assert.doesNotMatch(aviso,/Histórica|Semana 6/);
 assert.match(aviso,/historial/);
});
