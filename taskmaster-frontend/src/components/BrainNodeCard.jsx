import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";
import { BRAIN_ROOT_W, BRAIN_ROOT_H, BRAIN_CHILD_W, BRAIN_CHILD_H, BRAIN_COLORS } from "../config/constants";

export function BrainNodeCard({
  node, dark, onDragStart, onDelete, onColorChange,
  isSelected, onSelect, readOnly, isNew, isEditing,
  editVal, setEditVal, onFinishEdit,
  onAddChild, childCount, onToggleCollapse,
}) {
  const [hov, setHov] = useState(false);
  const [picker, setPicker] = useState(false);
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const pickerRef = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Close color picker when clicking outside both card and picker
  useEffect(() => {
    if (!picker) return;
    const handler = (e) => {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target) &&
        cardRef.current && !cardRef.current.contains(e.target)
      ) {
        setPicker(false);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [picker]);

  const W = node.isRoot ? BRAIN_ROOT_W : BRAIN_CHILD_W;
  const H = node.isRoot ? BRAIN_ROOT_H : BRAIN_CHILD_H;
  const c = node.color || "#10b981";
  const isRight = node.side === "right";
  const hasChildren = childCount > 0;

  // Solid, fully opaque backgrounds — no transparency
  const bg = node.isRoot
    ? dark ? "#0d1f17" : "#f0fff8"
    : dark ? "#111827" : "#ffffff";

  // Side-aware button placement
  const addBtnSide = node.isRoot
    ? {}
    : isRight
    ? { right: -14, top: "50%", transform: "translateY(-50%)" }
    : { left: -14, top: "50%", transform: "translateY(-50%)" };

  const collapseSide = node.isRoot
    ? {}
    : isRight
    ? { right: -13, bottom: 4 }
    : { left: -13, bottom: 4 };

  return (
    <div
      ref={cardRef}
      onMouseDown={e => { onSelect(); onDragStart(e); }}
      onMouseEnter={() => { clearTimeout(hoverTimer.current); setHov(true); }}
      onMouseLeave={() => { hoverTimer.current = setTimeout(() => setHov(false), 120); }}
      className={`tm-brain-node${isNew ? " tm-node-new" : ""}`}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: W,
        height: H,
        borderRadius: node.isRoot ? 18 : 10,
        background: bg,
        border: `${isSelected ? "2.5px" : "1.8px"} solid ${c}`,
        boxShadow: isSelected
          ? `0 0 0 3px ${c}40, 0 6px 28px ${c}30`
          : node.isRoot
          ? `0 0 0 2px ${c}50, 0 8px 32px ${c}25`
          : `0 2px 12px rgba(0,0,0,.12)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: readOnly ? "default" : "grab",
        userSelect: "none",
        transition: "border-color .2s, box-shadow .2s",
        zIndex: node.isRoot ? 30 : isSelected ? 25 : 15,
        animation: isNew ? "tmNodeIn .4s cubic-bezier(.34,1.56,.64,1) forwards" : "none",
      }}
    >
      {/* Node content */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => onFinishEdit(editVal)}
          onKeyDown={e => {
            if (e.key === "Enter") onFinishEdit(editVal);
            if (e.key === "Escape") onFinishEdit(node.title || "");
          }}
          onMouseDown={e => e.stopPropagation()}
          placeholder={node.isRoot ? "Ideia central…" : "Expandir ideia…"}
          style={{
            width: "80%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "'Inter',sans-serif",
            fontWeight: node.isRoot ? 700 : 500,
            fontSize: node.isRoot ? 14 : 12,
            color: node.isRoot ? c : "var(--text-main)",
            textAlign: "center",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: "'Inter',sans-serif",
            fontSize: node.isRoot ? 14 : 12,
            fontWeight: node.isRoot ? 700 : 500,
            color: node.isRoot ? c : "var(--text-main)",
            textAlign: "center",
            padding: "0 12px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.35,
          }}
        >
          {node.title || (
            <span style={{ opacity: .35, fontStyle: "italic" }}>
              {node.isRoot ? "ideia central" : "expandir…"}
            </span>
          )}
        </span>
      )}

      {/* Color picker button — top corner, side-aware */}
      {hov && !readOnly && !isEditing && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); setPicker(p => !p); }}
          title="Cor do nó"
          style={{
            position: "absolute",
            top: -13,
            right: -13,
            background: bg,
            border: `2px solid ${c}`,
            borderRadius: "50%",
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: `0 2px 8px ${c}40`,
            zIndex: 50,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        </button>
      )}

      {/* Color picker panel */}
      {picker && !readOnly && (
        <div
          ref={pickerRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: "absolute",
            top: node.isRoot ? -54 : -50,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-card)",
            border: "1.5px solid var(--border)",
            borderRadius: 14,
            padding: "10px 14px",
            display: "flex",
            gap: 8,
            zIndex: 600,
            boxShadow: "0 8px 32px rgba(0,0,0,.28)",
            flexWrap: "wrap",
            maxWidth: 200,
          }}
        >
          {BRAIN_COLORS.map(col => (
            <button
              key={col}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onColorChange(col); setPicker(false); }}
              title={col}
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: col,
                border: col === c ? "3px solid white" : "2.5px solid transparent",
                cursor: "pointer",
                outline: col === c ? `2.5px solid ${col}` : "none",
                transition: "transform .12s",
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            />
          ))}
        </div>
      )}

      {/* Root node: left/right add-child buttons */}
      {node.isRoot && !readOnly && hov && !isEditing && (
        <>
          {/* Add left */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onAddChild("left"); }}
            title="Adicionar nó à esquerda"
            style={{
              position: "absolute",
              left: -28,
              top: "50%",
              transform: "translateY(-50%)",
              background: c,
              border: "none",
              borderRadius: "50%",
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 50,
              color: "white",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: `0 2px 8px ${c}50`,
            }}
          >
            +
          </button>
          {/* Add right */}
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onAddChild("right"); }}
            title="Adicionar nó à direita"
            style={{
              position: "absolute",
              right: -28,
              top: "50%",
              transform: "translateY(-50%)",
              background: c,
              border: "none",
              borderRadius: "50%",
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 50,
              color: "white",
              fontSize: 18,
              fontWeight: 700,
              lineHeight: 1,
              boxShadow: `0 2px 8px ${c}50`,
            }}
          >
            +
          </button>
        </>
      )}

      {/* Non-root: add sub-node button on connecting side */}
      {!node.isRoot && hov && !readOnly && !isEditing && !node.collapsed && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onAddChild(); }}
          title="Adicionar sub-nó"
          style={{
            position: "absolute",
            ...addBtnSide,
            background: c,
            border: "none",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 50,
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: `0 2px 8px ${c}50`,
          }}
        >
          +
        </button>
      )}

      {/* Collapse/expand toggle — shown when node has children */}
      {!node.isRoot && hasChildren && !readOnly && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onToggleCollapse(); }}
          title={node.collapsed ? "Expandir" : "Recolher"}
          style={{
            position: "absolute",
            ...collapseSide,
            background: node.collapsed ? c : "var(--bg-card)",
            border: `1.5px solid ${c}`,
            borderRadius: "50%",
            width: 18,
            height: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 50,
            color: node.collapsed ? "white" : c,
            fontSize: 10,
            fontWeight: 700,
            boxShadow: `0 1px 5px ${c}30`,
          }}
        >
          {node.collapsed ? "+" : "−"}
        </button>
      )}

      {/* Delete button */}
      {hov && !readOnly && !isEditing && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Excluir nó"
          style={{
            position: "absolute",
            bottom: -13,
            right: node.isRoot ? -13 : 4,
            background: "rgba(239,68,68,.1)",
            border: "1.5px solid rgba(239,68,68,.35)",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 50,
          }}
        >
          <Ic.Trash s={10}/>
        </button>
      )}
    </div>
  );
}
