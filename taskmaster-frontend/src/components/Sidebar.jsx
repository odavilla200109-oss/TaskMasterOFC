import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";
import { MAX_WS } from "../config/constants";

export function Sidebar({canvases,activeId,onSelect,onCreate,onDelete,onRename,membersMap,collapsed,onToggle}) {
  const [renaming,setRenaming]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const [creating,setCreating]=useState(null); // null | "task" | "brain"
  const [createVal,setCreateVal]=useState("");
  const createRef=useRef(null);

  useEffect(()=>{if(creating)createRef.current?.select();},[creating]);

  const startCreate=type=>{
    if(canvases.length>=MAX_WS)return;
    setCreating(type);
    setCreateVal("Novo Workspace");
  };

  const confirmCreate=()=>{
    if(createVal.trim())onCreate(creating,createVal.trim());
    setCreating(null);setCreateVal("");
  };

  const cancelCreate=()=>{setCreating(null);setCreateVal("");};

  const W=collapsed?40:224;

  return (
    <div style={{position:"fixed",left:0,top:56,bottom:0,width:W,zIndex:500,background:"var(--bg-glass)",backdropFilter:"blur(20px) saturate(160%)",borderRight:"1.5px solid var(--border)",display:"flex",flexDirection:"column",padding:"10px 6px",gap:3,overflowY:"auto",transition:"width .2s",overflow:"hidden"}}>
      {collapsed?(
        <>
          <button onClick={onToggle} className="tm-btn" title="Expandir" style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"6px",borderRadius:8,display:"flex",justifyContent:"center",marginBottom:4}}>
            <Ic.ChevR s={13}/>
          </button>
          {canvases.map(c=>(
            <button key={c.id} onClick={()=>onSelect(c.id)} title={c.name} className="tm-btn" style={{width:28,height:28,borderRadius:"50%",border:`2px solid ${c.id===activeId?"#10b981":"var(--border)"}`,background:c.id===activeId?"rgba(16,185,129,.15)":"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",color:c.id===activeId?"#10b981":"var(--text-muted)",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif",transition:"all .15s"}}>
              {c.type==="brain"?<Ic.Brain s={12} c={c.id===activeId?"#10b981":"var(--text-muted)"}/>:c.name[0]?.toUpperCase()}
            </button>
          ))}
        </>
      ):(
        <>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"2px 8px 6px",marginBottom:2}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:1.8,textTransform:"uppercase"}}>
              Workspaces ({canvases.length}/{MAX_WS})
            </span>
            <button onClick={onToggle} className="tm-btn" title="Recolher" style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:"2px",display:"flex"}}>
              <Ic.ChevL s={12}/>
            </button>
          </div>

          {canvases.map(c=>{
            const active=c.id===activeId;
            const members=membersMap[c.id]||0;
            return (
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:3,borderRadius:10,background:active?"rgba(16,185,129,.11)":"transparent",border:active?"1px solid rgba(16,185,129,.25)":"1px solid transparent",padding:"2px 4px",transition:"all .15s"}}>
                <div style={{flexShrink:0,width:18,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {c.type==="brain"
                    ?<Ic.Brain s={13} c={active?"#10b981":"var(--text-muted)"}/>
                    :<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="2" stroke={active?"#10b981":"var(--text-muted)"} strokeWidth="1.3"/><path d="M4 6H8M6 4V8" stroke={active?"#10b981":"var(--text-muted)"} strokeWidth="1.3" strokeLinecap="round"/></svg>
                  }
                </div>
                {renaming===c.id?(
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                    onBlur={()=>{onRename(c.id,renameVal);setRenaming(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){onRename(c.id,renameVal);setRenaming(null);}if(e.key==="Escape")setRenaming(null);}}
                    style={{flex:1,border:"none",outline:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"var(--text-main)",padding:"6px 3px"}}/>
                ):(
                  <button onClick={()=>onSelect(c.id)} onDoubleClick={()=>{setRenaming(c.id);setRenameVal(c.name);}}
                    style={{flex:1,background:"none",border:"none",cursor:"pointer",textAlign:"left",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,fontWeight:active?600:400,color:active?"#10b981":"var(--text-main)",padding:"6px 4px",borderRadius:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {c.name}
                  </button>
                )}
                {c.hasViewIndefLock&&<span title="Link ∞ ativo" style={{flexShrink:0,fontSize:8.5,color:"#f59e0b",opacity:.8}}>∞</span>}
                {members>1&&<span style={{fontSize:9.5,color:"#10b981",background:"rgba(16,185,129,.12)",borderRadius:20,padding:"1px 5px",fontWeight:600,flexShrink:0,fontFamily:"'DM Sans',sans-serif"}}>{members}</span>}
                {canvases.length>1&&(
                  <button onClick={()=>onDelete(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"3px",borderRadius:5,opacity:.4,flexShrink:0,transition:"opacity .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                    onMouseLeave={e=>e.currentTarget.style.opacity="0.4"}>
                    <Ic.Trash s={10}/>
                  </button>
                )}
              </div>
            );
          })}

          {/* Inline workspace creation */}
          {creating?(
            <div style={{marginTop:6,padding:"8px 6px 4px",background:"rgba(16,185,129,.04)",borderRadius:10,border:`1.5px solid ${creating==="brain"?"rgba(139,92,246,.3)":"rgba(16,185,129,.3)"}`}}>
              <div style={{fontSize:9.5,fontWeight:700,color:creating==="brain"?"#8b5cf6":"#10b981",fontFamily:"'DM Sans',sans-serif",marginBottom:5,letterSpacing:.8,textTransform:"uppercase"}}>
                {creating==="brain"?"Brainstorm":"Workspace de tarefas"}
              </div>
              <input ref={createRef} value={createVal}
                onChange={e=>setCreateVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")confirmCreate();if(e.key==="Escape")cancelCreate();}}
                onBlur={confirmCreate}
                style={{width:"100%",border:`1.5px solid ${creating==="brain"?"rgba(139,92,246,.4)":"rgba(16,185,129,.4)"}`,outline:"none",background:"var(--bg-card)",fontFamily:"'DM Sans',sans-serif",fontSize:12.5,color:"var(--text-main)",padding:"6px 9px",borderRadius:8,boxSizing:"border-box"}}/>
              <div style={{fontSize:9.5,color:"var(--text-muted)",fontFamily:"'DM Sans',sans-serif",marginTop:4,paddingLeft:2}}>Enter confirma · Esc cancela</div>
            </div>
          ):(
            <>
              <button onClick={()=>startCreate("task")} disabled={canvases.length>=MAX_WS} className="tm-btn" style={{marginTop:8,background:"rgba(16,185,129,.07)",border:"1.5px dashed rgba(16,185,129,.28)",borderRadius:10,padding:"8px",cursor:canvases.length>=MAX_WS?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,color:"#10b981",textAlign:"center",opacity:canvases.length>=MAX_WS?.4:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Ic.Plus s={11}/>Tarefa
              </button>
              <button onClick={()=>startCreate("brain")} disabled={canvases.length>=MAX_WS} className="tm-btn" style={{background:"rgba(139,92,246,.07)",border:"1.5px dashed rgba(139,92,246,.28)",borderRadius:10,padding:"8px",cursor:canvases.length>=MAX_WS?"not-allowed":"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:500,color:"#8b5cf6",textAlign:"center",opacity:canvases.length>=MAX_WS?.4:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                <Ic.Brain s={12} c="#8b5cf6"/>Brainstorm
              </button>
              {canvases.length>=MAX_WS&&<div style={{fontSize:10.5,color:"var(--text-muted)",textAlign:"center",fontFamily:"'DM Sans',sans-serif",padding:"3px 6px",lineHeight:1.5}}>Limite de {MAX_WS} atingido</div>}
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9.5,color:"var(--text-muted)",textAlign:"center",paddingTop:2}}>Duplo clique para renomear</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
