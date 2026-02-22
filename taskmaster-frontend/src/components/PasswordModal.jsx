import { useState } from "react";
import { Modal, MTitle } from "./Modal";
import { Ic } from "../icons";
import { api } from "../config/constants";

export function PasswordModal({shareToken,onUnlock,onCancel}) {
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [loading,setL]=useState(false);

  const submit=async()=>{
    setL(true);setErr("");
    try{await api(`/api/canvases/shared/${shareToken}/verify-password`,{method:"POST",body:{password:pwd}});onUnlock();}
    catch(e){setErr(e.message);}finally{setL(false);}
  };

  return (
    <Modal onClose={onCancel} maxW={380}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{width:46,height:46,borderRadius:"50%",background:"rgba(16,185,129,.1)",border:"1.5px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><Ic.Lock s={20}/></div>
        <MTitle>Workspace protegido</MTitle>
        <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-muted)"}}>Insira a senha para desbloquear edição.</p>
      </div>
      <input autoFocus type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Senha de edição"
        style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:11,padding:"11px 14px",fontFamily:"'Inter',sans-serif",fontSize:14,color:"var(--text-main)",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      {err&&<div style={{color:"#f87171",fontSize:12.5,fontFamily:"'Inter',sans-serif",marginBottom:8}}>{err}</div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel} className="tm-btn" style={{flex:1,background:"none",border:"1px solid var(--border)",borderRadius:11,padding:"10px",fontSize:13,color:"var(--text-muted)",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Apenas visualizar</button>
        <button onClick={submit} disabled={loading||!pwd} className="tm-btn" style={{flex:1,background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:11,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:(!pwd||loading)?.5:1}}>
          {loading?"…":"Desbloquear"}
        </button>
      </div>
    </Modal>
  );
}
