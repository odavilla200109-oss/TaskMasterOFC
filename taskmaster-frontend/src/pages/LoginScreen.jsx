import { useState, useRef, useEffect, useContext } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { AppCtx } from "../context/AppContext";
import { Ic } from "../icons";
import { Token, api, SUBTITLES } from "../config/constants";
import { applyTheme } from "../theme/theme";
import { useAnimatedBg } from "../hooks/useAnimatedBg";

function Typewriter() {
  const [idx,setIdx]=useState(0);
  const [disp,setDisp]=useState("");
  const [phase,setPhase]=useState("typing");
  const t=useRef(null);
  useEffect(()=>{
    const cur=SUBTITLES[idx];
    if(phase==="typing"){
      if(disp.length<cur.length)t.current=setTimeout(()=>setDisp(cur.slice(0,disp.length+1)),46);
      else t.current=setTimeout(()=>setPhase("pause"),2600);
    }else if(phase==="pause"){t.current=setTimeout(()=>setPhase("erasing"),500);}
    else if(phase==="erasing"){
      if(disp.length>0)t.current=setTimeout(()=>setDisp(disp.slice(0,-1)),26);
      else{setIdx(i=>(i+1)%SUBTITLES.length);setPhase("typing");}
    }
    return()=>clearTimeout(t.current);
  },[disp,phase,idx]);
  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:400,color:"var(--text-sub)",minHeight:30,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <span>{disp}</span>
      <span style={{display:"inline-block",width:2,height:"1.1em",background:"#10b981",borderRadius:2,marginLeft:2,animation:"tmBlink 1s step-end infinite",verticalAlign:"middle"}}/>
    </div>
  );
}

function FloatNode({x,y,size,delay,dark}) {
  return (
    <div style={{position:"absolute",left:`${x}%`,top:`${y}%`,width:size,borderRadius:14,background:"var(--bg-card)",border:"1.5px solid var(--border)",boxShadow:dark?"0 8px 32px rgba(0,0,0,.4)":"0 8px 24px rgba(16,185,129,.09)",padding:"12px 15px",pointerEvents:"none",backdropFilter:"blur(8px)",animation:`tmFloat 8s ease-in-out ${delay}s infinite`,opacity:.68}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
        <div style={{width:4,height:30,borderRadius:4,background:"linear-gradient(180deg,#10b981,#059669)",flexShrink:0}}/>
        <div>
          <div style={{height:7,width:"70%",background:"rgba(16,185,129,.22)",borderRadius:4,marginBottom:5}}/>
          <div style={{height:5,width:"46%",background:"rgba(16,185,129,.12)",borderRadius:4}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:5,alignItems:"center"}}>
        <div style={{width:15,height:15,borderRadius:"50%",border:"2px solid rgba(16,185,129,.35)"}}/>
        <div style={{height:5,width:"35%",background:"rgba(16,185,129,.12)",borderRadius:4}}/>
        <div style={{marginLeft:"auto",fontSize:9,color:"rgba(16,185,129,.45)",fontFamily:"monospace"}}>✦</div>
      </div>
    </div>
  );
}

