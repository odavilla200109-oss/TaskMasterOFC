import { useState, useRef, useCallback, useEffect, useContext } from "react";
import { AppCtx } from "../context/AppContext";
import { Ic } from "../icons";
import { NodeCard } from "../components/NodeCard";
import { BrainNodeCard } from "../components/BrainNodeCard";
import { ProfileMenu } from "../components/ProfileMenu";
import { Sidebar } from "../components/Sidebar";
import { ShareModal } from "../components/ShareModal";
import { PasswordModal } from "../components/PasswordModal";
import { Modal, MTitle } from "../components/Modal";
import { BurstEffect } from "../components/BurstEffect";
import { useCollabWS } from "../hooks/useCollabWS";
import { useAnimatedBg } from "../hooks/useAnimatedBg";
import { applyTheme } from "../theme/theme";
import {
  Token, api, uid,
  NODE_W, NODE_H, NODE_W_CHILD, NODE_H_CHILD, NODE_GAP_X, NODE_GAP_Y,
  BRAIN_ROOT_W, BRAIN_ROOT_H, BRAIN_CHILD_W, BRAIN_CHILD_H,
  PRIORITY, BRAIN_COLORS,
} from "../config/constants";
import {
  getDescendants, nW, nH, freePos, isOverdue, brainOrbit,
} from "../utils/nodeUtils";
import {
  soundNodeCreate, soundNodeComplete, soundSubtaskCreate, soundDelete,
} from "../sounds";

