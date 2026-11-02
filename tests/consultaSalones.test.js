import test from 'node:test';
import assert from 'node:assert/strict';
import {informeCompartidoDeSalones} from '../lib/consultaSalones.js';
import {GENERACION_ESPECIAL} from '../lib/fondos.js';

const periodo='2026-2027-A';
const data={
  aulas:{[periodo]:{'107':{meta:{nombre:'Salón 107'}},'507':{meta:{nombre:'Salón 507'}},'907':{meta:{nombre:'Salón 907'}}}},
  periodos:{[periodo]:{salones:{'107':{nombre:'Salón 107'},'507':{nombre:'Salón 507'},'907':{nombre:'Salón 907'}}}},
  periodo,
  resumen:{totalCarrera:220,aportado:300,retirado:80,totalAhorro507:9999,
    generaciones:{
      'gen-2026-2027-A-107':{aportacionCarrera:90,ahorroGrupo:0},
      [GENERACION_ESPECIAL]:{aportacionCarrera:110,ahorroGrupo:9999},
      'gen-2026-2027-A-907':{aportacionCarrera:100,ahorroGrupo:0}
    },cifrasConfiables:true}
};
test('los responsables consultan aportaciones de todos los grupos sin filtrar ahorro privado 507',()=>{
 const resultado=informeCompartidoDeSalones(data);
 assert.equal(resultado.totalCarrera,220);
 assert.deepEqual(resultado.salones.map(x=>[x.salon,x.aportacionCarrera]),[['107',90],['507',110],['907',100]]);
 assert.equal(JSON.stringify(resultado).includes('9999'),false);
 for(const g of resultado.salones) assert.deepEqual(Object.keys(g).sort(),['aportacionCarrera','nombre','salon']);
});
test('no aparecen estudiantes, pagos ni profesorado en el informe compartido',()=>{
 const resultado=informeCompartidoDeSalones(data);
 assert.equal('aulas' in resultado,false);
 assert.equal('generaciones' in resultado,false);
 assert.equal('totalAhorro507' in resultado,false);
 assert.equal('profesoresAhorro' in resultado,false);
});
test('un ciclo desconocido se rechaza sin revelar saldos',()=>{
 assert.throws(()=>informeCompartidoDeSalones({...data,periodo:'2027-2028-A'}),/No existe/);
});
