import {useState} from 'react';
import {Check,ChevronDown,Pin,UserRound,Wallet,CalendarCheck2} from 'lucide-react';
import {resumenRegistroPersonal} from '../lib/registroPersonal.js';
import './MiRegistro.css';

const pesos=m=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(m)||0);

export default function MiRegistro({salon,semana,fechas,lista,seleccionado,pagos,estado,guardar}){
  const [cambiar,setCambiar]=useState(false);
  const persona=lista.find(e=>e.id===seleccionado);
  const resumen=resumenRegistroPersonal(pagos,persona?.id);
  const actual=persona?estado(persona):'sin-dato';
  const pagado=actual==='pagado';
  const verSelector=!persona||cambiar;
  return <section className="ag-me-section" aria-label="Mi registro fijado">
    <div className="ag-me-topline"><span><Pin size={16}/> Mi registro</span><span>Salón {salon}</span></div>
    {verSelector&&<div className="ag-me-choose">
      <label htmlFor="ag-select-myself">Elige tu nombre para dejarlo arriba</label>
      <div className="ag-me-select-wrap">
        <UserRound size={19}/>
        <select id="ag-select-myself" value={persona?.id||''} onChange={e=>{guardar(e.target.value||null);setCambiar(false);}}>
          <option value="">Selecciona tu nombre…</option>
          {lista.map(e=><option key={e.id} value={e.id}>{e.nombreVisible}</option>)}
        </select>
        <ChevronDown size={17}/>
      </div>
      <p>La selección se recuerda en este dispositivo. No confirma tu identidad ni cambia permisos o pagos.</p>
      {persona&&<button type="button" className="ag-me-text-button" onClick={()=>setCambiar(false)}>Cancelar</button>}
    </div>}
    {persona&&<div className="ag-me-card">
      <div className="ag-me-name-row">
        <div className="ag-me-avatar"><UserRound size={27}/></div>
        <div className="ag-me-person">
          <strong>{persona.nombreVisible}</strong>
          <span>Tu registro destacado</span>
        </div>
        {!cambiar&&<button type="button" className="ag-me-change" onClick={()=>setCambiar(true)}>Cambiar</button>}
      </div>
      <div className="ag-me-week">
        <div><span>Semana actual</span><strong>{semana}</strong>{fechas&&<small className="ag-me-week-range">{fechas}</small>}</div>
        <span className={`ag-me-payment ${pagado?'is-paid':actual==='pendiente'?'is-pending':'is-unknown'}`}>
          {pagado&&<Check size={17}/>} {pagado?'Pagó':actual==='pendiente'?'Pendiente':'Sin datos'}
        </span>
      </div>
    </div>}
    {persona&&<div className="ag-me-stats">
      <div><Wallet size={20}/><span>Mis aportaciones registradas</span><strong>{pesos(resumen.totalAportado)}</strong></div>
      <div><CalendarCheck2 size={20}/><span>Semanas pagadas</span><strong>{resumen.semanasPagadas}</strong></div>
    </div>}
  </section>;
}
