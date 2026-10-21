"use client";
import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import MiniCarte from "@/components/MiniCarte";
import { ORDER, RAR } from "@/components/Carte";
import { api } from "@/lib/api";
import { ago, fr } from "@/lib/social";

/* Onglet « Marché » : solde d'éclats et récompense du jour, annonces des autres joueurs (filtres, tri),
   vente d'une carte (mise en dépôt jusqu'à la vente), recyclage des doubles, mes annonces, tendances.
   Styles : app/commerce.css (.mk-*, .mc-*, .cm-*). */

const TABS = [["acheter", "Acheter"], ["vendre", "Vendre"], ["annonces", "Mes annonces"]];
const SORTS = [["recent", "Plus récentes"], ["prix", "Prix croissant"], ["prix_desc", "Prix décroissant"], ["rarete", "Rareté"]];
const Price = ({ v }) => <span className="mk-price"><i className="ph-fill ph-diamond" aria-hidden="true" />{fr(v)}</span>;
// prix conseillé : quelques fois la valeur de recyclage
const suggest = (c, w) => (w?.recyclage?.[c.rarete] || 5) * 3;

export default function MarchePage() {
  const [wallet, setWallet] = useState(null);
  const [tab, setTab] = useState("acheter");
  const [filters, setFilters] = useState({ q: "", rarete: "", serie: "", tri: "recent" });
  const [market, setMarket] = useState(null);
  const [series, setSeries] = useState([]);
  const [mine, setMine] = useState(null);
  const [coll, setColl] = useState([]);
  const [pick, setPick] = useState(null);
  const [prix, setPrix] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState(null);

  const loadWallet = useCallback(() => api.eclats().then(setWallet).catch(() => {}), []);
  const loadMarket = useCallback(() => api.marche(filters).then(setMarket).catch(e => setMsg({ err: true, text: e.message })), [filters]);
  const loadMine = useCallback(() => {
    api.mesAnnonces().then(setMine).catch(() => {});
    api.collection().then(setColl).catch(() => {});
  }, []);
  useEffect(() => { loadWallet(); loadMine(); api.series().then(setSeries).catch(() => {}); }, [loadWallet, loadMine]);
  useEffect(() => { const t = setTimeout(loadMarket, 250); return () => clearTimeout(t); }, [loadMarket]);

  const run = async (fn, ok) => {
    setMsg(null);
    try { const r = await fn(); setMsg({ text: typeof ok === "function" ? ok(r) : ok }); } catch (x) { setMsg({ err: true, text: x.message }); }
    loadWallet(); loadMine(); loadMarket();
  };
  const choose = c => { setPick(c); setPrix(String(suggest(c, wallet))); };
  const sell = e => {
    e.preventDefault();
    const p = parseInt(prix, 10);
    if (!pick || !(p >= 1)) return;
    run(() => api.vendre(pick.id, p), `${pick.nom} est en vente pour ${fr(p)} éclats.`).then(() => setPick(null));
  };

  const set = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));
  const active = mine?.filter(l => l.statut === "active") || [];
  const shownColl = coll.filter(c => !q || c.nom.toLowerCase().includes(q.toLowerCase()));
  const pickNow = pick && coll.find(c => c.id === pick.id);
  const fee = wallet ? Math.round((parseInt(prix, 10) || 0) * wallet.commission) : 0;

  return (
    <>
      <Topbar title="Marché" sub={market ? `${market.annonces.length} annonce${market.annonces.length > 1 ? "s" : ""} en ligne` : ""} />
      <section className="sx-page">
        <div className="mk-wallet">
          <i className="ph-fill ph-diamond" aria-hidden="true" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <b>{wallet ? fr(wallet.eclats) : "…"}</b>
            <span className="sx-muted">éclats · gagne-en en vendant ou en recyclant tes doubles</span>
          </div>
          {wallet && (
            <button type="button" className="sx-btn" disabled={!wallet.recompense_dispo}
              onClick={() => run(api.recompense, `+${wallet.recompense} éclats ! Reviens demain.`)}>
              <i className="ph ph-gift" aria-hidden="true" />{wallet.recompense_dispo ? `Récompense du jour · +${wallet.recompense}` : "Récompense récupérée"}
            </button>
          )}
        </div>
        <div className="sx-tabs" role="tablist" aria-label="Marché">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" className="sx-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}{id === "annonces" && active.length ? ` · ${active.length}` : ""}
            </button>
          ))}
        </div>
        {msg && <p role="status" className={`cm-msg${msg.err ? " err" : ""}`}>{msg.text}</p>}

        <div className="sx-row" style={{ alignItems: "flex-start" }}>
          <section className="sx-grow" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "acheter" && (
              <>
                <div className="cm-filters">
                  <input className="input" value={filters.q} onChange={set("q")} placeholder="Chercher une carte" aria-label="Chercher une carte" />
                  <select className="input" value={filters.rarete} onChange={set("rarete")} aria-label="Rareté">
                    <option value="">Toutes raretés</option>
                    {ORDER.map(r => <option key={r} value={r}>{RAR[r].label}</option>)}
                  </select>
                  <select className="input" value={filters.serie} onChange={set("serie")} aria-label="Série">
                    <option value="">Toutes séries</option>
                    {series.map(s => <option key={s.code} value={s.code}>{s.code} · {s.nom}</option>)}
                  </select>
                  <select className="input" value={filters.tri} onChange={set("tri")} aria-label="Trier">
                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {market && market.annonces.length === 0 && <p className="sx-empty">Aucune annonce ne correspond. Reviens plus tard ou mets une carte en vente.</p>}
                <div className="mk-lots">
                  {market?.annonces.map(l => {
                    const short = wallet && wallet.eclats < l.prix;
                    return (
                      <article key={l.id} className="mk-lot">
                        <MiniCarte c={l.carte} />
                        <span className="mk-seller">par {l.vendeur.pseudo} · {ago(l.cree_le)}</span>
                        <div className="mk-lot-foot">
                          <Price v={l.prix} />
                          <button type="button" className="sx-btn sm" disabled={short} title={short ? "Pas assez d'éclats" : undefined}
                            onClick={() => run(() => api.acheter(l.id), `${l.carte.nom} rejoint ta collection.`)}>Acheter</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "vendre" && (
              <section className="sx-pane" style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="mk-sell">
                <h2 id="mk-sell" className="sx-lbl">Mettre une carte en vente</h2>
                {pickNow ? (
                  <div className="mk-sell">
                    <MiniCarte c={pickNow} qty={pickNow.quantite} />
                    <form className="mk-sell-form" onSubmit={sell}>
                      <b>{pickNow.nom}</b>
                      <span className="sx-muted">{RAR[pickNow.rarete].label} · tu en as {pickNow.quantite}{pickNow.quantite === 1 ? " (ta seule copie)" : ""}</span>
                      <label>Prix en éclats
                        <input className="input" type="number" min={1} max={100000} value={prix} onChange={e => setPrix(e.target.value)} required />
                      </label>
                      <span className="sx-muted">Commission de {Math.round((wallet?.commission || 0) * 100)} % : tu recevras {fr(Math.max(0, (parseInt(prix, 10) || 0) - fee))} éclats. La carte quitte ta collection jusqu'à la vente ; tu peux retirer l'annonce à tout moment.</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button type="submit" className="sx-btn">Mettre en vente</button>
                        {pickNow.quantite > 1 && (
                          <button type="button" className="sx-btn alt" onClick={() => run(() => api.recycler(pickNow.id, 1), r => `Recyclée : +${r.gain} éclats.`)}>
                            Recycler un double · +{wallet?.recyclage?.[pickNow.rarete]}
                          </button>
                        )}
                        <button type="button" className="sx-btn alt" onClick={() => setPick(null)}>Changer de carte</button>
                      </div>
                    </form>
                  </div>
                ) : <span className="sx-muted">Choisis une carte de ta collection. Les doubles sont affichés en premier.</span>}
                <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher dans ta collection" aria-label="Chercher dans ta collection" />
                <div className="cm-scroll">
                  {coll.length === 0 && <p className="sx-empty">Ta collection est vide : ouvre un booster d'abord.</p>}
                  <div className="cm-grid">
                    {[...shownColl].sort((a, b) => (b.quantite > 1) - (a.quantite > 1)).map(c => (
                      <button key={c.id} type="button" className="cm-pick" aria-pressed={pick?.id === c.id} aria-label={c.nom} onClick={() => choose(c)}>
                        <MiniCarte c={c} qty={c.quantite} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {tab === "annonces" && (
              <>
                {mine && mine.length === 0 && <p className="sx-empty">Tu n'as encore rien mis en vente.</p>}
                {mine?.map(l => (
                  <article key={l.id} className="mk-mine">
                    <MiniCarte c={l.carte} small />
                    <div>
                      <b>{l.carte.nom}</b>
                      <span className="sx-muted">
                        {l.statut === "active" ? `En vente · publiée ${ago(l.cree_le)}` : l.statut === "sold" ? `Vendue ${ago(l.vendu_le)}` : "Retirée"}
                      </span>
                    </div>
                    <Price v={l.prix} />
                    {l.statut === "active" && (
                      <button type="button" className="sx-btn alt sm" onClick={() => run(() => api.retirerAnnonce(l.id), `${l.carte.nom} est revenue dans ta collection.`)}>Retirer</button>
                    )}
                  </article>
                ))}
              </>
            )}
          </section>

          <aside className="sx-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="sx-pane" aria-labelledby="mk-trend" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 id="mk-trend" className="sx-lbl">Tendances · 7 jours</h2>
              {market && market.tendances.length === 0 && <span className="sx-muted">Aucune vente cette semaine.</span>}
              {market?.tendances.map((t, i) => (
                <div key={i} className="mk-trend">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.image_url} alt="" />
                  <span><b style={{ color: RAR[t.rarete]?.color }}>{t.nom}</b><br /><span className="sx-muted">{t.ventes} vente{t.ventes > 1 ? "s" : ""}</span></span>
                  <Price v={t.prix_moyen} />
                </div>
              ))}
            </section>
            <section className="sx-pane" aria-labelledby="mk-rec" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 id="mk-rec" className="sx-lbl">Valeur de recyclage</h2>
              {wallet && ORDER.map(r => (
                <div key={r} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: RAR[r].color }}>{RAR[r].label}</span><Price v={wallet.recyclage[r]} />
                </div>
              ))}
              <span className="sx-muted">Un double recyclé rapporte ces éclats ; ton dernier exemplaire est toujours conservé.</span>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
