import { useState, useRef, useEffect } from "react";
import { Ic } from "../icons";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function fmtDisplay(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function DueDatePicker({node, onFinishEdit, isChild}) {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const containerRef = useRef(null);

  const openPicker = (e) => {
    e.stopPropagation();
    setTempDate(node.dueDate || todayStr());
    setOpen(o => !o);
  };

  const confirm = (e) => {
    e.stopPropagation();
    onFinishEdit(node.title, tempDate || todayStr());
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onFinishEdit(node.title, null);
    setOpen(false);
  };

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const s = isChild ? 11 : 12;
  const hasDate = !!node.dueDate;
  const isOverdue = hasDate && new Date(node.dueDate + "T00:00:00") < new Date(todayStr() + "T00:00:00");

  return (
    <div ref={containerRef} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <button
        title={hasDate ? `Vencimento: ${fmtDisplay(node.dueDate)}` : "Definir data de vencimento"}
        className="tm-btn"
        onMouseDown={e=>e.stopPropagation()}
        onClick={openPicker}
        style={{
          background: hasDate
            ? isOverdue ? "rgba(239,68,68,.1)" : "rgba(16,185,129,.08)"
            : "none",
          border: hasDate
            ? `1px solid ${isOverdue ? "rgba(239,68,68,.3)" : "rgba(16,185,129,.2)"}`
            : "none",
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          gap:4,
          padding: hasDate ? "2px 7px" : "3px 4px",
          borderRadius:6,
          color: hasDate
            ? isOverdue ? "#ef4444" : "var(--text-sub)"
            : "var(--text-muted)",
          fontSize: isChild ? 10 : 10.5,
          fontFamily:"'Inter',sans-serif",
          fontWeight: hasDate ? 600 : 400,
        }}
      >
        <Ic.Cal s={s} c={hasDate ? (isOverdue ? "#ef4444" : "#10b981") : undefined}/>
        {hasDate && <span>{fmtDisplay(node.dueDate)}{isOverdue && " ⚠"}</span>}
      </button>

      {open && (
        <div
          onMouseDown={e=>e.stopPropagation()}
          style={{
            position:"absolute",
            bottom:"calc(100% + 8px)",
            left:0,
            background:"var(--bg-card)",
            border:"1.5px solid var(--border)",
            borderRadius:14,
            padding:"14px",
            zIndex:9999,
            boxShadow:"0 8px 36px rgba(0,0,0,.22)",
            display:"flex",
            flexDirection:"column",
            gap:10,
            minWidth:210,
            fontFamily:"'Inter',sans-serif",
          }}
        >
          <div style={{fontSize:10,fontWeight:700,color:"var(--text-muted)",letterSpacing:1.2,textTransform:"uppercase"}}>
            Data de vencimento
          </div>

          <input
            type="date"
            value={tempDate}
            onChange={e=>setTempDate(e.target.value)}
            onMouseDown={e=>e.stopPropagation()}
            style={{
              border:"1.5px solid var(--border)",
              borderRadius:9,
              padding:"8px 10px",
              fontFamily:"'Inter',sans-serif",
              fontSize:13,
              background:"var(--bg-card)",
              color:"var(--text-main)",
              width:"100%",
              cursor:"pointer",
              outline:"none",
              transition:"border-color .15s",
            }}
            onFocus={e=>e.target.style.borderColor="#10b981"}
            onBlur={e=>e.target.style.borderColor="var(--border)"}
          />

          <div style={{display:"flex",gap:7}}>
            <button
              onClick={confirm}
              onMouseDown={e=>e.stopPropagation()}
              className="tm-btn"
              style={{
                flex:1,
                background:"linear-gradient(135deg,#10b981,#059669)",
                color:"white",
                border:"none",
                borderRadius:9,
                padding:"8px",
                fontFamily:"'Inter',sans-serif",
                fontSize:12,
                fontWeight:700,
                cursor:"pointer",
              }}
            >
              Confirmar
            </button>
            {hasDate && (
              <button
                onClick={clear}
                onMouseDown={e=>e.stopPropagation()}
                className="tm-btn"
                style={{
                  background:"rgba(239,68,68,.08)",
                  color:"#f87171",
                  border:"1px solid rgba(239,68,68,.25)",
                  borderRadius:9,
                  padding:"8px 11px",
                  fontFamily:"'Inter',sans-serif",
                  fontSize:12,
                  fontWeight:600,
                  cursor:"pointer",
                }}
              >
                Limpar
              </button>
            )}
          </div>

          <div style={{fontSize:10,color:"var(--text-muted)",textAlign:"center",marginTop:-4}}>
            Se não escolher, usa a data de hoje
          </div>
        </div>
      )}
    </div>
  );
}
