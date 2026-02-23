import { useState, useRef, useEffect } from "react";
import { Ic, PriIcon } from "../icons";
import { DueDatePicker } from "./DueDatePicker";
import { PRIORITY, NODE_W, NODE_W_CHILD, NODE_H_CHILD } from "../config/constants";
import { isOverdue, nW, nH } from "../utils/nodeUtils";

export function NodeCard({
  node,dark,isEditing,editVal,setEditVal,
  onFinishEdit,onStartEdit,onDelete,onComplete,
  onCyclePriority,onAddChild,onDragStart,
  isNew,readOnly,isSelected,onSelect,isChild,
}) {
  const inputRef=useRef(null);
  const [pop,setPop]=useState(false);
  useEffect(()=>{if(isEditing)inputRef.current?.focus();},[isEditing]);

  const handleComplete=()=>{
    if(!node.completed){setPop(true);setTimeout(()=>setPop(false),500);}
    onComplete();
  };

  const pc   = isChild?"transparent":PRIORITY.color[node.priority];
  const over = isOverdue(node.dueDate)&&!node.completed;
  const W    = isChild?NODE_W_CHILD:NODE_W;
  const bc   = over?"#ef4444":isSelected?"#10b981":node.completed?"#86efac":isChild?"var(--border)":pc;

  return (
    <div
      onMouseDown={e=>{onSelect();onDragStart(e);}}
      onDoubleClick={e=>{if(readOnly)return;e.stopPropagation();onStartEdit();}}
      className={`tm-node${isSelected?" tm-selected":""}${isChild?" tm-child-node":""}`}
      style={{
        position:"absolute",left:node.x,top:node.y,width:W,
        borderRadius:isChild?12:16,overflow:"hidden",
        background:"var(--node-bg)",
        border:`${isSelected?"2px":"1.5px"} solid ${bc}`,
        boxShadow:"var(--node-shadow)",
        cursor:readOnly?"default":"grab",
        willChange:"transform,box-shadow",
        animation:isNew?"tmNodeIn .35s cubic-bezier(.34,1.56,.64,1) forwards":"none",
        transition:"border-color .2s,box-shadow .2s",
        zIndex:isSelected?50:isChild?10:20,
      }}
    >
      {!isChild&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:pc,transition:"background .25s"}}/>}
      {isChild&&<div style={{position:"absolute",top:5,right:8,fontSize:8,fontFamily:"'Inter',sans-serif",fontWeight:700,letterSpacing:1,color:"var(--text-muted)",textTransform:"uppercase",opacity:.6}}>subtarefa</div>}

      {/* Title */}
      <div style={{padding:isChild?"8px 10px 5px 12px":"11px 12px 7px 16px",minHeight:isChild?32:40}}>
        {isEditing?(
          <input ref={inputRef} value={editVal} onChange={e=>setEditVal(e.target.value)}
            onBlur={()=>onFinishEdit(editVal)}
            onKeyDown={e=>{if(e.key==="Enter")onFinishEdit(editVal);if(e.key==="Escape")onFinishEdit(node.title||"");}}
            onMouseDown={e=>e.stopPropagation()}
            placeholder="Nome da tarefa…"
            style={{width:"100%",border:"none",outline:"none",background:"transparent",fontFamily:"'Inter',sans-serif",fontWeight:500,fontSize:isChild?12:13,color:"var(--text-main)"}}/>
        ):(
          <div style={{fontWeight:500,fontSize:isChild?12:13,color:node.completed?"var(--text-muted)":"var(--text-main)",textDecoration:node.completed?"line-through":"none",lineHeight:1.45,wordBreak:"break-word",paddingRight:isChild?28:0}}>
            {node.title||<span style={{color:"var(--text-muted)",fontStyle:"italic",fontWeight:400,fontSize:isChild?11:12}}>Duplo clique para editar</span>}
          </div>
        )}
      </div>


      {/* Footer */}
      <div style={{display:"flex",alignItems:"center",gap:2,padding:isChild?"4px 7px 6px 11px":"5px 8px 7px 13px",borderTop:"1px solid var(--border)"}}>
        {!readOnly&&(
          <>
            {!isChild&&(
              <button title={PRIORITY.label[node.priority]} className="tm-btn"
                onMouseDown={e=>e.stopPropagation()}
                onClick={e=>{e.stopPropagation();onCyclePriority();}}
                style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 5px",borderRadius:6}}>
                <PriIcon p={node.priority} s={14}/>
              </button>
            )}
            <button title="Nova subtarefa" className="tm-btn"
              onMouseDown={e=>e.stopPropagation()}
              onClick={e=>{e.stopPropagation();onAddChild();}}
              style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6}}>
              <Ic.Plus s={isChild?12:13}/>
            </button>
            <DueDatePicker node={node} onFinishEdit={onFinishEdit} isChild={isChild}/>
          </>
        )}
        <div style={{flex:1}}/>
        {!readOnly&&(
          <button title="Excluir" className="tm-btn"
            onMouseDown={e=>e.stopPropagation()}
            onClick={e=>{e.stopPropagation();onDelete();}}
            style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6}}>
            <Ic.Trash s={11}/>
          </button>
        )}
        <button title={node.completed?"Desmarcar":"Concluir"} className="tm-btn"
          onMouseDown={e=>e.stopPropagation()}
          onClick={e=>{e.stopPropagation();if(!readOnly)handleComplete();}}
          style={{background:node.completed?"#10b981":"none",border:`2px solid ${node.completed?"#10b981":"rgba(16,185,129,.4)"}`,cursor:readOnly?"default":"pointer",width:isChild?20:22,height:isChild?20:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",transform:pop?"scale(1.5)":"scale(1)",transition:"all .2s"}}>
          {node.completed&&<Ic.Check s={isChild?9:11}/>}
        </button>
      </div>
    </div>
  );
}
