"use client";
/* Plongée plein écran dans la photo d'une Légendaire.
   Usage :
     const [dive, setDive] = useState(null);
     <Carte c={c} onDive={(carte, rect) => setDive({ carte, rect })} />
     {dive && <PhotoDive {...dive} onClose={() => setDive(null)} />}
   Rendu dans document.body (portal) pour ne pas dépendre des transformations des parents. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const pad = n => String(n).padStart(3, "0");
const px = v => v + "px";

export default function PhotoDive({ carte: c, rect, onClose }) {
  const [phase, setPhase] = useState("start");
  const [real, setReal] = useState(false);
  const win = useRef(null), closeBtn = useRef(null), returnFocus = useRef(null);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    const t = setTimeout(() => closeBtn.current?.focus(), 400);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(r); clearTimeout(t); document.body.style.overflow = prev; };
  }, []);

  const close = () => {
    if (phase === "closing") return;
    if (win.current) { win.current.scrollLeft = 0; win.current.scrollTop = 0; }
    setReal(false); setPhase("closing");
    setTimeout(() => { onClose(); returnFocus.current?.focus?.(); }, 950);
  };
  useEffect(() => {
    const k = e => { if (e.key === "Escape") close(); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  });

  const toggleReal = e => {
    e.stopPropagation();
    if (phase !== "open") return;
    const next = !real; setReal(next);
    requestAnimationFrame(() => {
      const el = win.current; if (!el) return;
      if (next) { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; }
      else { el.scrollLeft = 0; el.scrollTop = 0; }
    });
  };

  const open = phase === "open";
  const winStyle = open
    ? { left: 0, top: 0, width: "100%", height: "100%", borderRadius: 0, boxShadow: "none" }
    : { left: px(rect.left), top: px(rect.top), width: px(rect.width), height: px(rect.height), borderRadius: px(rect.width * .05), boxShadow: "0 0 0 1px #ffcf6b, 0 0 40px -6px #ffcf6b" };
  const imgStyle = open ? undefined : { transform: "scale(1.35) translateY(-10%)" };
  const cls = ["ax-dive", open && "is-open", phase === "start" && "is-start", real && "is-real"].filter(Boolean).join(" ");

  return createPortal(
    <div className={cls} role="dialog" aria-modal="true" aria-label={c.nom} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="ax-dive-ring" />
      <div className="ax-dive-win" ref={win} style={winStyle}>
        <div className="ax-dive-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.image_hd_url || c.image_url} alt={c.nom} draggable={false} onClick={toggleReal} style={imgStyle} />
        </div>
        <div className="ax-dive-foil" />
      </div>
      <div className="ax-dive-meta">
        <span>LÉGENDAIRE · {c.serie} · {pad(c.numero)}/{pad(c.total)}</span>
        <b>{c.nom}</b>
        <span>{c.type} · © {c.credit}</span>
      </div>
      <div className="ax-dive-tools">
        <button type="button" onClick={toggleReal}><i className="ph-fill ph-magnifying-glass-plus" />{real ? "Ajuster à l'écran" : "Taille réelle"}</button>
        <button type="button" className="icon" ref={closeBtn} aria-label="Fermer" onClick={close}><i className="ph-fill ph-x" /></button>
      </div>
    </div>,
    document.body
  );
}
