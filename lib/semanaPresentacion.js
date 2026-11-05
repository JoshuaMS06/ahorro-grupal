// Etiqueta operativa a partir del lunes 2 de noviembre de 2026:
// semana 4. Los registros del periodo origen ya tienen IDs de semana 5, 6...,
// así que JAMÁS se renombran ni se copian, para no alterar pagos existentes.
export function numeroSemanaVisible(periodo,semanaInterna){
  if(!Number.isSafeInteger(semanaInterna)||semanaInterna<1)throw Error('Semana interna inválida.');
  if(periodo==='2026-2027-A'&&semanaInterna>=5)return semanaInterna-2;
  return semanaInterna;
}
export function etiquetaSemana(periodo,semanaInterna){
  if(periodo==='2026-2027-A'&&semanaInterna<=4)
    return `Histórica ${semanaInterna}`;
  return `Semana ${numeroSemanaVisible(periodo,semanaInterna)}`;
}
