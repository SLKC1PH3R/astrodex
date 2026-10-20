"use client";
import { useEffect, useMemo, useState } from "react";
import Carte, { ORDER, RAR } from "@/components/Carte";
import { coffretTheme } from "@/lib/coffrets";
import { api } from "@/lib/api";

/* Fiche du booster centré dans le carrousel (page Paquets, maquette « Vitrine ») :
   code et série, nom, description, chiffres clés, galerie qui défile des cartes Légendaires et
   Ultra rares du booster (vraies cartes du jeu), progression du joueur et bouton d'ouverture.
   Le contenu vient de GET /api/boosters/{code}/cartes (mis en cache par booster).
   Styles : app/boosterpanel.css (.bp-*). */

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const GALLERY_MAX = 18;               // au-delà, la galerie montre un échantillon (Légendaires d'abord)
const cache = new Map();              // code du booster → promesse de son contenu

function boosterCards(code) {
  if (!cache.has(code)) cache.set(code, api.boosterCards(code).catch(e => { cache.delete(code); throw e; }));
  return cache.get(code);
}

const tagOf = code => (/^S\d+[A-Z]$/.test(code || "") ? code.slice(0, -1) + code.slice(-1).toLowerCase() : code);
const fr = n => n.toLocaleString("fr-FR");

export default function BoosterPanel({ booster, owned, children }) {
  const [state, setState] = useState({ code: null, cards: null, error: false });
  const code = booster?.code;

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setState(s => (s.code === code ? s : { code, cards: null, error: false }));
    boosterCards(code)
      .then(cards => { if (alive) setState({ code, cards, error: false }); })
      .catch(() => { if (alive) setState({ code, cards: null, error: true }); });
    return () => { alive = false; };
  }, [code]);

  const cards = state.code === code ? state.cards : null;
  const info = useMemo(() => {
    if (!cards) return null;
    const by = r => cards.filter(c => c.rarete === r);
    const legend = by("L"), ultra = by("UR");
    const best = [...ORDER].reverse().find(r => cards.some(c => c.rarete === r));
    // échantillon stable : toutes les Légendaires (dans la limite), puis des Ultra rares réparties dans le contenu
    const room = Math.max(0, GALLERY_MAX - legend.length);
    const step = ultra.length > room && room > 0 ? ultra.length / room : 1;
    const urSample = room === 0 ? [] : ultra.length <= room ? ultra : Array.from({ length: room }, (_, i) => ultra[Math.floor(i * step)]);
    return { legend, ultra, best, gallery: [...legend.slice(0, GALLERY_MAX), ...urSample] };
  }, [cards]);

  if (!booster) return null;
  const theme = coffretTheme(booster);
  const roman = ROMAN[Number(String(booster.serie).replace(/\D/g, ""))] || booster.serie;
  const total = booster.nb_cartes_contenu || cards?.length || 0;
  const mine = owned && cards ? cards.filter(c => owned.has(c.id)).length : null;
  const pct = mine != null && total ? Math.round((mine / total) * 100) : 0;
  const loop = (info?.gallery.length || 0) >= 4;

  return (
    <aside className="bp-panel" style={{ "--cc": theme.couleur }} aria-label={`Détails du booster ${theme.titre}`}>
      <div className="bp-head">
        <span className="bp-tag">{tagOf(booster.code)} · SÉRIE {roman}</span>
        <h2 className="bp-title">{theme.titre}</h2>
        {booster.description && <p className="bp-desc">{booster.description}</p>}
      </div>

      <div className="bp-stats">
        <div><b>{total ? fr(total) : "—"}</b><span>cartes</span></div>
        <div><b>{booster.nb_cartes}</b><span>par paquet</span></div>
        <div><b style={{ color: info?.best ? RAR[info.best].color : undefined }}>{info?.best || "—"}</b><span>au mieux</span></div>
      </div>

      <section className="bp-gallery-wrap" aria-label="Cartes Légendaires et Ultra rares de ce booster">
        <div className="bp-label">
          <span>À DÉCROCHER</span>
          {info && (
            <span className="bp-counts">
              <b style={{ color: RAR.UR.color }}>{fr(info.ultra.length)}</b> Ultra rare{info.ultra.length > 1 ? "s" : ""}
              {" · "}
              <b style={{ color: RAR.L.color }}>{fr(info.legend.length)}</b> Légendaire{info.legend.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {state.error && <p className="bp-empty">Impossible de charger le contenu de ce booster.</p>}
        {!state.error && !info && <div className="bp-gallery bp-skeleton" aria-hidden="true"><i /><i /><i /></div>}
        {info && info.gallery.length === 0 && <p className="bp-empty">Pas de carte Ultra rare ni Légendaire dans ce booster.</p>}
        {info && info.gallery.length > 0 && (
          <div className={`bp-gallery${loop ? " is-loop" : ""}`}>
            <div className="bp-track" style={{ "--dur": `${info.gallery.length * 3.2}s` }}>
              {(loop ? [...info.gallery, ...info.gallery] : info.gallery).map((c, i) => (
                <div key={`${c.id}-${i}`} className="bp-card" aria-hidden={i >= info.gallery.length || undefined}>
                  <Carte c={c} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {mine != null && (
        <div className="bp-progress">
          <div><span>Ta progression</span><b>{fr(mine)} / {fr(total)}</b></div>
          <div className="bp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={mine}
            aria-label="Cartes de ce booster déjà dans ta collection"><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      <div className="bp-actions">{children}</div>
    </aside>
  );
}
