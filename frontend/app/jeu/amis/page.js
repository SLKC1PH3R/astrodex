"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { RAR } from "@/components/Carte";
import { api } from "@/lib/api";
import { Avatar, ago, fr, notifyBadges } from "@/lib/social";

/* Onglet « Amis » : ajout par code ami ou pseudo, amis (statut en ligne), demandes reçues et envoyées,
   code ami à partager, activité récente des amis. Styles : app/social.css (.sx-*, .fr-*). */

const TABS = [
  { id: "amis", label: "Mes amis" },
  { id: "recues", label: "Demandes reçues" },
  { id: "envoyees", label: "Envoyées" },
];
const profile = id => `/jeu/profil?id=${encodeURIComponent(id)}`;

export default function AmisPage() {
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState([]);
  const [tab, setTab] = useState("amis");
  const [cible, setCible] = useState("");
  const [msg, setMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.amis().then(setData).catch(e => setMsg({ err: true, text: e.message }));
    api.activiteAmis().then(setFeed).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async e => {
    e.preventDefault();
    if (!cible.trim()) return;
    try {
      const r = await api.ajouterAmi(cible.trim());
      setMsg({ text: r.statut === "amis" ? "Vous êtes maintenant amis !" : "Demande envoyée." });
      setCible(""); load();
    } catch (x) { setMsg({ err: true, text: x.message }); }
  };
  const act = fn => async () => { try { await fn(); load(); notifyBadges(); } catch (x) { setMsg({ err: true, text: x.message }); } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* presse-papiers refusé */ }
  };

  const list = data?.[tab] || [];
  const online = data?.amis.filter(a => a.en_ligne).length || 0;

  return (
    <>
      <Topbar title="Amis" sub={data ? `${data.amis.length} ami${data.amis.length > 1 ? "s" : ""} · ${online} en ligne` : ""} />
      <section className="sx-page">
        <div className="sx-head" style={{ alignItems: "center" }}>
          <div className="sx-tabs" role="tablist" aria-label="Amis">
            {TABS.map(t => (
              <button key={t.id} type="button" role="tab" className="sx-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}{data && data[t.id].length > 0 && t.id !== "amis" ? ` · ${data[t.id].length}` : ""}
              </button>
            ))}
          </div>
          <form className="fr-add" onSubmit={add}>
            <label htmlFor="fr-cible" style={{ position: "absolute", left: -9999 }}>Code ami ou pseudo</label>
            <input id="fr-cible" className="input" value={cible} onChange={e => setCible(e.target.value)} placeholder="Code ami (ASTRO-…) ou pseudo" maxLength={40} />
            <button type="submit" className="sx-btn">Ajouter</button>
          </form>
        </div>
        {msg && <p role="status" style={{ margin: 0, fontSize: 14, color: msg.err ? "#ffb3b3" : "#5ee0c0" }}>{msg.text}</p>}

        <div className="sx-row" style={{ alignItems: "flex-start" }}>
          <section className="sx-grow fr-list" aria-label={TABS.find(t => t.id === tab).label}>
            {data && list.length === 0 && (
              <p className="sx-empty">
                {tab === "amis" ? "Pas encore d'ami. Partage ton code ami ou ajoute un joueur par son pseudo."
                  : tab === "recues" ? "Aucune demande en attente." : "Aucune demande envoyée en attente."}
              </p>
            )}
            {list.map(f => (
              <article key={f.id} className="fr-row">
                <Link className="fr-who" href={profile(f.id)} aria-label={`Profil de ${f.pseudo}`}>
                  <Avatar id={f.id} pseudo={f.pseudo} size={48} />
                  {tab === "amis" && <span className="fr-dot" style={{ background: f.en_ligne ? "#5ee0c0" : "#75798c" }} />}
                </Link>
                <div className="fr-info">
                  <Link href={profile(f.id)}>{f.pseudo}{f.titre ? <span className="sx-muted"> · {f.titre}</span> : null}</Link>
                  <span className="sx-muted" style={tab === "amis" && f.en_ligne ? { color: "#5ee0c0" } : undefined}>
                    {tab === "amis" ? (f.en_ligne ? "En ligne" : `Vu ${ago(f.vu_le)}`) : `Demande ${ago(f.depuis)}`}
                  </span>
                </div>
                <span className="sx-muted">{fr(f.cartes_uniques)} cartes</span>
                <div className="fr-actions">
                  {tab === "amis" && (
                    <>
                      <Link className="sx-btn alt sm" href={`/jeu/echanges?avec=${encodeURIComponent(f.id)}`}>Échanger</Link>
                      <Link className="sx-btn alt sm" href={`/jeu/messages?avec=${encodeURIComponent(f.id)}`}>Message</Link>
                      <button type="button" className="sx-btn alt sm" onClick={act(() => api.retirerAmi(f.id))} aria-label={`Retirer ${f.pseudo} de tes amis`}>Retirer</button>
                    </>
                  )}
                  {tab === "recues" && (
                    <>
                      <button type="button" className="sx-btn sm" onClick={act(() => api.accepterAmi(f.id))}>Accepter</button>
                      <button type="button" className="sx-btn alt sm" onClick={act(() => api.retirerAmi(f.id))}>Refuser</button>
                    </>
                  )}
                  {tab === "envoyees" && <button type="button" className="sx-btn alt sm" onClick={act(() => api.retirerAmi(f.id))}>Annuler</button>}
                </div>
              </article>
            ))}
          </section>

          <aside className="sx-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="sx-pane" aria-labelledby="fr-code">
              <h2 id="fr-code" className="sx-lbl">Ton code ami</h2>
              <div className="fr-code"><b>{data?.code || "…"}</b><button type="button" className="sx-btn alt sm" onClick={copy}>{copied ? "Copié" : "Copier"}</button></div>
              <span className="sx-muted">Partage-le pour qu'on t'ajoute sans chercher ton pseudo.</span>
            </section>
            <section className="sx-pane" aria-labelledby="fr-feed">
              <h2 id="fr-feed" className="sx-lbl">Activité de tes amis</h2>
              {feed.length === 0 && <span className="sx-muted">Les Ultra rares et Légendaires obtenues par tes amis apparaîtront ici.</span>}
              <div className="fr-feed">
                {feed.map((a, i) => (
                  <div key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.image_url} alt="" />
                    <span><b>{a.pseudo}</b> a obtenu <b style={{ color: RAR[a.rarete]?.color }}>{a.carte}</b> ({RAR[a.rarete]?.label}) · <span className="sx-muted">{ago(a.le)}</span></span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
