import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Ic } from "../icons";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                 "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DOWS   = ["D","S","T","Q","Q","S","S"];

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
}

function isOverdueFn(iso) {
  if (!iso) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(iso + "T00:00:00") < today;
}

export function DueDatePicker({ node, onFinishEdit, isChild }) {
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, left: 0 });
  const [view, setView]   = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Sync calendar view to selected date whenever we open
  useEffect(() => {
    if (!open) return;
    const d = node.dueDate ? new Date(node.dueDate + "T00:00:00") : new Date();
    setView({ year: d.getFullYear(), month: d.getMonth() });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click — capture phase so it fires before React handlers
  useEffect(() => {
    if (!open) return;
    const h = e => {
      if (
        popRef.current  && !popRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h, true);
    return () => document.removeEventListener("mousedown", h, true);
  }, [open]);

  // Calculate popup position relative to viewport (works regardless of canvas transform)
  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const calH = 308, calW = 248;
    const spaceBelow = window.innerHeight - r.bottom;
    const top  = spaceBelow > calH + 8 ? r.bottom + 6 : r.top - calH - 6;
    const left = Math.max(6, Math.min(r.left - calW / 2 + r.width / 2, window.innerWidth - calW - 6));
    setPos({ top, left });
  }, []);

  const handleOpen = e => {
    e.preventDefault();
    e.stopPropagation();
    if (!open) calcPos();
    setOpen(o => !o);
  };

  const prevMonth = e => {
    e.stopPropagation();
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  };
  const nextMonth = e => {
    e.stopPropagation();
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
  };

  const select = (e, day) => {
    e.stopPropagation();
    const d   = new Date(view.year, view.month, day);
    const iso = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    onFinishEdit(node.title, iso);
    setOpen(false);
  };

  const clear = e => {
    e.stopPropagation();
    onFinishEdit(node.title, null);
    setOpen(false);
  };

  const close = e => {
    e.stopPropagation();
    setOpen(false);
  };

  // Calendar grid computation
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sel   = node.dueDate ? new Date(node.dueDate + "T00:00:00") : null;
  const firstDow    = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  // Button display
  const dateLabel = fmtDate(node.dueDate);
  const overdue   = isOverdueFn(node.dueDate);

  // ── Popup (rendered via portal to escape CSS transform context) ──────────
  const popup = (
    <div
      ref={popRef}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position:       "fixed",
        top:            pos.top,
        left:           pos.left,
        zIndex:         99999,
        width:          248,
        background:     "var(--bg-card)",
        backdropFilter: "blur(28px) saturate(170%)",
        border:         "1.5px solid var(--border)",
        borderRadius:   18,
        padding:        "14px 12px 12px",
        boxShadow:      "0 20px 60px rgba(0,0,0,.28), 0 2px 12px rgba(16,185,129,.09)",
        animation:      "tmScaleIn .18s cubic-bezier(.34,1.1,.64,1) both",
        fontFamily:     "'Inter',sans-serif",
      }}
    >
      {/* Month navigation */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
        <button onClick={prevMonth} onMouseDown={e=>e.stopPropagation()} className="tm-btn"
          style={{ background:"rgba(16,185,129,.07)", border:"none", cursor:"pointer",
                   color:"var(--text-sub)", padding:"4px 10px", borderRadius:8,
                   fontSize:17, lineHeight:1, display:"flex", alignItems:"center" }}>
          ‹
        </button>
        <span style={{ fontWeight:700, fontSize:13, color:"var(--text-main)", letterSpacing:-.2 }}>
          {MONTHS[view.month]} {view.year}
        </span>
        <button onClick={nextMonth} onMouseDown={e=>e.stopPropagation()} className="tm-btn"
          style={{ background:"rgba(16,185,129,.07)", border:"none", cursor:"pointer",
                   color:"var(--text-sub)", padding:"4px 10px", borderRadius:8,
                   fontSize:17, lineHeight:1, display:"flex", alignItems:"center" }}>
          ›
        </button>
      </div>

      {/* Day-of-week labels */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:5 }}>
        {DOWS.map((d, i) => (
          <div key={i} style={{ textAlign:"center", fontSize:9.5, fontWeight:700,
                                color:"var(--text-muted)", padding:"2px 0", letterSpacing:.4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const d       = new Date(view.year, view.month, day);
          const isToday = d.getTime() === today.getTime();
          const isSel   = sel && d.toDateString() === sel.toDateString();
          const isPast  = d < today && !isToday;
          return (
            <button
              key={day}
              onClick={e => select(e, day)}
              onMouseDown={e => e.stopPropagation()}
              className="tm-btn"
              style={{
                aspectRatio:     "1",
                display:         "flex",
                alignItems:      "center",
                justifyContent:  "center",
                borderRadius:    "50%",
                border:          isToday && !isSel ? "1.5px solid rgba(16,185,129,.55)" : "1.5px solid transparent",
                cursor:          "pointer",
                padding:         0,
                fontSize:        11.5,
                fontWeight:      isSel || isToday ? 700 : 400,
                background:      isSel ? "#10b981" : isToday ? "rgba(16,185,129,.12)" : "none",
                color:           isSel ? "#fff" : isPast ? "var(--text-muted)" : "var(--text-main)",
                transition:      "background .1s",
              }}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div style={{ borderTop:"1px solid var(--border)", marginTop:10, paddingTop:8, display:"flex", gap:6 }}>
        {node.dueDate && (
          <button onClick={clear} onMouseDown={e=>e.stopPropagation()} className="tm-btn"
            style={{ flex:1, background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.22)",
                     borderRadius:9, padding:"6px 0", fontSize:11.5, color:"#f87171",
                     cursor:"pointer", fontWeight:600 }}>
            Limpar
          </button>
        )}
        <button onClick={close} onMouseDown={e=>e.stopPropagation()} className="tm-btn"
          style={{ flex:1, background:"rgba(16,185,129,.06)", border:"1px solid var(--border)",
                   borderRadius:9, padding:"6px 0", fontSize:11.5, color:"var(--text-muted)",
                   cursor:"pointer" }}>
          Fechar
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ position:"relative" }} onMouseDown={e => e.stopPropagation()}>
      {/* Trigger button */}
      <button
        ref={btnRef}
        title={dateLabel ? `Vence: ${dateLabel}` : "Data de vencimento"}
        className="tm-btn"
        onMouseDown={e => e.stopPropagation()}
        onClick={handleOpen}
        style={{
          background:  "none",
          border:      "none",
          cursor:      "pointer",
          display:     "flex",
          alignItems:  "center",
          gap:         3,
          padding:     "3px 4px",
          borderRadius: 6,
          color:       overdue ? "#ef4444" : dateLabel ? "#10b981" : "var(--text-muted)",
          transition:  "color .15s",
        }}
      >
        <Ic.Cal s={isChild ? 11 : 12} />
        {dateLabel && (
          <span style={{
            fontSize:    9.5,
            fontWeight:  700,
            fontFamily:  "'Inter',sans-serif",
            color:       overdue ? "#ef4444" : "#10b981",
            whiteSpace:  "nowrap",
          }}>
            {dateLabel}
          </span>
        )}
      </button>

      {/* Portal: rendered at document.body to escape CSS transform context */}
      {open && createPortal(popup, document.body)}
    </div>
  );
}