export function LoginScreen() {
  const {setUser,setScreen,dark,setDark}=useContext(AppCtx);
  const bgRef=useRef(null);const onBgMove=useAnimatedBg(bgRef,dark);
  const [authLoading,setAuthLoading]=useState(true);
  const [loginLoading,setLoginLoading]=useState(false);
  const [error,setError]=useState(null);
  const pending=localStorage.getItem("tm_pending_share");

  useEffect(()=>{applyTheme(dark);},[dark]);

  useEffect(()=>{
    const token=Token.get();if(!token){setAuthLoading(false);return;}
    api("/api/auth/me").then(async u=>{
      if(u.darkMode)setDark(true);setUser(u);
      if(pending){localStorage.removeItem("tm_pending_share");window.history.replaceState(null,"",`/shared/${pending}`);}
      setScreen("app");
    }).catch(()=>{Token.clear();setAuthLoading(false);});
  },[]);

  const handleGoogle=async res=>{
    setLoginLoading(true);setError(null);
    try{
      const{token,user}=await api("/api/auth/google",{method:"POST",body:{credential:res.credential}});
      Token.set(token);if(user.darkMode)setDark(true);setUser(user);
      if(pending){localStorage.removeItem("tm_pending_share");window.history.replaceState(null,"",`/shared/${pending}`);}
      setScreen("app");
    }catch(e){setError(e.message);}finally{setLoginLoading(false);}
  };

  const handleSkip=()=>{
    if(pending){setError("Para acessar um workspace compartilhado, é necessário fazer login com o Google.");return;}
    setUser({id:"anonymous",name:"Visitante",email:null,photo:null});setScreen("app");
  };

  const floats=[
    {x:3,y:18,size:140,delay:0},{x:85,y:8,size:120,delay:1.4},
    {x:1,y:62,size:130,delay:2.3},{x:83,y:58,size:145,delay:.9},
    {x:75,y:32,size:110,delay:2},{x:10,y:40,size:122,delay:3.2},
  ];

  if(authLoading)return(
    <div style={{width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:dark?"#030807":"#f0fdf4",fontFamily:"'DM Sans',sans-serif",color:"#10b981",fontSize:14,gap:10}}>
      <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:20}}>⟳</span>Verificando sessão…
    </div>
  );

  return (
    <div ref={bgRef} onMouseMove={onBgMove} style={{width:"100%",minHeight:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:`radial-gradient(circle,rgba(16,185,129,${dark?.07:.16}) 1px,transparent 1px)`,backgroundSize:"26px 26px"}}/>
      {floats.map((f,i)=><FloatNode key={i} {...f} dark={dark}/>)}

      <button onClick={()=>setDark(d=>!d)} style={{position:"fixed",top:18,right:18,zIndex:200,background:"var(--bg-glass)",backdropFilter:"blur(10px)",border:"1px solid var(--border)",borderRadius:10,padding:"7px 9px",display:"flex",alignItems:"center",cursor:"pointer"}}>
        {dark?<Ic.Sun s={15}/>:<Ic.Moon s={15}/>}
      </button>

      <main style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px 40px",position:"relative",zIndex:10,gap:44}}>

        {/* Hero */}
        <div style={{textAlign:"center"}}>
          {pending&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(16,185,129,.11)",border:"1px solid rgba(16,185,129,.28)",borderRadius:100,padding:"5px 16px",marginBottom:20,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,color:"#059669"}}>
              🔗 Faça login para acessar o workspace compartilhado
            </div>
          )}
          {!pending&&(
            <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",borderRadius:100,padding:"5px 18px",marginBottom:20,fontFamily:"'DM Sans',sans-serif",fontSize:10.5,fontWeight:700,color:"#059669",letterSpacing:1.4,textTransform:"uppercase"}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 6px #10b981",animation:"tmBlink 2s ease infinite"}}/>
              Workspace visual inteligente
            </div>
          )}

          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:"clamp(52px,9vw,100px)",color:"var(--text-main)",letterSpacing:-3,lineHeight:1,marginBottom:18,animation:"tmFadeUp .65s ease both"}}>
            TaskMaster
          </div>
          <div style={{animation:"tmFadeUp .65s ease .14s both"}}><Typewriter/></div>
        </div>

        {/* Login card */}
        <div style={{background:"var(--bg-card)",backdropFilter:"blur(28px) saturate(160%)",border:"1.5px solid var(--border)",borderRadius:24,padding:"32px 38px",width:"100%",maxWidth:400,boxShadow:dark?"0 12px 60px rgba(0,0,0,.6),0 0 0 1px rgba(16,185,129,.1)":"0 10px 52px rgba(16,185,129,.12),0 2px 8px rgba(0,0,0,.04)",display:"flex",flexDirection:"column",gap:13,animation:"tmScaleIn .5s cubic-bezier(.34,1.1,.64,1) .18s both"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:"var(--text-main)",textAlign:"center"}}>
            {pending?"Login necessário":"Começar agora"}
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"var(--text-muted)",textAlign:"center",lineHeight:1.55}}>
            {pending?"Entre com Google para acessar o workspace compartilhado.":"Entre com sua conta para salvar workspaces e colaborar em tempo real."}
          </div>

          {error&&<div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",borderRadius:12,padding:"10px 14px",fontSize:13,color:"#f87171",fontFamily:"'DM Sans',sans-serif",textAlign:"center",lineHeight:1.5}}>{error}</div>}

          {loginLoading?(
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,padding:"14px",background:"rgba(16,185,129,.07)",borderRadius:14,border:"1px solid var(--border)",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"var(--text-muted)"}}>
              <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:18}}>⟳</span>Entrando…
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"center"}}>
              <GoogleLogin onSuccess={handleGoogle} onError={()=>setError("Login Google falhou.")} theme={dark?"filled_black":"filled_green"} size="large" locale="pt-BR" width="320"/>
            </div>
          )}

          {!pending&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"var(--text-muted)",fontWeight:500}}>ou</span>
                <div style={{flex:1,height:1,background:"var(--border)"}}/>
              </div>
              <button onClick={handleSkip} className="tm-btn" style={{background:"rgba(16,185,129,.05)",color:"#059669",border:"1.5px dashed rgba(16,185,129,.30)",cursor:"pointer",borderRadius:14,padding:"12px 20px",fontFamily:"'DM Sans',sans-serif",fontWeight:500,fontSize:13.5,width:"100%"}}>
                Usar sem conta →
              </button>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"var(--text-muted)",textAlign:"center",lineHeight:1.6}}>
                Sem login, os dados não são salvos entre sessões.
              </p>
            </>
          )}

          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:10.5,color:"var(--text-muted)",textAlign:"center",lineHeight:1.6,borderTop:"1px solid var(--border)",paddingTop:10,margin:0}}>
            Ao entrar, você concorda com a coleta de dados conforme nossa{" "}
            <a href="/privacy" style={{color:"#10b981",textDecoration:"underline"}}>Política de Privacidade</a>.
          </p>
        </div>

        <div style={{display:"flex",gap:18,alignItems:"center",zIndex:10}}>
          {[["Termos de Uso","/terms"],["Política de Privacidade","/privacy"],["Reportar Erro","/report"]].map(([l,h])=>(
            <a key={h} href={h} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11.5,color:"var(--text-muted)",textDecoration:"none",transition:"color .2s"}}
              onMouseEnter={e=>e.currentTarget.style.color="#10b981"}
              onMouseLeave={e=>e.currentTarget.style.color="var(--text-muted)"}>{l}</a>
          ))}
        </div>
      </main>

      <footer style={{position:"relative",zIndex:10,borderTop:"1px solid var(--border)",background:"var(--bg-glass)",backdropFilter:"blur(14px)",padding:"14px 36px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,fontFamily:"'DM Sans',sans-serif"}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:15,color:"var(--text-main)",letterSpacing:-0.4}}>TaskMaster</div>
        <div style={{fontSize:12,color:"var(--text-muted)"}}>Organize. Priorize. Execute.</div>
        <div style={{fontSize:11,color:"var(--text-muted)"}}>© {new Date().getFullYear()} TaskMaster — Todos os direitos reservados</div>
      </footer>
    </div>
  );
}
