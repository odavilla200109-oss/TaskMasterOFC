import { useEffect, useContext } from "react";
import { AppCtx } from "../context/AppContext";
import { applyTheme } from "../theme/theme";

export function PrivacyPage() {
  const {dark}=useContext(AppCtx);
  useEffect(()=>{applyTheme(dark);},[dark]);
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",padding:"60px 20px",fontFamily:"'Inter',sans-serif"}}>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        <a href="/" style={{fontSize:13,color:"#10b981",textDecoration:"none",marginBottom:28,display:"inline-block"}}>← Voltar</a>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:900,fontSize:36,color:"var(--text-main)",marginBottom:6}}>Política de Privacidade</h1>
        <p style={{fontSize:12.5,color:"var(--text-muted)",marginBottom:36}}>Última atualização: {new Date().getFullYear()}</p>
        {[
          ["Dados coletados","Coletamos: nome, e-mail e foto de perfil via Google OAuth; conteúdo de workspaces e tarefas; preferências de tema; dados de uso para melhorar o serviço."],
          ["Uso dos dados","Seus dados são usados exclusivamente para fornecer o serviço TaskMaster. Não vendemos dados pessoais a terceiros."],
          ["Cookies","Utilizamos cookies para autenticação (JWT), preferências de tema e, com seu consentimento, cookies de publicidade do Google AdSense para manter o serviço gratuito."],
          ["Google AdSense","O TaskMaster utiliza Google AdSense para exibir anúncios. O Google pode usar cookies para personalizar anúncios conforme sua navegação. Você pode gerenciar isso nas configurações do Google."],
          ["Seus direitos (LGPD)","Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigi-los, e excluí-los permanentemente a qualquer momento pelo menu de perfil."],
          ["Retenção","Seus dados são mantidos enquanto sua conta existir. Ao excluir a conta, todos os dados são removidos permanentemente dos nossos servidores."],
          ["Contato","Dúvidas sobre privacidade: davilla200109@gmail.com"],
        ].map(([t,c])=>(
          <div key={t} style={{marginBottom:28}}>
            <h2 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:18,color:"var(--text-main)",marginBottom:8}}>{t}</h2>
            <p style={{fontSize:14,color:"var(--text-sub)",lineHeight:1.7,margin:0}}>{c}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
