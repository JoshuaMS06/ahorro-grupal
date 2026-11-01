import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararExcel,revisarCoincidencias,idImportacion} from '../lib/importarExcel.js';

const cabecera=['Nº','Nº CONTROL','NOMBRE','CURP','NACIMIENTO'];
const fila=(n,c,id) => [n,c,id,'ESTO-NO-SE-DEBE-COPIAR','2008-01-01'];

test('reconoce cinco hojas y omite la hoja Todos sin duplicar estudiantes',()=>{
 const hojas=['107','307','507','707','907'].map((n,i)=>({sheet:n,data:[cabecera,fila(1,12000+i,`ESTUDIANTE ${n}`)]}));
 hojas.push({sheet:'Todos',data:[cabecera,...hojas.map((_,i)=>fila(i+1,i,`DUPLICADO ${i}`))]});
 const res=prepararExcel(hojas,'107');
 assert.equal(res.total,5);assert.equal(res.salonesCount,5);
 assert.deepEqual(Object.keys(res.salones),['107','307','507','707','907']);
 assert.deepEqual(Object.keys(res.salones['107'][0]).sort(),['control','id','nombre']);
 assert.ok(!JSON.stringify(res).includes('ESTO-NO-SE-DEBE-COPIAR'));
});

test('reconoce salón por nombre o usa el seleccionado para una sola hoja',()=>{
 const res=prepararExcel([{sheet:'Hoja1',data:[['Nombre completo','Matrícula'],['Ana Ejemplo','00123']]}],'907');
 assert.equal(res.salones['907'][0].control,'00123');
 assert.equal(res.salones['907'][0].nombre,'Ana Ejemplo');
 assert.equal(prepararExcel([{sheet:'Salón 507',data:[cabecera,fila(1,1,'Alumno Ejemplo')]}],'107').salonesCount,1);
});

test('no duplica el consolidado de Todos y rechaza hojas ambiguas',()=>{
 assert.throws(()=>prepararExcel([{sheet:'Todos',data:[cabecera,fila(1,1,'Estudiante Ejemplo')]}],'107'),/Todos/);
 assert.throws(()=>prepararExcel([{sheet:'A',data:[cabecera,fila(1,1,'Alumno Uno')]},{sheet:'B',data:[cabecera,fila(1,2,'Alumno Dos')]}],'107'),/salón identificable/);
});

test('exige columna de nombre y evita duplicados dentro del Excel',()=>{
 assert.throws(()=>prepararExcel([{sheet:'107',data:[['Edad'],[19]]}],'107'),/columna NOMBRE/);
 assert.throws(()=>prepararExcel([{sheet:'107',data:[cabecera,fila(1,1,'Ana Ejemplo'),fila(2,2,'ANA EJEMPLO')]}],'107'),/duplicado/);
});

test('el identificador es estable y nunca se construye desde datos arbitrarios del Excel',()=>{
 assert.equal(idImportacion('107','María López',123),idImportacion('107','Maria Lopez','123'));
 assert.match(idImportacion('107','Nombre', 'alumno/.#[]'),/^imp_[0-9a-f]{16}$/);
});

test('respeta alumnos existentes y detecta matrícula utilizada por otra persona',()=>{
 const input=prepararExcel([{sheet:'107',data:[cabecera,fila(1,'123','Ana Ejemplo'),fila(2,'234','Pedro Nuevo'),fila(3,'345','Lucía Nueva')]}],'107').salones['107'];
 const result=revisarCoincidencias(input,{
  s001:{nombre:'ANA EJEMPLO',control:'123'},
  s002:{nombre:'Carlos Antiguo',control:'345'}
 });
 assert.equal(result.repetidos.length,1);
 assert.equal(result.nuevos.length,1);
 assert.equal(result.conflictos.length,1);
});

test('preflight de importación repetida no reescribe el registro',()=>{
 const a=prepararExcel([{sheet:'107',data:[cabecera,fila(1,110,'Alumno Uno')]}],'107').salones['107'];
 assert.equal(revisarCoincidencias(a,{[a[0].id]:a[0]}).nuevos.length,0);
});
