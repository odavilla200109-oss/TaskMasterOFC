import { useState, useEffect } from "react";
import { AppCtx } from "./context/AppContext";
import { CookieBanner } from "./components/CookieBanner";
import { LoginScreen } from "./pages/LoginScreen";
import { AppScreen } from "./pages/AppScreen";
import { ReportPage } from "./pages/ReportPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";

export default function TaskMasterApp() {
  const [screen,setScreen]=useState("login");
  const [user,setUser]=useState(null);
  const [dark,setDark]=useState(()=>localStorage.getItem("tm_dark")==="1");
  const [cookieConsent,setCookieConsent]=useState(()=>localStorage.getItem("tm_cookie_consent"));

  useEffect(()=>{localStorage.setItem("tm_dark",dark?"1":"0");},[dark]);

  const path=window.location.pathname;

  const handleCookieAccept=()=>{
    localStorage.setItem("tm_cookie_consent","granted");setCookieConsent("granted");
    if(typeof window.gtag==="function")window.gtag("consent","update",{analytics_storage:"granted",ad_storage:"granted",ad_user_data:"granted",ad_personalization:"granted"});
  };
  const handleCookieDecline=()=>{
    localStorage.setItem("tm_cookie_consent","essential");setCookieConsent("essential");
  };

  const renderPage=()=>{
    if(path==="/report")return<ReportPage/>;
    if(path==="/terms") return<TermsPage/>;
    if(path==="/privacy")return<PrivacyPage/>;
    if(screen==="login")return<LoginScreen/>;
    return<AppScreen/>;
  };

  return (
    <AppCtx.Provider value={{user,setUser,screen,setScreen,dark,setDark}}>
      {renderPage()}
      {cookieConsent===null&&path!=="/terms"&&path!=="/privacy"&&(
        <CookieBanner onAccept={handleCookieAccept} onDecline={handleCookieDecline}/>
      )}
    </AppCtx.Provider>
  );
}
