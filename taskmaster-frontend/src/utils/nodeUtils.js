import {
  NODE_W, NODE_H, NODE_W_CHILD, NODE_H_CHILD,
  NODE_GAP_X, NODE_GAP_Y,
  BRAIN_ROOT_W, BRAIN_ROOT_H, BRAIN_CHILD_W, BRAIN_CHILD_H,
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
  const W=child?NODE_W_CHILD:NODE_W, H=child?NODE_H_CHILD:NODE_H;
  const stepX=W+NODE_GAP_X, stepY=H+NODE_GAP_Y;
  if(!nodes.some(n=>collides(n.x,n.y,nW(n),nH(n),sx,sy,W,H))) return {x:sx,y:sy};
  for(let ring=1; ring<=12; ring++){
    for(let dx=-ring; dx<=ring; dx++){
      for(let dy=-ring; dy<=ring; dy++){
        if(Math.abs(dx)!==ring && Math.abs(dy)!==ring) continue;
        const x=sx+dx*stepX, y=sy+dy*stepY;
        if(!nodes.some(n=>collides(n.x,n.y,nW(n),nH(n),x,y,W,H))) return {x,y};
      }
    }
  }
  return {x:sx,y:sy};
}

export function isOverdue(d) { return d && new Date(d)<new Date(); }

export function fmtDue(d) {
  if (!d) return null;
  return new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"});
}

// ── MindMeister-style brain node positioning ──────────────
// H_GAP: horizontal distance between node edges
// V_GAP: vertical spacing between sibling nodes
const BRAIN_H_GAP = 90;
const BRAIN_V_GAP = 18;

/**
 * Calculate the position for a new brain node being added to `parentId` on `side`.
 * - Root children: stacked vertically on the chosen side, centered on root's vertical center
 * - Non-root children: stacked below the last sibling, extending in parent's direction
 */
export function brainPosition(brainNodes, parentId, side) {
  const parent = brainNodes.find(n => n.id === parentId);
  if (!parent) return { x: 400, y: 300 };

  if (parent.isRoot) {
    const isRight = side === "right";
    const siblings = brainNodes.filter(n => n.parentId === parentId && n.side === side);
    const count = siblings.length; // number of existing siblings on this side

    const x = isRight
      ? parent.x + BRAIN_ROOT_W + BRAIN_H_GAP
      : parent.x - BRAIN_CHILD_W - BRAIN_H_GAP;

    // Center the group (count+1 items) on root's vertical center
    const totalItems = count + 1;
    const totalHeight = totalItems * BRAIN_CHILD_H + (totalItems - 1) * BRAIN_V_GAP;
    const rootCenterY = parent.y + BRAIN_ROOT_H / 2;
    const startY = rootCenterY - totalHeight / 2;
    const y = startY + count * (BRAIN_CHILD_H + BRAIN_V_GAP);

    return { x, y };
  } else {
    // Children of non-root extend further in parent's direction
    const pSide = parent.side || side;
    const isRight = pSide === "right";
    const siblings = brainNodes.filter(n => n.parentId === parentId);

    const x = isRight
      ? parent.x + BRAIN_CHILD_W + BRAIN_H_GAP
      : parent.x - BRAIN_CHILD_W - BRAIN_H_GAP;

    let y;
    if (siblings.length === 0) {
      y = parent.y;
    } else {
      const sorted = [...siblings].sort((a, b) => a.y - b.y);
      y = sorted[sorted.length - 1].y + BRAIN_CHILD_H + BRAIN_V_GAP;
    }

    return { x, y };
  }
}

// Legacy alias kept for compatibility
export function brainOrbit(root, count, index) {
  return brainPosition([], root.id || "root", index % 2 === 0 ? "right" : "left");
}
