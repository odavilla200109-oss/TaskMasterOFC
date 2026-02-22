import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";

export function ProfileMenu({user,onLogout,onDeleteAccount,onSwitchAccount}) {
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  return (
    <div ref={ref} style={{position:"relative"}}>
      <button onClick={()=>setOpen(o=>!o)} className="tm-btn" style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.07)",border:"1px solid var(--border)",borderRadius:10,padding:"4px 9px 4px 5px",cursor:"pointer"}}>
        {user.photo
          ?<img src={user.photo} alt="" style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",border:"1.5px solid var(--border)"}}/>
          :<div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:700,fontSize:11,fontFamily:"'Space Grotesk',sans-serif"}}>{user.name?.[0]?.toUpperCase()||"U"}</div>
        }
        <span style={{fontSize:12.5,color:"var(--text-main)",fontWeight:500,maxWidth:82,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{opacity:.45}}><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:14,padding:"6px",minWidth:200,boxShadow:"0 12px 40px rgba(0,0,0,.22)",animation:"tmScaleIn .18s ease both",zIndex:5000}}>
          <div style={{padding:"8px 12px 6px",borderBottom:"1px solid var(--border)",marginBottom:4}}>
            <div style={{fontSize:12,fontWeight:600,color:"var(--text-main)",fontFamily:"'Inter',sans-serif"}}>{user.name}</div>
            <div style={{fontSize:11,color:"var(--text-muted)",fontFamily:"'Inter',sans-serif"}}>{user.email}</div>
          </div>
          {[
            {label:"Trocar conta",icon:<Ic.User s={13}/>,action:onSwitchAccount},
            {label:"Sair",icon:<Ic.Logout s={13}/>,action:onLogout},
          ].map(item=>(
            <button key={item.label} onClick={()=>{setOpen(false);item.action();}} className="tm-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:9,background:"none",border:"none",cursor:"pointer",padding:"8px 12px",borderRadius:9,textAlign:"left",fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-main)"}}>
              <span style={{color:"var(--text-muted)"}}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{borderTop:"1px solid var(--border)",marginTop:4,paddingTop:4}}>
            <button onClick={()=>{setOpen(false);onDeleteAccount();}} className="tm-btn" style={{width:"100%",display:"flex",alignItems:"center",gap:9,background:"none",border:"none",cursor:"pointer",padding:"8px 12px",borderRadius:9,textAlign:"left",fontFamily:"'Inter',sans-serif",fontSize:12.5,color:"#f87171"}}>
              <Ic.Trash s={13}/>Excluir meus dados
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
