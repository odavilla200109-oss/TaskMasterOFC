import { useState, useEffect, useContext } from "react";
import { AppCtx } from "../context/AppContext";
import { MTitle } from "../components/Modal";
import { applyTheme } from "../theme/theme";
import { api } from "../config/constants";

export function ReportPage() {
  const {dark,setDark}=useContext(AppCtx);
  const [msg,setMsg]=useState("");
  const [email,setEmail]=useState("");
  const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{applyTheme(dark);},[dark]);

  const submit=async()=>{
    if(!msg.trim()){setError("Descreva o erro antes de enviar.");return;}
    setLoading(true);setError("");
    try{
      await api("/api/reports",{method:"POST",body:{message:msg,email:email||undefined,page:"app"}});
      setSent(true);
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",fontFamily:"'Inter',sans-serif"}}>
      <div style={{width:"100%",maxWidth:480,background:"var(--bg-glass)",border:"1.5px solid var(--border)",borderRadius:24,padding:"36px 38px",boxShadow:"0 12px 48px rgba(0,0,0,.15)"}}>
        <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:900,fontSize:28,color:"var(--text-main)",marginBottom:4}}>TaskMaster</div>
        <MTitle>Reportar um erro</MTitle>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:22,lineHeight:1.6}}>
          Nos ajude a melhorar descrevendo o problema que encontrou.
          Para suporte direto: <a href="mailto:davilla200109@gmail.com" style={{color:"#10b981"}}>davilla200109@gmail.com</a>
        </p>

        {sent?(
          <div style={{textAlign:"center",padding:"28px 0"}}>
            <div style={{fontSize:44,marginBottom:14}}>✅</div>
            <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:17,color:"var(--text-main)",marginBottom:8}}>Report enviado!</div>
            <p style={{fontSize:13,color:"var(--text-muted)",lineHeight:1.6}}>
              Estamos trabalhando para melhorar o TaskMaster, agradecemos sua compreensão.
            </p>
            <button onClick={()=>window.history.back()} className="tm-btn" style={{marginTop:20,background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:12,padding:"11px 28px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Voltar</button>
          </div>
        ):(
          <>
            <div style={{marginBottom:12}}>
              <label style={{display:"block",fontSize:12.5,fontWeight:600,color:"var(--text-sub)",marginBottom:6}}>Descreva o erro *</label>
              <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={5}
                placeholder="O que aconteceu? Quais passos levaram ao erro?"
                style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:12,padding:"12px 14px",fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-main)",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.55}}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12.5,fontWeight:600,color:"var(--text-sub)",marginBottom:6}}>E-mail de contato (opcional)</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="Para retorno da equipe"
                style={{width:"100%",background:"transparent",border:"1.5px solid var(--border)",borderRadius:12,padding:"11px 14px",fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-main)",outline:"none",boxSizing:"border-box"}}/>
            </div>
            {error&&<div style={{color:"#f87171",fontSize:12.5,marginBottom:10}}>{error}</div>}
            <button onClick={submit} disabled={loading} className="tm-btn" style={{width:"100%",background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",opacity:loading?.6:1}}>
              {loading?"Enviando…":"Enviar report"}
            </button>
          </>
        )}
      </div>
      <div style={{display:"flex",gap:16,marginTop:24}}>
        {[["← Voltar","javascript:history.back()"],["Termos","/terms"],["Privacidade","/privacy"]].map(([l,h])=>(
          <a key={h} href={h} style={{fontSize:12,color:"var(--text-muted)",textDecoration:"none"}}>{l}</a>
        ))}
      </div>
    </div>
  );
}
