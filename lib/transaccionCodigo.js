// Firebase Admin SDK puede invocar el callback de transacción con null
// antes de recibir el estado remoto. No abortar una rotación por ese null;
// la siguiente invocación compara la versión/digest efectivamente existentes.
export function proponerCambioPin(actual,anterior,accion,nuevo){
  if(!nuevo?.digest||!Number.isSafeInteger(nuevo.version))return;
  if(!['crear','rotar'].includes(accion))return;
  if(actual?.digest){
    if(accion==='crear')return;
    if(!anterior?.digest||actual.digest!==anterior.digest||actual.version!==anterior.version)return;
  }else if(accion==='rotar'&&!anterior?.digest)return;
  return nuevo;
}
