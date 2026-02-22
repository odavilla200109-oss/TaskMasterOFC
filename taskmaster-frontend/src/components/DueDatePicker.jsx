import { useRef } from "react";
import { Ic } from "../icons";

export function DueDatePicker({node,onFinishEdit,isChild}) {
  const ref=useRef(null);
  return (
    <button title="Data de vencimento" className="tm-btn"
      onMouseDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();ref.current?.showPicker?.();}}
      style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",padding:"3px 4px",borderRadius:6,color:"var(--text-muted)",position:"relative"}}>
      <Ic.Cal s={isChild?11:12}/>
      <input ref={ref} type="date" value={node.dueDate||""}
        onChange={e=>onFinishEdit(node.title,e.target.value||null)}
        onMouseDown={e=>e.stopPropagation()}
        style={{position:"absolute",opacity:0,width:1,height:1,pointerEvents:"none"}}/>
    </button>
  );
}
