export function BurstEffect({x,y}) {
  const pts=[0,72,144,216,288].map((a,i)=>({i,tx:Math.cos(a*Math.PI/180)*70,ty:Math.sin(a*Math.PI/180)*70}));
  return (
    <>
      {pts.map(({i,tx,ty})=>(
        <div key={i} style={{position:"absolute",left:x,top:y,width:9,height:9,borderRadius:"50%",pointerEvents:"none",zIndex:9999,transform:"translate(-50%,-50%)",background:["#10b981","#34d399","#6ee7b7","#fbbf24","#a7f3d0"][i],animation:`burst${i} .8s ease-out forwards`}}/>
      ))}
      <style>{pts.map(({i,tx,ty})=>`@keyframes burst${i}{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0);opacity:0}}`).join("")}</style>
    </>
  );
}
