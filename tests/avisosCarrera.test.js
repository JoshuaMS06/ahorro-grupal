import test from 'node:test';
import assert from 'node:assert/strict';
import {avisoPublicoRetiro,listarAvisosCarrera,publicarAvisoRetiro} from '../lib/avisosCarrera.js';

test('aviso compartido muestra solo que se retiró dinero del fondo Industrial',()=>{
 const aviso=avisoPublicoRetiro({monto:60,fecha:200});
 assert.deepEqual(aviso,{tipo:'retiroCarrera',monto:60,fecha:200,estado:'realizado'});
 assert.equal('solicitadoPor' in aviso,false);
 assert.equal('motivo' in aviso,false);
 assert.equal('fondoGrupo' in aviso,false);
});
test('el aviso se publica bajo metadata del ciclo para todos los participantes, una clave estable',async()=>{
 let path='',publicado=null;
 const db={ref:p=>({set:async v=>{path=p;publicado=v;}})};
 const id=await publicarAvisoRetiro(db,{periodo:'2026-2027-A',salon:'507',
  retiroId:'-MovId123456',monto:10,fecha:300});
 assert.equal(id,'507_-MovId123456');
 assert.equal(path,`periodos/2026-2027-A/meta/avisosCarrera/${id}`);
 assert.deepEqual(publicado,avisoPublicoRetiro({monto:10,fecha:300}));
});
test('lectura muestra solo retiros realizados, sin duplicar solicitados ni exponer privados',()=>{
 const lista=listarAvisosCarrera({
   r1:avisoPublicoRetiro({monto:10,fecha:300}),
   r2:{tipo:'retiroPrivado507',monto:55,fecha:400,estado:'realizado'},
   r3:{tipo:'retiroCarrera',monto:50,fecha:200,estado:'solicitado'}
 });
 assert.equal(lista.length,1);
 assert.deepEqual(Object.keys(lista[0]).sort(),['estado','fecha','id','monto','tipo']);
});
