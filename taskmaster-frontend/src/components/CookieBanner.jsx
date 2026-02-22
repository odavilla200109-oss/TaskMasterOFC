export function CookieBanner({onAccept,onDecline}) {
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:9999,background:"rgba(4,10,7,.97)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(16,185,129,.22)",padding:"14px 22px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",animation:"tmFadeUp .4s ease both",boxShadow:"0 -4px 24px rgba(0,0,0,.35)"}}>
      <div style={{flex:1,minWidth:260}}>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,fontSize:13,color:"#d1fae5",marginBottom:3}}>🍪 Cookies &amp; Privacidade</div>
        <p style={{fontFamily:"'Inter',sans-serif",fontSize:11.5,color:"#6ee7b7",margin:0,lineHeight:1.55}}>
          Utilizamos cookies para funcionamento, análise e publicidade. Ao aceitar, você concorda com nossa{" "}
          <a href="/privacy" style={{color:"#10b981"}}>Política de Privacidade</a>.
        </p>
      </div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        <button onClick={onDecline} className="tm-btn" style={{background:"transparent",border:"1px solid rgba(16,185,129,.28)",color:"#6ee7b7",borderRadius:9,padding:"7px 14px",fontFamily:"'Inter',sans-serif",fontSize:12,cursor:"pointer"}}>Apenas necessários</button>
        <button onClick={onAccept} className="tm-btn" style={{background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",borderRadius:9,padding:"7px 18px",fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>Aceitar</button>
      </div>
    </div>
  );
}
