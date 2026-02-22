export function Modal({onClose,children,maxW=460}) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"var(--bg-card)",border:"1.5px solid var(--border)",borderRadius:22,padding:"26px 30px",width:"100%",maxWidth:maxW,boxShadow:"0 24px 80px rgba(0,0,0,.28)",animation:"tmScaleIn .3s cubic-bezier(.34,1.1,.64,1) both"}}>
        {children}
      </div>
    </div>
  );
}

export function MTitle({children}) {
  return <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:18,color:"var(--text-main)",marginBottom:6}}>{children}</div>;
}
