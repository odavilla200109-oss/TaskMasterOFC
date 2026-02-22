import {
  NODE_W, NODE_H, NODE_W_CHILD, NODE_H_CHILD,
  NODE_GAP_X, NODE_GAP_Y,
  BRAIN_ROOT_W, BRAIN_ROOT_H, BRAIN_CHILD_W, BRAIN_CHILD_H, BRAIN_ORBIT_R,
} from "../config/constants";

export function getDescendants(nodes, id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach(n => {
      if (n.parentId && found.has(n.parentId) && !found.has(n.id)) {
        found.add(n.id); changed = true;
      }
    });
  }
  return found;
}

export function nW(n) { return n.parentId ? NODE_W_CHILD : NODE_W; }
export function nH(n) { return n.parentId ? NODE_H_CHILD : NODE_H; }

export function collides(ax,ay,aw,ah, bx,by,bw,bh) {
  return Math.abs(ax-bx)<(aw+bw)/2+12 && Math.abs(ay-by)<(ah+bh)/2+12;
}

export function freePos(nodes, sx, sy, child=false) {
  const W = child?NODE_W_CHILD:NODE_W, H = child?NODE_H_CHILD:NODE_H;
  let x=sx, y=sy, a=0;
  while (a<300) {
    if (!nodes.some(n=>collides(n.x,n.y,nW(n),nH(n),x,y,W,H))) return {x,y};
    x += W+NODE_GAP_X;
    if (x>sx+(W+NODE_GAP_X)*5) { x=sx; y+=H+NODE_GAP_Y; }
    a++;
  }
  return {x,y};
}

export function isOverdue(d) { return d && new Date(d)<new Date(); }

export function fmtDue(d) {
  if (!d) return null;
  return new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
}

export function brainOrbit(root, count, index) {
  const total = Math.max(count,6);
  const angle = (2*Math.PI*index)/total + (Math.floor(index/6)*Math.PI/6);
  const radius = BRAIN_ORBIT_R + Math.floor(index/6)*80;
  return {
    x: root.x + BRAIN_ROOT_W/2 - BRAIN_CHILD_W/2 + Math.cos(angle)*radius,
    y: root.y + BRAIN_ROOT_H/2 - BRAIN_CHILD_H/2 + Math.sin(angle)*radius,
  };
}
