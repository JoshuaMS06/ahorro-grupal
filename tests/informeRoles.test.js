import test from 'node:test';
import assert from 'node:assert/strict';
import {informeVisibleSegunRol} from '../lib/informeRoles.js';
import {GENERACION_ESPECIAL} from '../lib/fondos.js';
const resumen={generaciones:{[GENERACION_ESPECIAL]:{aportacionCarrera:150,ahorroGrupo:240},otra:{aportacionCarrera:100,ahorroGrupo:0}},
 totalCarrera:250,legadoGrupo:1080,retirosNoClasificados:[],cifrasConfiables:true};

test('el general recibe solo dinero de carrera, nunca legado ni ahorro privado',()=>{
 const r=informeVisibleSegunRol(resumen,{tipo:'general'},GENERACION_ESPECIAL);
 assert.equal(r.totalCarrera,250);
 assert.equal(r.aportacionCarrera,150);
 assert.equal('ahorroGrupo' in r,false);
 assert.equal('legadoGrupo' in r,false);
});
test('ningún responsable recibe importes históricos reservados',()=>{
 const r=informeVisibleSegunRol(resumen,{tipo:'responsable'},GENERACION_ESPECIAL);
 assert.equal(r.totalCarrera,250);
 assert.equal('ahorroGrupo' in r,false);
 assert.equal('legadoGrupo' in r,false);
});
test('el responsable de otra generación no recibe fondo privado',()=>{
 const r=informeVisibleSegunRol(resumen,{tipo:'responsable'},'otra');
 assert.equal('ahorroGrupo' in r,false);
});
test('no existen informes sin rol válido',()=>{
 assert.throws(()=>informeVisibleSegunRol(resumen,null,GENERACION_ESPECIAL));
});
