import test from 'node:test';
import assert from 'node:assert/strict';
import {cuotaDeSalon} from '../lib/aulas.js';
import {distribucionNueva,distribucionDePago} from '../lib/fondos.js';
import {informeVisibleSegunRol} from '../lib/informeRoles.js';

test('507 divide $20 en dos ahorros; los demás salones aportan íntegro a carrera',()=>{
  for (const salon of ['107','307','507','707','907']) {
    const cuota=cuotaDeSalon(salon,{cuotaSemanal:salon==='507'?20:10});
    const d=distribucionNueva('2026-2027-A',salon,{cuotaSemanal:cuota});
    assert.equal(d.grupo,salon==='507'?10:0);
    assert.equal(d.carrera,salon==='507'?10:cuota);
    assert.deepEqual(distribucionDePago({estado:'pagado',monto:cuota,fondoGrupo:0,fondoCarrera:cuota},'2026-2027-A',salon),{grupo:0,carrera:cuota});
  }
});
test('ningún rol recibe campos de fondos ajenos al de carrera',()=>{
  const informe={generaciones:{demo:{aportacionCarrera:100,ahorroGrupo:400}},totalCarrera:100,legadoGrupo:800,retirosNoClasificados:[],cifrasConfiables:true};
  for (const tipo of ['general','responsable']) {
    const visible=informeVisibleSegunRol(informe,{tipo},'demo');
    assert.equal(visible.totalCarrera,100);
    assert.equal('ahorroGrupo' in visible,false);
    assert.equal('legadoGrupo' in visible,false);
  }
});
