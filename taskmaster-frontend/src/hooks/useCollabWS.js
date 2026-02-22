import { useRef, useEffect, useCallback } from "react";
import { WS_URL, Token } from "../config/constants";

export function useCollabWS({canvasId,shareToken,jwtToken,onPatch,onBrainPatch,onMembers}) {
  const wsRef=useRef(null),retryDelay=useRef(3000),retryTimer=useRef(null),unmounted=useRef(false);

  const connect=useCallback(()=>{
    if(!canvasId||unmounted.current)return;
    const p=new URLSearchParams();
    if(jwtToken)p.set("jwt",jwtToken);if(shareToken)p.set("share",shareToken);
    const ws=new WebSocket(`${WS_URL}/ws?${p}`);wsRef.current=ws;

    ws.onopen=()=>{retryDelay.current=3000;ws.send(JSON.stringify({type:"join",canvasId}));};
    ws.onmessage=e=>{
      try{const msg=JSON.parse(e.data);
        if(msg.type==="patch")onPatch(msg.nodes);
        if(msg.type==="brain-patch")onBrainPatch(msg.brainNodes);
        if(msg.type==="members")onMembers(canvasId,msg.count);
        if(msg.type==="joined")onMembers(canvasId,msg.members);
      }catch(_){}
    };
    ws.onclose=()=>{
      if(unmounted.current)return;
      retryTimer.current=setTimeout(()=>{retryDelay.current=Math.min(retryDelay.current*1.5,30_000);connect();},retryDelay.current);
    };
    ws.onerror=()=>{};
  },[canvasId,shareToken,jwtToken,onPatch,onBrainPatch,onMembers]);

  useEffect(()=>{
    unmounted.current=false;connect();
    return()=>{unmounted.current=true;clearTimeout(retryTimer.current);wsRef.current?.close();};
  },[connect]);

  const sendPatch=useCallback(nodes=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({type:"patch",canvasId,nodes}));},[canvasId]);
  const sendBrainPatch=useCallback(nodes=>{if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({type:"brain-patch",canvasId,nodes}));},[canvasId]);
  return {sendPatch,sendBrainPatch};
}
