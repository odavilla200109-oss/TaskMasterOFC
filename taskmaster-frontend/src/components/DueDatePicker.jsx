import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DOWS   = ["D","S","T","Q","Q","S","S"];

export function DueDatePicker({node, onFinishEdit, isChild}) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({top:0,left:0});
  const [view, setView] = useState({year:new Date().getFullYear(),month:new Date().getMonth()});
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Sync view to selected date when opening
  useEffect(()=>{
    if(open){
      const d=node.dueDate?new Date(node.dueDate+"T00:00:00"):new Date();
      setView({year:d.getFullYear(),month:d.getMonth()});
    }
  },[open,node.dueDate]);

  // Click-outside to close
  useEffect(()=>{
    if(!open)return;
    const h=e=>{if(!popRef.current?.contains(e.target)&&!btnRef.current?.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[open]);

  const handleOpen=e=>{
    e.stopPropagation();
    if(!open){
      const r=btnRef.current.getBoundingClientRect();
      const calH=296,calW=244;
      const top=window.innerHeight-r.bottom>calH+10?r.bottom+6:r.top-calH-6;
      const left=Math.max(4,Math.min(r.left-calW/2+12,window.innerWidth-calW-4));
      setPos({top,left});
    }
    setOpen(o=>!o);
  };

  const prevMonth=()=>setView(v=>v.month===0?{year:v.year-1,month:11}:{...v,month:v.month-1});
  const nextMonth=()=>setView(v=>v.month===11?{year:v.year+1,month:0}:{...v,month:v.month+1});

  const select=day=>{
    const d=new Date(view.year,view.month,day);
    const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    onFinishEdit(node.title,iso);
    setOpen(false);
  };

  const clear=()=>{onFinishEdit(node.title,null);setOpen(false);};

  const today=new Date();today.setHours(0,0,0,0);
  const sel=node.dueDate?new Date(node.dueDate+"T00:00:00"):null;
  const firstDow=new Date(view.year,view.month,1).getDay();
  const daysInMonth=new Date(view.year,view.month+1,0).getDate();
  const cells=[];
  for(let i=0;i<firstDow;i++)cells.push(null);
  for(let i=1;i<=daysInMonth;i++)cells.push(i);

  return(
    <div style={{position:"relative"}} onMouseDown={e=>e.stopPropagation()}>
      <button ref={btnRef} title="Data de vencimento" className="tm-btn"
        onClick={handleOpen}
        style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6,color:"var(--text-muted)"}}>
        <Ic.Cal s={isChild?11:12}/>
      </button>

      {open&&(
        <div ref={popRef} onMouseDown={e=>e.stopPropagation()}
          style={{
            position:"fixed",top:pos.top,left:pos.left,zIndex:9000,
            background:"var(--bg-card)",backdropFilter:"blur(28px) saturate(160%)",
            border:"1.5px solid var(--border)",borderRadius:18,
            padding:"14px 12px 12px",width:244,
            boxShadow:"0 16px 56px rgba(0,0,0,.22),0 2px 12px rgba(16,185,129,.08)",
            animation:"tmScaleIn .18s cubic-bezier(.34,1.1,.64,1) both",
          }}>

          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <button onClick={prevMonth} className="tm-btn"
              style={{background:"rgba(16,185,129,.07)",border:"none",cursor:"pointer",color:"var(--text-sub)",padding:"4px 9px",borderRadius:8,fontSize:16,lineHeight:1,display:"flex",alignItems:"center"}}>‹</button>
            <span style={{fontWeight:700,fontSize:13,color:"var(--text-main)",fontFamily:"'DM Sans',sans-serif",letterSpacing:-.2}}>
              {MONTHS[view.month]} {view.year}
            </span>
            <button onClick={nextMonth} className="tm-btn"
              style={{background:"rgba(16,185,129,.07)",border:"none",cursor:"pointer",color:"var(--text-sub)",padding:"4px 9px",borderRadius:8,fontSize:16,lineHeight:1,display:"flex",alignItems:"center"}}>›</button>
          </div>

          {/* Day-of-week labels */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:6}}>
            {DOWS.map((d,i)=>(
              <div key={i} style={{textAlign:"center",fontSize:9.5,fontWeight:700,color:"var(--text-muted)",padding:"1px 0",fontFamily:"'DM Sans',sans-serif",letterSpacing:.4}}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((day,i)=>{
              if(!day)return <div key={`e${i}`}/>;
              const d=new Date(view.year,view.month,day);
              const isToday=d.getTime()===today.getTime();
              const isSel=sel&&d.toDateString()===sel.toDateString();
              const isPast=d<today&&!isToday;
              return(
                <button key={day} onClick={()=>select(day)} className="tm-btn"
                  style={{
                    aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",
                    borderRadius:"50%",
                    border:isToday&&!isSel?"1.5px solid rgba(16,185,129,.5)":"1.5px solid transparent",
                    cursor:"pointer",padding:0,
                    fontSize:11.5,fontFamily:"'DM Sans',sans-serif",
                    fontWeight:isSel||isToday?700:400,
                    background:isSel?"#10b981":isToday?"rgba(16,185,129,.1)":"none",
                    color:isSel?"#fff":isPast?"var(--text-muted)":"var(--text-main)",
                    transition:"background .1s",
                  }}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{borderTop:"1px solid var(--border)",marginTop:10,paddingTop:8,display:"flex",gap:6}}>
            {node.dueDate&&(
              <button onClick={clear} className="tm-btn"
                style={{flex:1,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.22)",borderRadius:9,padding:"6px 0",fontSize:11.5,color:"#f87171",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                Limpar
              </button>
            )}
            <button onClick={()=>setOpen(false)} className="tm-btn"
              style={{flex:1,background:"rgba(16,185,129,.06)",border:"1px solid var(--border)",borderRadius:9,padding:"6px 0",fontSize:11.5,color:"var(--text-muted)",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