export function AppScreen() {
  const {user,setScreen,dark,setDark}=useContext(AppCtx);

  const [canvases,setCanvases]=useState([]);
  const [activeId,setActiveId]=useState(null);
  const [activeType,setActiveType]=useState("task");
  const [nodes,setNodes]=useState([]);
  const [brainNodes,setBrainNodes]=useState([]);
  const [past,setPast]=useState([]);
  const [future,setFuture]=useState([]);
  const [scale,setScale]=useState(1);
  const [pan,setPan]=useState({x:80,y:80});
  const [editingId,setEditingId]=useState(null);
  const [editVal,setEditVal]=useState("");
  const [selectedId,setSelectedId]=useState(null);
  const [bursts,setBursts]=useState([]);
  const [newId,setNewId]=useState(null);

  const [sharedId,setSharedId]=useState(null);
  const [shareToken,setShareToken]=useState(null);
  const [readOnly,setReadOnly]=useState(false);
  const [showPwd,setShowPwd]=useState(false);

  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState(false);
  const [lastSaved,setLastSaved]=useState(null);
  const [loading,setLoading]=useState(true);

  const [showShare,setShowShare]=useState(false);
  const [membersMap,setMembersMap]=useState({});
  const [sideCol,setSideCol]=useState(false);
  const [showDelConfirm,setShowDelConfirm]=useState(false);

  const panRef=useRef({x:80,y:80});
  const scaleRef=useRef(1);
  const wrapRef=useRef(null);
  const bgRef=useRef(null);
  const isPanning=useRef(false);
  const lastMouse=useRef({x:0,y:0});
  const canPan=useRef(false);
  const dragging=useRef(null);
  const dragSaved=useRef(false);
  const nodesRef=useRef(nodes);
  const brainRef=useRef(brainNodes);
  const saveTimer=useRef(null);
  const periodicRef=useRef(null);
  const wsPatching=useRef(false);
  const saveRetries=useRef(0);
  const typeRef=useRef(activeType);

  nodesRef.current=nodes;
  brainRef.current=brainNodes;
  typeRef.current=activeType;
  useEffect(()=>{panRef.current=pan;},[pan]);
  useEffect(()=>{scaleRef.current=scale;},[scale]);

  const onBgMove=useAnimatedBg(bgRef,dark);
  useEffect(()=>{applyTheme(dark);},[dark]);

  // ── Load ──
  useEffect(()=>{
    const path=window.location.pathname;
    if(path.startsWith("/shared/")){
      const token=path.replace("/shared/","");
      if(!user||!Token.get()){localStorage.setItem("tm_pending_share",token);setScreen("login");return;}
      setShareToken(token);
      api(`/api/canvases/shared/${token}`).then(data=>{
        const isBrain=data.canvas?.type==="brain";
        if(isBrain){setBrainNodes(data.brainNodes||[]);setActiveType("brain");}
        else{setNodes(data.nodes||[]);setActiveType("task");}
        setSharedId(data.canvas.id);
        if(data.mode==="edit"&&data.hasPassword){setReadOnly(true);setShowPwd(true);}
        else setReadOnly(data.mode==="view");
        setLoading(false);
      }).catch(()=>setLoading(false));
      return;
    }
    if(!user){setLoading(false);return;}
    api("/api/canvases").then(async list=>{
      setCanvases(list);
      if(list.length>0){
        const first=list[0];setActiveId(first.id);setActiveType(first.type||"task");
        if(first.type==="brain"){const bn=await api(`/api/canvases/${first.id}/brain-nodes`);setBrainNodes(bn);}
        else{const n=await api(`/api/canvases/${first.id}/nodes`);setNodes(n);}
      }
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[user,setScreen]);

  // ── WS ──
  const handlePatch=useCallback(inc=>{wsPatching.current=true;setNodes(inc);setTimeout(()=>{wsPatching.current=false;},150);},[]);
  const handleBrainPatch=useCallback(inc=>{wsPatching.current=true;setBrainNodes(inc);setTimeout(()=>{wsPatching.current=false;},150);},[]);
  const handleMembers=useCallback((cid,count)=>{setMembersMap(m=>({...m,[cid]:count}));},[]);

  const {sendPatch,sendBrainPatch}=useCollabWS({
    canvasId:activeId||sharedId,shareToken,jwtToken:Token.get(),
    onPatch:handlePatch,onBrainPatch:handleBrainPatch,onMembers:handleMembers,
  });

  // ── Save ──
  const doSave=useCallback(async(list,isBrain=false)=>{
    if(!activeId||readOnly)return;
    setSaving(true);setSaveErr(false);
    try{
      await api(`/api/canvases/${activeId}/${isBrain?"brain-nodes":"nodes"}`,{method:"PUT",body:{nodes:list}});
      setLastSaved(new Date());saveRetries.current=0;
    }catch{
      saveRetries.current++;setSaveErr(true);
      if(saveRetries.current<3)setTimeout(()=>doSave(list,isBrain),2000*saveRetries.current);
    }finally{setSaving(false);}
  },[activeId,readOnly]);

  useEffect(()=>{
    const isBrain=activeType==="brain";
    const cur=isBrain?brainNodes:nodes;
    if((!activeId&&!sharedId)||loading||wsPatching.current||readOnly)return;
    clearTimeout(saveTimer.current);setSaving(true);
    saveTimer.current=setTimeout(async()=>{
      if(activeId)await doSave(cur,isBrain);
      isBrain?sendBrainPatch(cur):sendPatch(cur);
    },600);
    return()=>clearTimeout(saveTimer.current);
  },[nodes,brainNodes,activeId,sharedId,loading,readOnly,activeType,sendPatch,sendBrainPatch,doSave]);

  useEffect(()=>{
    const h=()=>{
      if(document.visibilityState==="hidden"&&activeId&&!readOnly){
        clearTimeout(saveTimer.current);
        const isBrain=typeRef.current==="brain";
        doSave(isBrain?brainRef.current:nodesRef.current,isBrain);
      }
    };
    document.addEventListener("visibilitychange",h);
    return()=>document.removeEventListener("visibilitychange",h);
  },[activeId,readOnly,doSave]);

  useEffect(()=>{
    if(!activeId||readOnly)return;
    periodicRef.current=setInterval(()=>{
      const isBrain=typeRef.current==="brain";
      if(!wsPatching.current)doSave(isBrain?brainRef.current:nodesRef.current,isBrain);
    },60_000);
    return()=>clearInterval(periodicRef.current);
  },[activeId,readOnly,doSave]);

  useEffect(()=>{
    const h=e=>{if(saving||saveErr){e.preventDefault();e.returnValue="";}};
    window.addEventListener("beforeunload",h);return()=>window.removeEventListener("beforeunload",h);
  },[saving,saveErr]);

  // ── Exit shared ──
  const exitShared=useCallback(async()=>{
    window.history.replaceState(null,"","/");
    setShareToken(null);setSharedId(null);setReadOnly(false);
    setNodes([]);setBrainNodes([]);setPast([]);setFuture([]);setLoading(true);
    if(user){
      try{
        const list=await api("/api/canvases");setCanvases(list);
        if(list.length>0){const first=list[0];setActiveId(first.id);setActiveType(first.type||"task");
          if(first.type==="brain"){const bn=await api(`/api/canvases/${first.id}/brain-nodes`);setBrainNodes(bn);}
          else{const n=await api(`/api/canvases/${first.id}/nodes`);setNodes(n);}
        }
      }catch(_){}
    }
    setLoading(false);
  },[user]);

  // ── Switch canvas ──
  const switchCanvas=useCallback(async id=>{
    setActiveId(id);setLoading(true);setSelectedId(null);setPast([]);setFuture([]);
    const c=canvases.find(x=>x.id===id);const type=c?.type||"task";setActiveType(type);
    if(type==="brain"){const bn=await api(`/api/canvases/${id}/brain-nodes`);setBrainNodes(bn);setNodes([]);}
    else{const n=await api(`/api/canvases/${id}/nodes`);setNodes(n);setBrainNodes([]);}
    setLoading(false);
  },[canvases]);

  const createCanvas=async type=>{
    const name=prompt(`Nome do workspace de ${type==="brain"?"brainstorm":"tarefas"}:`,"Novo Workspace");
    if(!name)return;
    try{const c=await api("/api/canvases",{method:"POST",body:{name,type}});setCanvases(p=>[...p,c]);switchCanvas(c.id);}
    catch(e){alert(e.message);}
  };
  const deleteCanvas=async id=>{
    if(!confirm("Excluir workspace?"))return;
    await api(`/api/canvases/${id}`,{method:"DELETE"});
    const next=canvases.filter(c=>c.id!==id);setCanvases(next);
    if(activeId===id&&next.length>0)switchCanvas(next[0].id);
  };
  const renameCanvas=async(id,name)=>{
    if(!name.trim())return;
    const u=await api(`/api/canvases/${id}`,{method:"PATCH",body:{name}});
    setCanvases(p=>p.map(c=>c.id===id?{...c,name:u.name}:c));
  };

  // ── History ──
  const saveHistory=useCallback((next,isBrain=false)=>{
    setPast(p=>[...p.slice(-50),{nodes:nodesRef.current,brain:brainRef.current}]);
    setFuture([]);
    if(isBrain)setBrainNodes(next);else setNodes(next);
  },[]);

  const undo=useCallback(()=>setPast(p=>{
    if(!p.length)return p;const prev=p[p.length-1];
    setFuture(f=>[{nodes:nodesRef.current,brain:brainRef.current},...f]);
    setNodes(prev.nodes);setBrainNodes(prev.brain);return p.slice(0,-1);
  }),[]);

  const redo=useCallback(()=>setFuture(f=>{
    if(!f.length)return f;const next=f[0];
    setPast(p=>[...p,{nodes:nodesRef.current,brain:brainRef.current}]);
    setNodes(next.nodes);setBrainNodes(next.brain);return f.slice(1);
  }),[]);

  useEffect(()=>{
    const h=e=>{
      if(e.target.tagName==="INPUT")return;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();undo();}
      if((e.ctrlKey||e.metaKey)&&(e.key==="y"||(e.shiftKey&&e.key==="z"))){e.preventDefault();redo();}
      if(e.key==="Escape")setSelectedId(null);
      if(e.key==="Delete"&&selectedId&&!readOnly){
        soundDelete();
        if(typeRef.current==="brain"){
          const del=getDescendants(brainRef.current,selectedId);
          saveHistory(brainRef.current.filter(n=>!del.has(n.id)),true);
        }else{
          const del=getDescendants(nodesRef.current,selectedId);
          saveHistory(nodesRef.current.filter(n=>!del.has(n.id)));
        }
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[undo,redo,selectedId,readOnly,saveHistory]);

  // ── Task actions ──
  const addNode=useCallback((parentId=null,cx=null,cy=null)=>{
    const id=uid();const w=wrapRef.current?.clientWidth??900,h=wrapRef.current?.clientHeight??600;
    let bx,by;const isChild=!!parentId;
    if(parentId){
      const parent=nodesRef.current.find(n=>n.id===parentId);
      const sibs=nodesRef.current.filter(n=>n.parentId===parentId);
      if(parent){
        const ph=parent.parentId?NODE_H_CHILD:NODE_H;
        if(sibs.length===0){bx=parent.x+Math.floor((NODE_W-NODE_W_CHILD)/2);by=parent.y+ph+NODE_GAP_Y;}
        else{const last=sibs[sibs.length-1];bx=last.x;by=last.y+NODE_H_CHILD+Math.floor(NODE_GAP_Y*.55);}
      }else{bx=cx??80;by=cy??80;}
      soundSubtaskCreate();
    }else{
      bx=cx??(-panRef.current.x+w/2)/scaleRef.current-NODE_W/2;
      by=cy??(-panRef.current.y+h/2)/scaleRef.current-NODE_H/2;
      soundNodeCreate();
    }
    const{x,y}=freePos(nodesRef.current,bx,by,isChild);
    const node={id,title:"",x,y,priority:"none",completed:false,parentId,dueDate:null};
    saveHistory([...nodesRef.current,node]);
    setEditingId(id);setEditVal("");setNewId(id);setTimeout(()=>setNewId(null),500);setSelectedId(id);
  },[saveHistory]);

  const finishEdit=useCallback((id,title,dueDate)=>{
    if(dueDate!==undefined){saveHistory(nodesRef.current.map(n=>n.id===id?{...n,dueDate}:n));return;}
    if(!title.trim())saveHistory(nodesRef.current.filter(n=>n.id!==id));
    else saveHistory(nodesRef.current.map(n=>n.id===id?{...n,title}:n));
    setEditingId(null);
  },[saveHistory]);

  const deleteNode=useCallback(id=>{
    soundDelete();const del=getDescendants(nodesRef.current,id);
    saveHistory(nodesRef.current.filter(n=>!del.has(n.id)));setSelectedId(null);
  },[saveHistory]);

  const completeNode=useCallback(id=>{
    const node=nodesRef.current.find(n=>n.id===id);if(!node)return;
    const done=!node.completed;
    saveHistory(nodesRef.current.map(n=>n.id===id?{...n,completed:done}:n));
    if(done){
      soundNodeComplete();
      const bId=uid();
      setBursts(b=>[...b,{id:bId,x:node.x+nW(node)/2,y:node.y+nH(node)/2}]);
      setTimeout(()=>setBursts(b=>b.filter(x=>x.id!==bId)),800);
    }
  },[saveHistory]);

  const cyclePriority=useCallback(id=>{
    const node=nodesRef.current.find(n=>n.id===id);if(!node||node.parentId)return;
    const next=PRIORITY.order[(PRIORITY.order.indexOf(node.priority)+1)%PRIORITY.order.length];
    saveHistory(nodesRef.current.map(n=>n.id===id?{...n,priority:next}:n));
  },[saveHistory]);

  // ── Brain actions ──
  const addBrainNode=useCallback((parentId=null,cx=null,cy=null)=>{
    const id=uid();const w=wrapRef.current?.clientWidth??900,h=wrapRef.current?.clientHeight??600;
    const isRoot=brainRef.current.length===0&&parentId===null;
    let x,y;
    if(isRoot){
      x=cx??(-panRef.current.x+w/2)/scaleRef.current-BRAIN_ROOT_W/2;
      y=cy??(-panRef.current.y+h/2)/scaleRef.current-BRAIN_ROOT_H/2;
    }else{
      const root=brainRef.current.find(n=>n.isRoot);
      const effectiveParent=parentId?brainRef.current.find(n=>n.id===parentId):root;
      const sibs=brainRef.current.filter(n=>n.parentId===(effectiveParent?.id||null));
      const pos=brainOrbit(effectiveParent||{x:400,y:300},sibs.length+1,sibs.length);
      x=pos.x;y=pos.y;
    }
    const color=BRAIN_COLORS[brainRef.current.length%BRAIN_COLORS.length];
    const root=brainRef.current.find(n=>n.isRoot);
    const node={id,title:"",x,y,color,parentId:isRoot?null:(parentId||root?.id||null),isRoot};
    saveHistory([...brainRef.current,node],true);
    setEditingId(id);setEditVal("");setNewId(id);setTimeout(()=>setNewId(null),500);setSelectedId(id);
    soundNodeCreate();
  },[saveHistory]);

  const finishBrainEdit=useCallback((id,title)=>{
    if(!title.trim())saveHistory(brainRef.current.filter(n=>n.id!==id),true);
    else saveHistory(brainRef.current.map(n=>n.id===id?{...n,title}:n),true);
    setEditingId(null);
  },[saveHistory]);

  const deleteBrainNode=useCallback(id=>{
    soundDelete();const del=getDescendants(brainRef.current,id);
    saveHistory(brainRef.current.filter(n=>!del.has(n.id)),true);setSelectedId(null);
  },[saveHistory]);

  const changeBrainColor=useCallback((id,color)=>{
    saveHistory(brainRef.current.map(n=>n.id===id?{...n,color}:n),true);
  },[saveHistory]);

  // ── Fit / Organize ──
  const fitToScreen=useCallback((override=null)=>{
    const isBrain=typeRef.current==="brain";
    const list=override||(isBrain?brainRef.current:nodesRef.current);
    if(!list.length)return;
    const wW=wrapRef.current?.clientWidth??900,wH=wrapRef.current?.clientHeight??600,PAD=100;
    const gW=n=>isBrain?(n.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W):nW(n);
    const gH=n=>isBrain?(n.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H):nH(n);
    const minX=Math.min(...list.map(n=>n.x))-PAD,maxX=Math.max(...list.map(n=>n.x+gW(n)))+PAD;
    const minY=Math.min(...list.map(n=>n.y))-PAD,maxY=Math.max(...list.map(n=>n.y+gH(n)))+PAD;
    const ns=Math.min(wW/(maxX-minX),wH/(maxY-minY),1.4);
    setPan({x:(wW-(maxX-minX)*ns)/2-minX*ns,y:(wH-(maxY-minY)*ns)/2-minY*ns});setScale(ns);
  },[]);

  const organizeTree=useCallback(()=>{
    if(activeType!=="task")return;
    const ORDER=["high","medium","low","none"],result=[...nodesRef.current];
    const roots=result.filter(n=>!n.parentId).sort((a,b)=>ORDER.indexOf(a.priority)-ORDER.indexOf(b.priority));
    function place(nodeId,x,y,depth=0){
      const idx=result.findIndex(n=>n.id===nodeId);if(idx===-1)return y;
      const ic=depth>0,nHh=ic?NODE_H_CHILD:NODE_H,nx=ic?x+Math.floor((NODE_W-NODE_W_CHILD)/2):x;
      result[idx]={...result[idx],x:nx,y};
      const ch=result.filter(n=>n.parentId===nodeId);
      const gy=depth===0?NODE_GAP_Y:Math.floor(NODE_GAP_Y*.55);let cy=y+nHh+gy;
      ch.forEach(c=>{const a=place(c.id,nx,cy,depth+1);cy=a+Math.floor(NODE_GAP_Y*.45);});
      return cy;
    }
    let cx=60;roots.forEach(r=>{place(r.id,cx,60);cx+=NODE_W+NODE_GAP_X*2;});
    saveHistory(result);setTimeout(()=>fitToScreen(result),60);
  },[saveHistory,fitToScreen,activeType]);

  // ── Canvas events ──
  const onWheel=useCallback(e=>{
    e.preventDefault();const rect=wrapRef.current.getBoundingClientRect();
    const mx=e.clientX-rect.left,my=e.clientY-rect.top;
    const factor=e.deltaY<0?1.1:.9,oldS=scaleRef.current;
    const newS=Math.min(Math.max(oldS*factor,.1),5),ratio=newS/oldS;
    setPan(p=>({x:mx-(mx-p.x)*ratio,y:my-(my-p.y)*ratio}));setScale(newS);
  },[]);

  const onCanvasDown=useCallback(e=>{
    if(e.button!==0)return;
    const isC=e.target===wrapRef.current||e.target.dataset.canvas;
    if(isC){canPan.current=true;isPanning.current=false;lastMouse.current={x:e.clientX,y:e.clientY};setSelectedId(null);}
  },[]);

  const startDrag=useCallback((e,id)=>{
    if(e.button!==0||readOnly)return;e.stopPropagation();canPan.current=false;
    const list=typeRef.current==="brain"?brainRef.current:nodesRef.current;
    const node=list.find(n=>n.id===id);if(!node)return;
    const rect=wrapRef.current.getBoundingClientRect();
    const mx=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
    const my=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
    dragging.current={id,ox:mx-node.x,oy:my-node.y};dragSaved.current=false;
  },[readOnly]);

  const onMouseMove=useCallback(e=>{
    onBgMove(e);
    if(dragging.current){
      if(!dragSaved.current){
        setPast(p=>[...p.slice(-50),{nodes:nodesRef.current,brain:brainRef.current}]);
        setFuture([]);dragSaved.current=true;
      }
      const rect=wrapRef.current?.getBoundingClientRect();if(!rect)return;
      const mx=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
      const my=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
      const d=dragging.current;
      if(typeRef.current==="brain")setBrainNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:mx-d.ox,y:my-d.oy}:n));
      else setNodes(ns=>ns.map(n=>n.id===d.id?{...n,x:mx-d.ox,y:my-d.oy}:n));
      return;
    }
    if(canPan.current){
      const dx=e.clientX-lastMouse.current.x,dy=e.clientY-lastMouse.current.y;
      if(!isPanning.current&&(Math.abs(dx)>4||Math.abs(dy)>4))isPanning.current=true;
      if(isPanning.current){setPan(p=>({x:p.x+dx,y:p.y+dy}));lastMouse.current={x:e.clientX,y:e.clientY};}
    }
  },[onBgMove]);

  const onMouseUp=useCallback(()=>{dragging.current=null;canPan.current=false;isPanning.current=false;},[]);

  const onDblClick=useCallback(e=>{
    if(readOnly)return;
    if(!e.target.dataset.canvas&&e.target!==wrapRef.current)return;
    const rect=wrapRef.current.getBoundingClientRect();
    const x=(e.clientX-rect.left-panRef.current.x)/scaleRef.current;
    const y=(e.clientY-rect.top-panRef.current.y)/scaleRef.current;
    if(typeRef.current==="brain")addBrainNode(null,x,y);
    else addNode(null,x-NODE_W/2,y-NODE_H/2);
  },[addNode,addBrainNode,readOnly]);

  // ── Export / Import ──
  const exportCanvas=useCallback(()=>{
    const isBrain=activeType==="brain";
    const d=isBrain?{brainNodes,type:"brain",version:3}:{nodes,type:"task",version:3};
    const url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="taskmaster.json";a.click();URL.revokeObjectURL(url);
  },[nodes,brainNodes,activeType]);

  const importCanvas=useCallback(()=>{
    const input=document.createElement("input");input.type="file";input.accept=".json";
    input.onchange=e=>{
      const file=e.target.files[0];if(!file)return;
      const reader=new FileReader();
      reader.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.type==="brain")saveHistory(d.brainNodes||[],true);else saveHistory(d.nodes||[]);}catch(_){}};
      reader.readAsText(file);
    };input.click();
  },[saveHistory]);

  const toggleDark=async()=>{
    const next=!dark;setDark(next);
    if(user){try{await api("/api/auth/me/darkmode",{method:"PATCH",body:{darkMode:next}});}catch(_){}}
  };

  const handleLogout=async()=>{try{await api("/api/auth/logout",{method:"POST"});}catch(_){}Token.clear();setScreen("login");};
  const handleSwitchAccount=()=>{Token.clear();setScreen("login");};
  const handleDeleteAccount=async()=>{
    setShowDelConfirm(false);
    try{await api("/api/auth/me",{method:"DELETE"});Token.clear();localStorage.clear();setScreen("login");}
    catch(e){alert(e.message);}
  };

  // ── Derived ──
  const taskConns=activeType==="task"
    ?nodes.filter(n=>n.parentId&&nodes.find(p=>p.id===n.parentId)).map(n=>({child:n,parent:nodes.find(p=>p.id===n.parentId)}))
    :[];
  const brainConns=activeType==="brain"
    ?brainNodes.filter(n=>n.parentId&&brainNodes.find(p=>p.id===n.parentId)).map(n=>({child:n,parent:brainNodes.find(p=>p.id===n.parentId)}))
    :[];

  const completed=nodes.filter(n=>n.completed).length;
  const overdueCt=nodes.filter(n=>isOverdue(n.dueDate)&&!n.completed).length;
  const isShared=!!shareToken;
  const hasSidebar=!isShared&&canvases.length>0&&!!user;
  const sideW=hasSidebar?(sideCol?40:224):0;
  const activeMembers=membersMap[activeId||sharedId||""]||0;
  const activeCanvas=canvases.find(c=>c.id===activeId);
  const hasLock=activeCanvas?.hasViewIndefLock||false;

  if(loading)return(
    <div style={{width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg-card)",fontFamily:"'Inter',sans-serif",color:"#10b981",fontSize:15,gap:10}}>
      <span style={{animation:"tmSpin 1s linear infinite",display:"inline-block",fontSize:22}}>⟳</span>Carregando workspace…
    </div>
  );

  return (
    <div ref={bgRef} style={{width:"100%",height:"100vh",overflow:"hidden",position:"relative",userSelect:"none"}}>
      {showShare&&activeId&&<ShareModal canvasId={activeId} hasLock={hasLock} onClose={()=>setShowShare(false)}/>}
      {showPwd&&<PasswordModal shareToken={shareToken} onUnlock={()=>{setReadOnly(false);setShowPwd(false);}} onCancel={()=>{setReadOnly(true);setShowPwd(false);}}/>}

      {showDelConfirm&&(
        <Modal onClose={()=>setShowDelConfirm(false)} maxW={400}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:10}}>⚠️</div>
            <MTitle>Excluir todos os dados?</MTitle>
            <p style={{fontFamily:"'Inter',sans-serif",fontSize:13,color:"var(--text-muted)",marginBottom:18,lineHeight:1.5}}>
              Esta ação é irreversível. Sua conta e todos os workspaces serão apagados (LGPD Art. 18).
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setShowDelConfirm(false)} className="tm-btn" style={{flex:1,background:"none",border:"1px solid var(--border)",borderRadius:11,padding:"10px",fontSize:13,color:"var(--text-muted)",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Cancelar</button>
              <button onClick={handleDeleteAccount} className="tm-btn" style={{flex:1,background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"white",border:"none",borderRadius:11,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Excluir tudo</button>
            </div>
          </div>
        </Modal>
      )}

      {hasSidebar&&<Sidebar canvases={canvases} activeId={activeId} membersMap={membersMap} onSelect={switchCanvas} onCreate={createCanvas} onDelete={deleteCanvas} onRename={renameCanvas} collapsed={sideCol} onToggle={()=>setSideCol(p=>!p)}/>}

      {/* HEADER */}
      <header style={{position:"fixed",top:0,left:sideW,right:0,zIndex:1000,display:"flex",alignItems:"center",gap:5,padding:"8px 14px",backdropFilter:"blur(28px) saturate(160%)",background:"var(--bg-glass)",borderBottom:"1.5px solid var(--border)",boxShadow:"0 2px 14px rgba(16,185,129,.06)",fontFamily:"'Inter',sans-serif",transition:"left .2s"}}>
        <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:800,fontSize:18,color:"var(--text-main)",letterSpacing:-0.8,display:"flex",alignItems:"baseline",gap:2}}>
          TM<span style={{fontSize:7.5,fontFamily:"'Inter',sans-serif",fontWeight:400,color:"#6ee7b7",marginLeft:4,letterSpacing:2.5,textTransform:"uppercase"}}>taskmaster</span>
        </div>

        {activeType==="brain"&&<span style={{fontSize:10.5,background:"rgba(139,92,246,.12)",border:"1px solid rgba(139,92,246,.3)",color:"#8b5cf6",borderRadius:20,padding:"3px 10px",fontWeight:700,letterSpacing:.5,display:"flex",alignItems:"center",gap:4}}><Ic.Brain s={11} c="#8b5cf6"/>Brainstorm</span>}
        {isShared&&<span style={{fontSize:10.5,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:700,letterSpacing:.5}}>{readOnly?"SOMENTE LEITURA":"✦ EDIÇÃO COLABORATIVA"}</span>}
        {activeMembers>1&&!isShared&&<span style={{fontSize:10.5,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.22)",color:"#10b981",borderRadius:20,padding:"3px 10px",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><span style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:"tmPulse 2s ease infinite",display:"inline-block"}}/>{activeMembers} online</span>}

        {isShared&&readOnly&&(
          <button onClick={()=>setShowPwd(true)} className="tm-btn" style={{background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.28)",color:"#f59e0b",borderRadius:9,padding:"5px 10px",display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,fontWeight:600}}>
            <Ic.Lock s={12}/>Desbloquear edição
          </button>
        )}

        <div style={{width:1,height:20,background:"var(--border)",margin:"0 2px"}}/>

        {!readOnly&&activeType==="task"&&(
          <button className="tm-btn" onClick={()=>addNode()} style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"white",border:"none",cursor:"pointer",borderRadius:9,padding:"6px 13px",fontWeight:700,fontSize:12.5,boxShadow:"0 2px 10px rgba(16,185,129,.28)",display:"flex",alignItems:"center",gap:5}}>
            <Ic.Plus s={12} c="white"/>Tarefa
          </button>
        )}
        {!readOnly&&activeType==="brain"&&(
          <button className="tm-btn" onClick={()=>addBrainNode()} style={{background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"white",border:"none",cursor:"pointer",borderRadius:9,padding:"6px 13px",fontWeight:700,fontSize:12.5,boxShadow:"0 2px 10px rgba(139,92,246,.25)",display:"flex",alignItems:"center",gap:5}}>
            <Ic.Brain s={12} c="white"/>Nó
          </button>
        )}

        {!readOnly&&[
          {l:"↩",a:undo,e:past.length>0,t:"Desfazer (Ctrl+Z)"},
          {l:"↪",a:redo,e:future.length>0,t:"Refazer (Ctrl+Y)"},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} disabled={!b.e} title={b.t} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:b.e?"pointer":"not-allowed",borderRadius:8,padding:"5px 9px",fontWeight:600,fontSize:13,opacity:b.e?1:.3}}>{b.l}</button>
        ))}

        <div style={{flex:1}}/>

        {saveErr&&<button onClick={()=>doSave(activeType==="brain"?brainRef.current:nodesRef.current,activeType==="brain")} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#f87171",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.22)",borderRadius:8,padding:"4px 9px",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>⚠ Salvar</button>}
        {saving&&!saveErr&&<span style={{fontSize:11,color:"#6ee7b7",animation:"tmPulse 1.2s ease infinite"}}>● salvando…</span>}
        {lastSaved&&!saving&&!saveErr&&<span style={{fontSize:10,color:"var(--text-muted)"}}>✓ {lastSaved.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>}

        {!readOnly&&activeType==="task"&&[
          {l:"Organizar",i:<Ic.Org s={12}/>,a:organizeTree,t:"Organizar por prioridade"},
          {l:"Centralizar",i:<Ic.Fit s={12}/>,a:()=>fitToScreen(),t:"Centralizar visão"},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} title={b.t} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            {b.i}{b.l}
          </button>
        ))}
        {!readOnly&&activeType==="brain"&&(
          <button className="tm-btn" onClick={()=>fitToScreen()} title="Centralizar" style={{background:"rgba(139,92,246,.07)",color:"#8b5cf6",border:"1px solid rgba(139,92,246,.25)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            <Ic.Fit s={12}/>Centralizar
          </button>
        )}

        {!readOnly&&[
          {l:"Exportar",i:<Ic.Export s={12}/>,a:exportCanvas},
          {l:"Importar",i:<Ic.Import s={12}/>,a:importCanvas},
        ].map(b=>(
          <button key={b.l} className="tm-btn" onClick={b.a} style={{background:"rgba(16,185,129,.07)",color:"var(--text-sub)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 10px",fontWeight:500,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
            {b.i}{b.l}
          </button>
        ))}

        {activeId&&!readOnly&&(
          <button className="tm-btn" onClick={()=>setShowShare(true)} style={{background:"rgba(16,185,129,.10)",border:"1px solid rgba(16,185,129,.28)",color:"#10b981",borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
            <Ic.Share s={12}/>Compartilhar
          </button>
        )}
        {isShared&&(
          <button className="tm-btn" onClick={exitShared} style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.25)",color:"#f87171",borderRadius:8,padding:"5px 11px",fontWeight:600,fontSize:12,cursor:"pointer"}}>← Sair</button>
        )}

        <button className="tm-btn" onClick={toggleDark} title={dark?"Modo claro":"Modo escuro"} style={{background:"rgba(16,185,129,.07)",border:"1px solid var(--border)",cursor:"pointer",borderRadius:8,padding:"5px 7px",display:"flex",alignItems:"center"}}>
          {dark?<Ic.Sun s={14}/>:<Ic.Moon s={14}/>}
        </button>

        {user&&<ProfileMenu user={user} onLogout={handleLogout} onSwitchAccount={handleSwitchAccount} onDeleteAccount={()=>setShowDelConfirm(true)}/>}
      </header>

      {/* CANVAS */}
      <div ref={wrapRef} data-canvas="true" style={{position:"absolute",inset:0,top:54,left:sideW,overflow:"hidden",cursor:"crosshair",transition:"left .2s"}}
        onMouseDown={onCanvasDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel} onDoubleClick={onDblClick}>

        {/* Grid */}
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
          <defs>
            <pattern id="tmGrid" x={pan.x%(24*scale)} y={pan.y%(24*scale)} width={24*scale} height={24*scale} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={1} fill={dark?"rgba(16,185,129,.08)":"rgba(16,185,129,.15)"}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tmGrid)"/>
        </svg>

        {/* Transform layer */}
        <div data-canvas="true" style={{position:"absolute",top:0,left:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${scale})`,transformOrigin:"0 0",width:10000,height:10000}}>

          {/* SVG connections */}
          <svg style={{position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",overflow:"visible"}}>
            <defs>
              <marker id="tmArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(16,185,129,.42)"/>
              </marker>
            </defs>

            {taskConns.map(({parent,child})=>{
              const x1=parent.x+nW(parent)/2,y1=parent.y+nH(parent);
              const x2=child.x+nW(child)/2,y2=child.y,ym=(y1+y2)/2;
              return <path key={`${parent.id}-${child.id}`} d={`M${x1} ${y1}C${x1} ${ym},${x2} ${ym},${x2} ${y2}`} fill="none" stroke={dark?"rgba(16,185,129,.28)":"rgba(16,185,129,.40)"} strokeWidth={1.5} strokeDasharray="8 5" markerEnd="url(#tmArrow)"/>;
            })}

            {brainConns.map(({parent,child})=>{
              const pw=parent.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W,ph=parent.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
              const cw=child.isRoot?BRAIN_ROOT_W:BRAIN_CHILD_W,ch2=child.isRoot?BRAIN_ROOT_H:BRAIN_CHILD_H;
              const x1=parent.x+pw/2,y1=parent.y+ph/2;
              const x2=child.x+cw/2,y2=child.y+ch2/2;
              const mx=(x1+x2)/2,my=(y1+y2)/2;
              const offset=Math.min(Math.abs(x2-x1),Math.abs(y2-y1))*0.3;
              const color=child.color||"#10b981";
              return <path key={`b-${parent.id}-${child.id}`} d={`M${x1} ${y1}Q${mx+offset} ${my-offset},${x2} ${y2}`} fill="none" stroke={color} strokeWidth={1.6} strokeOpacity={.5} strokeLinecap="round"/>;
            })}
          </svg>

          {bursts.map(b=><BurstEffect key={b.id} x={b.x} y={b.y}/>)}

          {activeType==="task"&&nodes.map(node=>(
            <NodeCard key={node.id} node={node} dark={dark}
              isEditing={editingId===node.id} editVal={editVal} setEditVal={setEditVal}
              isNew={node.id===newId} readOnly={readOnly} isSelected={selectedId===node.id} isChild={!!node.parentId}
              onSelect={()=>setSelectedId(node.id)}
              onFinishEdit={(title,dueDate)=>finishEdit(node.id,title,dueDate)}
              onStartEdit={()=>{setEditingId(node.id);setEditVal(node.title);}}
              onDelete={()=>deleteNode(node.id)} onComplete={()=>completeNode(node.id)}
              onCyclePriority={()=>cyclePriority(node.id)}
              onAddChild={()=>addNode(node.id)}
              onDragStart={e=>startDrag(e,node.id)}/>
          ))}

          {activeType==="brain"&&brainNodes.map(node=>(
            <BrainNodeCard key={node.id} node={node} dark={dark}
              isEditing={editingId===node.id} editVal={editVal} setEditVal={setEditVal}
              isNew={node.id===newId} readOnly={readOnly} isSelected={selectedId===node.id}
              onSelect={()=>setSelectedId(node.id)}
              onFinishEdit={title=>finishBrainEdit(node.id,title)}
              onDelete={()=>deleteBrainNode(node.id)}
              onColorChange={color=>changeBrainColor(node.id,color)}
              onDragStart={e=>startDrag(e,node.id)}/>
          ))}
        </div>
      </div>

      {activeType==="task"&&nodes.length===0&&!readOnly&&(
        <div style={{position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",background:"var(--bg-glass)",backdropFilter:"blur(14px)",border:"1.5px dashed var(--border)",borderRadius:14,padding:"11px 26px",pointerEvents:"none",color:"#059669",fontSize:13,fontWeight:500,fontFamily:"'Inter',sans-serif"}}>
          Duplo clique no canvas para criar uma tarefa ✦
        </div>
      )}
      {activeType==="brain"&&brainNodes.length===0&&!readOnly&&(
        <div style={{position:"fixed",bottom:48,left:"50%",transform:"translateX(-50%)",background:"rgba(139,92,246,.08)",backdropFilter:"blur(14px)",border:"1.5px dashed rgba(139,92,246,.35)",borderRadius:14,padding:"11px 26px",pointerEvents:"none",color:"#8b5cf6",fontSize:13,fontWeight:500,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>
          Clique em "Nó" ou duplo clique para criar sua ideia central ✦
        </div>
      )}

      <div style={{position:"fixed",bottom:18,right:18,zIndex:100,background:"var(--bg-glass)",backdropFilter:"blur(12px)",border:"1px solid var(--border)",borderRadius:10,padding:"5px 12px",fontFamily:"'Inter',sans-serif",color:"var(--text-sub)",fontSize:12,fontWeight:600}}>
        {Math.round(scale*100)}%
      </div>

      {activeType==="task"&&nodes.length>0&&(
        <div style={{position:"fixed",bottom:18,left:sideW+16,zIndex:100,background:"var(--bg-glass)",backdropFilter:"blur(12px)",border:"1px solid var(--border)",borderRadius:10,padding:"5px 14px",fontFamily:"'Inter',sans-serif",color:"var(--text-sub)",fontSize:12,display:"flex",gap:12,transition:"left .2s"}}>
          <span>📋 {nodes.length}</span><span>✓ {completed}</span>
          {overdueCt>0&&<span style={{color:"#ef4444"}}>⚠ {overdueCt}</span>}
        </div>
      )}
    </div>
  );
}
