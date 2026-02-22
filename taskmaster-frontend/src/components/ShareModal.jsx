import { useState, useEffect } from "react";
import { Modal, MTitle } from "./Modal";
import { Ic } from "../icons";
import { api } from "../config/constants";

export function ShareModal({canvasId,hasLock,onClose}) {
  const [shares,setShares]=useState([]);
  const [loading,setLoading]=useState(true);
  const [copied,setCopied]=useState(null);
  const [creating,setCreating]=useState(false);
  const [mode,setMode]=useState("view");
  const [duration,setDuration]=useState("24h");
  const [password,setPassword]=useState("");

  useEffect(()=>{api(`/api/canvases/${canvasId}/shares`).then(setShares).finally(()=>setLoading(false));},[canvasId]);

  const lockActive=hasLock&&shares.some(s=>s.view_indefinite_lock===1||s.view_indefinite_lock===true);

  const create=async()=>{
    setCreating(true);
    try{
      const s=await api(`/api/canvases/${canvasId}/shares`,{method:"POST",body:{mode,duration,password:password||undefined}});
      setShares(p=>[...p,s]);setPassword("");
    }catch(e){alert(e.message);}finally{setCreating(false);}
  };

  const revoke=async(id)=>{
    await api(`/api/canvases/${canvasId}/shares/${id}`,{method:"DELETE"});
    setShares(p=>p.filter(x=>x.id!==id));
  };

  const copy=token=>{
    navigator.clipboard.writeText(`${window.location.origin}/shared/${token}`);
    setCopied(token);setTimeout(()=>setCopied(null),2200);
  };

  return (
    <Modal onClose={onClose}>
      <MTitle>Compartilhar Workspace</MTitle>
      <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-muted)",marginBottom:18,lineHeight:1.5}}>
        Crie links de acesso. Links de edição podem ter senha.
      </p>

      {/* Form */}
      <div style={{background:"rgba(16,185,129,.04)",border:"1px solid var(--border)",borderRadius:14,padding:"14px",marginBottom:16,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:8}}>
          {["view","edit"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} className="tm-btn" style={{flex:1,padding:"8px",borderRadius:10,fontSize:12.5,fontWeight:600,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:mode===m?"linear-gradient(135deg,#10b981,#059669)":"transparent",color:mode===m?"white":"var(--text-sub)",border:mode===m?"none":"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              {m==="edit"?<><Ic.Pencil s={11} c={mode===m?"white":"currentColor"}/>Edição</>:<><Ic.Eye s={11}/>Visualização</>}
            </button>
          ))}
        </div>

        {mode==="view"&&(
          <div style={{display:"flex",gap:8}}>
            {[["24h","24 horas"],["indefinite","Indefinido"]].map(([v,l])=>(
              <button key={v} onClick={()=>setDuration(v)} className="tm-btn" style={{flex:1,padding:"7px",borderRadius:9,fontSize:12,fontWeight:500,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:duration===v?"rgba(16,185,129,.15)":"transparent",color:duration===v?"#10b981":"var(--text-muted)",border:`1px solid ${duration===v?"rgba(16,185,129,.4)":"var(--border)"}`}}>
                {v==="indefinite"&&"♾ "}{l}
              </button>
            ))}
          </div>
        )}

        {mode==="view"&&duration==="indefinite"&&lockActive&&(
          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:9,padding:"8px 12px",fontSize:12,color:"#f59e0b",fontFamily:"'Inter',sans-serif"}}>
            <Ic.Warn s={13}/> Já existe um link ∞ ativo. Revogue-o antes.
          </div>
        )}

        {mode==="edit"&&(
          <input value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Senha de edição (opcional)"
            style={{background:"transparent",border:"1px solid var(--border)",borderRadius:9,padding:"8px 12px",fontFamily:"'Inter',sans-serif",fontSize:12.5,color:"var(--text-main)",outline:"none"}}/>
        )}

        <button onClick={create} disabled={creating||(mode==="view"&&duration==="indefinite"&&lockActive)} className="tm-btn" style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,fontFamily:"'Inter',sans-serif",cursor:"pointer",opacity:(mode==="view"&&duration==="indefinite"&&lockActive)?.4:1}}>
          {creating?"Criando…":"＋ Gerar link"}
        </button>
      </div>

      {/* List */}
      {loading?<div style={{textAlign:"center",padding:18,color:"var(--text-muted)",fontFamily:"'Inter',sans-serif",fontSize:13}}>Carregando…</div>
        :shares.length===0?<div style={{textAlign:"center",padding:"16px",border:"1.5px dashed var(--border)",borderRadius:12,color:"var(--text-muted)",fontFamily:"'Inter',sans-serif",fontSize:13}}>Nenhum link criado</div>
        :<div style={{display:"flex",flexDirection:"column",gap:7}}>
          {shares.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(16,185,129,.03)",border:"1px solid var(--border)",borderRadius:12,padding:"9px 12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:2,flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:s.mode==="edit"?"#10b981":"var(--text-muted)",background:s.mode==="edit"?"rgba(16,185,129,.12)":"rgba(0,0,0,.04)",borderRadius:5,padding:"1px 7px"}}>
                    {s.mode==="edit"?"Edição":"Visualização"}
                  </span>
                  {(s.view_indefinite_lock===1||s.view_indefinite_lock===true)&&<span style={{fontSize:10,color:"#f59e0b",background:"rgba(245,158,11,.1)",borderRadius:5,padding:"1px 7px",fontFamily:"'Inter',sans-serif",fontWeight:600}}>♾ Ativo</span>}
                  {s.password_hash&&<Ic.Lock s={11}/>}
                  {s.expires_at&&<span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"'Inter',sans-serif"}}>exp. {new Date(s.expires_at).toLocaleDateString("pt-BR")}</span>}
                </div>
                <span style={{fontSize:10,color:"var(--text-muted)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>/shared/{s.token.slice(0,14)}…</span>
              </div>
              <button onClick={()=>copy(s.token)} className="tm-btn" style={{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11.5,color:"var(--text-sub)",fontFamily:"'Inter',sans-serif",fontWeight:500,whiteSpace:"nowrap",flexShrink:0}}>
                {copied===s.token?"✓":"Copiar"}
              </button>
              <button onClick={()=>revoke(s.id)} className="tm-btn" style={{background:"none",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",padding:"4px",flexShrink:0}}>
                <Ic.Trash s={11}/>
              </button>
            </div>
          ))}
        </div>
      }
      <button onClick={onClose} className="tm-btn" style={{marginTop:18,width:"100%",background:"none",border:"1px solid var(--border)",borderRadius:12,padding:"10px",fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-muted)",cursor:"pointer"}}>Fechar</button>
    </Modal>
  );
}
