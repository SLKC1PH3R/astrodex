"use client";
import { useEffect, useMemo, useState } from "react";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { fr } from "@/lib/social";

/* Onglet « Succès » : progression globale, filtre par catégorie, succès avec barre de progression
   et titre offert. Calculés côté serveur à partir des statistiques du joueur (app/achievements.py).
   Styles : app/social.css (.sx-*, .ac-*). */

const CAT_STYLE = {
  Boosters: { ic: "#9184d9", icon: "ph-package" },
  Collection: { ic: "#c58bff", icon: "ph-cards" },
  Séries: { ic: "#ec8a2e", icon: "ph-planet" },
  Échanges: { ic: "#5ee0c0", icon: "ph-arrows-left-right" },
  Bataille: { ic: "#e0574d", icon: "ph-sword" },
  Social: { ic: "#6aa8ff", icon: "ph-users" },
  Guilde: { ic: "#ffcf6b", icon: "ph-shield" },
};

export default function SuccesPage() {
  const [data, setData] = useState(null);
  const [cat, setCat] = useState("");
  const [error, setError] = useState(null);
  useEffect(() => { api.succes().then(setData).catch(e => setError(e.message)); }, []);

  const cats = useMemo(() => [...new Set((data?.succes || []).map(a => a.categorie))], [data]);
  // débloqués d'abord, puis les plus avancés
  const list = (data?.succes || []).filter(a => !cat || a.categorie === cat)
    .sort((a, b) => (b.debloque - a.debloque) || (b.valeur / (b.cible || 1)) - (a.valeur / (a.cible || 1)));
  const pct = data ? Math.round((data.debloques / Math.max(1, data.total)) * 100) : 0;

  return (
    <>
      <Topbar title="Succès" sub="Débloque des titres à afficher sur ton profil" />
      <section className="sx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        {data && (
          <>
            <div className="sx-head" style={{ alignItems: "center" }}>
              <div className="sx-tabs" role="group" aria-label="Catégories">
                <button type="button" className="sx-tab" aria-pressed={!cat} onClick={() => setCat("")}>Tous</button>
                {cats.map(c => <button key={c} type="button" className="sx-tab" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
              </div>
              <div className="ac-ring">
                <svg width="52" height="52" viewBox="0 0 36 36" role="img" aria-label={`${pct} % des succès débloqués`}>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(233,233,237,.12)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="#ffcf6b" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${(pct / 100) * 94.2} 94.2`} transform="rotate(-90 18 18)" />
                </svg>
                <div><b style={{ fontSize: 20 }}>{data.debloques} / {data.total}</b><br /><span className="sx-muted">succès débloqués</span></div>
              </div>
            </div>

            <div className="ac-grid">
              {list.map(a => {
                const st = CAT_STYLE[a.categorie] || CAT_STYLE.Collection;
                return (
                  <article key={a.id} className={`ac-card${a.debloque ? " is-done" : ""}`} style={{ "--ic": a.debloque ? "#ffcf6b" : st.ic }}>
                    <span className="ac-ico"><i className={`ph-fill ${a.debloque ? "ph-trophy" : st.icon}`} aria-hidden="true" /></span>
                    <div className="ac-body">
                      <div><b>{a.nom}</b><span className="sx-muted" style={a.debloque ? { color: "#ffe2a3" } : undefined}>
                        {a.debloque ? "Débloqué" : `${fr(a.valeur)} / ${fr(a.cible)}`}</span></div>
                      <span style={{ fontSize: 13, color: "var(--color-neutral-300)" }}>{a.description}</span>
                      {!a.debloque && (
                        <div className="sx-bar" style={{ "--bc": st.ic, height: 6 }} role="progressbar" aria-valuemin={0} aria-valuemax={a.cible} aria-valuenow={a.valeur}
                          aria-label={`Progression : ${a.nom}`}><i style={{ width: `${(a.valeur / Math.max(1, a.cible)) * 100}%` }} /></div>
                      )}
                      {a.titre && <span className="ac-reward">Titre « {a.titre} »</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
