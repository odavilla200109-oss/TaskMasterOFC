import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";
import { BRAIN_ROOT_W, BRAIN_ROOT_H, BRAIN_CHILD_W, BRAIN_CHILD_H, BRAIN_COLORS } from "../config/constants";

export function BrainNodeCard({node,dark,onDragStart,onDelete,onColorChange,isSelected,onSelect,readOnly,isNew,isEditing,editVal,setEditVal,onFinishEdit}) {
  const [hov,setHov]=useState(false);
  const [picker,setPicker]=useState(false);
  const inputRef=useRef(null);
  useEffect(()=>{if(isEditing)inputRef.current?.focus();},[isEditing]);

  const W = node.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W;
  const H = node.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
  const c = node.color||"#10b981";

  return (
    <div
      onMouseDown={e=>{onSelect();onDragStart(e);}}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{setHov(false);setPicker(false);}}
      className={`tm-brain-node${isNew?" tm-node-new":""}`}
      style={{
        position:"absolute",left:node.x,top:node.y,
        width:W,height:H,borderRadius:H/2,
        background:node.isRoot
          ?`linear-gradient(135deg,${c}25,${c}10)`
          :dark?"rgba(8,18,13,.92)":"rgba(255,255,255,.92)",
        border:`${isSelected?"2.5px":"1.8px"} solid ${c}`,
        boxShadow:isSelected
          ?`0 0 0 3px ${c}30,0 6px 28px ${c}20`
          :node.isRoot
          ?`0 0 0 1px ${c}40,0 8px 32px ${c}20`
          :"var(--node-shadow)",
        display:"flex",alignItems:"center",justifyContent:"center",
        cursor:readOnly?"default":"grab",userSelect:"none",
        transition:"border-color .2s,box-shadow .2s",
        zIndex:node.isRoot?30:isSelected?25:15,
        animation:isNew?"tmNodeIn .4s cubic-bezier(.34,1.56,.64,1) forwards":"none",
      }}
    >
      {isEditing?(
        <input ref={inputRef} value={editVal} onChange={e=>setEditVal(e.target.value)}
          onBlur={()=>onFinishEdit(editVal)}
          onKeyDown={e=>{if(e.key==="Enter")onFinishEdit(editVal);if(e.key==="Escape")onFinishEdit(node.title||"");}}
          onMouseDown={e=>e.stopPropagation()}
          placeholder={node.isRoot?"Ideia central…":"Expandir ideia…"}
          style={{width:"80%",border:"none",outline:"none",background:"transparent",fontFamily:"'DM Sans',sans-serif",fontWeight:node.isRoot?700:500,fontSize:node.isRoot?13:12,color:node.isRoot?c:"var(--text-main)",textAlign:"center"}}/>
      ):(
        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:node.isRoot?13.5:12,fontWeight:node.isRoot?700:500,color:node.isRoot?c:"var(--text-main)",textAlign:"center",padding:"0 14px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",lineHeight:1.35}}>
          {node.title||<span style={{opacity:.35,fontStyle:"italic"}}>{node.isRoot?"ideia central":"expandir…"}</span>}
        </span>
      )}

      {/* Lápis de cor */}
      {hov&&!readOnly&&!isEditing&&(
        <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();setPicker(p=>!p);}}
          style={{position:"absolute",top:-11,right:-11,background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:"50%",width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,.15)",zIndex:10}}>
          <Ic.Pencil s={11} c="#10b981"/>
        </button>
      )}

      {/* Color picker */}
      {picker&&!readOnly&&(
        <div onMouseDown={e=>e.stopPropagation()} style={{position:"absolute",top:-54,left:"50%",transform:"translateX(-50%)",background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:12,padding:"8px 10px",display:"flex",gap:6,zIndex:200,boxShadow:"0 8px 28px rgba(0,0,0,.2)"}}>
          {BRAIN_COLORS.map(col=>(
            <button key={col} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onColorChange(col);setPicker(false);}}
              style={{width:18,height:18,borderRadius:"50%",background:col,border:col===c?"2.5px solid white":"2px solid transparent",cursor:"pointer",outline:"none",boxShadow:col===c?`0 0 0 2px ${col}`:"none",transition:"transform .12s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.25)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}/>
          ))}
        </div>
      )}

      {/* Delete */}
      {hov&&!readOnly&&!isEditing&&(
        <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete();}}
          style={{position:"absolute",bottom:-11,right:-11,background:"rgba(239,68,68,.1)",border:"1.5px solid rgba(239,68,68,.35)",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:10}}>
          <Ic.Trash s={10}/>
        </button>
      )}
    </div>
  );
}
