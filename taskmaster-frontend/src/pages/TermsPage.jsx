import { useEffect, useContext } from "react";
import { AppCtx } from "../context/AppContext";
import { applyTheme } from "../theme/theme";

export function TermsPage() {
  const {dark}=useContext(AppCtx);
  useEffect(()=>{applyTheme(dark);},[dark]);
  return (
    <div style={{minHeight:"100vh",background:"var(--bg-card)",padding:"60px 20px",fontFamily:"'Inter',sans-serif"}}>
      <div style={{maxWidth:720,margin:"0 auto"}}>
        <a href="/" style={{fontSize:13,color:"#10b981",textDecoration:"none",marginBottom:28,display:"inline-block"}}>← Voltar</a>
        <h1 style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:900,fontSize:36,color:"var(--text-main)",marginBottom:6}}>Termos de Uso</h1>
        <p style={{fontSize:12.5,color:"var(--text-muted)",marginBottom:36}}>Última atualização: {new Date().getFullYear()}</p>
        {[
          ["1. Aceitação","Ao usar o TaskMaster, você concorda com estes termos. O uso continuado após alterações constitui aceitação das novas condições."],
          ["2. Uso Permitido","O TaskMaster é oferecido para organização pessoal e profissional de tarefas e ideias. É proibido usar a plataforma para atividades ilegais, spam, ou qualquer finalidade que prejudique outros usuários."],
          ["3. Contas","Cada usuário é responsável pela segurança de sua conta e pelo conteúdo criado. O TaskMaster permite até 8 workspaces por conta."],
          ["4. Compartilhamento","Links compartilhados gerados pelo usuário são de responsabilidade exclusiva de quem os criou. Links de visualização indefinida ficam restritos a um por workspace."],
          ["5. Disponibilidade","O TaskMaster é fornecido \"como está\". Não garantimos disponibilidade ininterrupta e podemos realizar manutenções sem aviso prévio."],
          ["6. Encerramento","Você pode excluir sua conta a qualquer momento através das configurações de perfil. Todos os dados serão removidos permanentemente."],
          ["7. Contato","Para dúvidas sobre estes termos, entre em contato: davilla200109@gmail.com"],
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
