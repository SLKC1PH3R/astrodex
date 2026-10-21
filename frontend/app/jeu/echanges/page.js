"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import MiniCarte from "@/components/MiniCarte";
import { api } from "@/lib/api";
import { Avatar, ago, notifyBadges } from "@/lib/social";

/* Onglet « Échanges » : composer une proposition avec un ami (jusqu'à 5 cartes de chaque côté),
   répondre aux propositions reçues, suivre celles envoyées et l'historique.
   /jeu/echanges?avec=ID présélectionne l'ami. Styles : app/commerce.css (.ex-*, .mc-*, .cm-*). */

const MAX = 5;
const STATUS = { accepted: "Accepté", refused: "Refusé", cancelled: "Annulé" };
const power = cards => cards.reduce((s, c) => s + (c.puissance || 0), 0);
const match = q => c => !q || c.nom.toLowerCase().includes(q.toLowerCase());

function Slots({ cards, onRemove }) {
  return (
    <div className="ex-slots">
      {Array.from({ length: MAX }, (_, i) => cards[i]
        ? <button key={cards[i].id} type="button" className="cm-pick" onClick={() => onRemove(cards[i].id)} aria-label={`Retirer ${cards[i].nom}`}><MiniCarte c={cards[i]} small /></button>
        : <span key={i} className="ex-slot" aria-hidden="true" />)}
    </div>
  );
}

function Picker({ cards, chosen, onToggle, flag, label }) {
  const [q, setQ] = useState("");
  const shown = cards.filter(match(q));
  return (
    <>
      <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher une carte" aria-label={`Chercher dans ${label}`} />
      <div className="cm-scroll">
        {shown.length === 0 && <p className="sx-empty">Aucune carte.</p>}
        <div className="cm-grid sm">
          {shown.map(c => {
            const on = chosen.includes(c.id);
            return (
              <button key={c.id} type="button" className="cm-pick" aria-pressed={on} aria-label={c.nom}
                disabled={!on && chosen.length >= MAX} onClick={() => onToggle(c.id)}>
                <MiniCarte c={c} qty={c.quantite} flag={flag?.(c)} small />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Trade({ t, children }) {
  return (
    <article className="ex-trade">
      <div className="ex-trade-head">
        <Avatar id={t.joueur.id} pseudo={t.joueur.pseudo} size={32} />
        <Link href={`/jeu/profil?id=${encodeURIComponent(t.joueur.id)}`}><b>{t.joueur.pseudo}</b></Link>
        {t.statut !== "pending" && <span className={`ex-status ${t.statut}`}>{STATUS[t.statut]}</span>}
        <span className="sx-muted">{ago(t.resolu_le || t.cree_le)}</span>
      </div>
      <div className="ex-trade-cards">
        <div aria-label="Tu donnes">{t.je_donne.map(c => <MiniCarte key={c.id} c={c} qty={c.quantite} small />)}</div>
        <i className="ph ph-arrows-left-right" aria-hidden="true" />
        <div aria-label="Tu reçois">{t.je_recois.map(c => <MiniCarte key={c.id} c={c} qty={c.quantite} small />)}</div>
      </div>
      {children && <div className="ex-trade-actions">{children}</div>}
    </article>
  );
}

export default function EchangesPage() {
  const [trades, setTrades] = useState(null);
  const [friends, setFriends] = useState(null);
  const [mine, setMine] = useState([]);
  const [friend, setFriend] = useState("");
  const [theirs, setTheirs] = useState([]);
  const [give, setGive] = useState([]);
  const [ask, setAsk] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("recus");

  const load = useCallback(() => {
    api.echanges().then(setTrades).catch(e => setMsg({ err: true, text: e.message }));
    api.collection().then(cs => setMine([...cs].sort((a, b) => (b.quantite > 1) - (a.quantite > 1) || b.quantite - a.quantite))).catch(() => {});
  }, []);
  useEffect(() => {
    load();
    api.amis().then(d => {
      setFriends(d.amis);
      const wanted = new URLSearchParams(window.location.search).get("avec");
      if (wanted && d.amis.some(a => a.id === wanted)) setFriend(wanted);
    }).catch(() => setFriends([]));
  }, [load]);
  useEffect(() => {
    setAsk([]); setTheirs([]);
    if (friend) api.collectionJoueur(friend).then(setTheirs).catch(e => setMsg({ err: true, text: e.message }));
  }, [friend]);

  const byId = useMemo(() => new Map([...mine, ...theirs].map(c => [c.id, c])), [mine, theirs]);
  const giveCards = give.map(id => mine.find(c => c.id === id)).filter(Boolean);
  const askCards = ask.map(id => theirs.find(c => c.id === id)).filter(Boolean);
  const toggle = set => id => set(l => (l.includes(id) ? l.filter(x => x !== id) : l.length < MAX ? [...l, id] : l));
  const doubles = mine.filter(c => c.quantite > 1);
  const pending = trades ? trades.recus.length : 0;

  const propose = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.proposerEchange(friend, give, ask);
      setMsg({ text: "Proposition envoyée. Ton ami la verra dans ses échanges et ses messages." });
      setGive([]); setAsk([]); setTab("envoyes"); load();
    } catch (x) { setMsg({ err: true, text: x.message }); }
    setBusy(false);
  };
  const act = (fn, ok) => async () => {
    try { await fn(); if (ok) setMsg({ text: ok }); load(); notifyBadges(); if (friend) api.collectionJoueur(friend).then(setTheirs).catch(() => {}); }
    catch (x) { setMsg({ err: true, text: x.message }); load(); }
  };

  const list = trades?.[tab] || [];
  const delta = power(askCards) - power(giveCards);

  return (
    <>
      <Topbar title="Échanges" sub={trades ? `${pending} proposition${pending > 1 ? "s" : ""} reçue${pending > 1 ? "s" : ""} · ${trades.envoyes.length} envoyée${trades.envoyes.length > 1 ? "s" : ""}` : ""} />
      <section className="sx-page">
        {msg && <p role="status" className={`cm-msg${msg.err ? " err" : ""}`}>{msg.text}</p>}
        <div className="sx-row" style={{ alignItems: "flex-start" }}>
          <section className="sx-grow sx-pane" aria-labelledby="ex-new" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="sx-head">
              <h2 id="ex-new" className="sx-lbl">Nouvel échange</h2>
              <span className="sx-muted">Jusqu'à {MAX} cartes de chaque côté</span>
            </div>
            {friends && friends.length === 0 ? (
              <p className="sx-empty">Les échanges se font entre amis. <Link href="/jeu/amis">Ajoute un ami</Link> pour commencer.</p>
            ) : (
              <>
                <label className="ex-friend">
                  <span className="sx-muted">Avec</span>
                  <select className="input" value={friend} onChange={e => setFriend(e.target.value)}>
                    <option value="">Choisis un ami…</option>
                    {(friends || []).map(a => <option key={a.id} value={a.id}>{a.pseudo}{a.en_ligne ? " · en ligne" : ""}</option>)}
                  </select>
                </label>
                <div className="ex-compose">
                  <div className="ex-side">
                    <h3 className="sx-lbl" style={{ margin: 0 }}>Tu donnes · {giveCards.length}/{MAX}</h3>
                    <Slots cards={giveCards} onRemove={toggle(setGive)} />
                    <Picker label="ta collection" cards={mine} chosen={give} onToggle={toggle(setGive)} />
                  </div>
                  <div className="ex-mid">
                    <i className="ph ph-arrows-left-right" aria-hidden="true" />
                    {(giveCards.length > 0 || askCards.length > 0) && (
                      <span className="ex-balance">{power(giveCards)} ⇄ {power(askCards)} pts<br />
                        <span style={{ color: Math.abs(delta) < 20 ? "#5ee0c0" : "#ffcf6b" }}>{Math.abs(delta) < 20 ? "équilibré" : delta > 0 ? "à ton avantage" : "à son avantage"}</span>
                      </span>
                    )}
                  </div>
                  <div className="ex-side">
                    <h3 className="sx-lbl" style={{ margin: 0 }}>Tu reçois · {askCards.length}/{MAX}</h3>
                    <Slots cards={askCards} onRemove={toggle(setAsk)} />
                    {friend
                      ? <Picker label="la collection de ton ami" cards={theirs} chosen={ask} onToggle={toggle(setAsk)} flag={c => (c.manque ? "Manque" : null)} />
                      : <p className="sx-empty">Choisis un ami pour voir sa collection.</p>}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="button" className="sx-btn" disabled={busy || !friend || !give.length || !ask.length} onClick={propose}>
                    Proposer l'échange
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="sx-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="sx-pane" aria-label="Mes échanges" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="sx-tabs" role="tablist" aria-label="Mes échanges">
                {[["recus", "Reçus"], ["envoyes", "Envoyés"], ["historique", "Historique"]].map(([id, label]) => (
                  <button key={id} type="button" role="tab" className="sx-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                    {label}{trades && id !== "historique" && trades[id].length ? ` · ${trades[id].length}` : ""}
                  </button>
                ))}
              </div>
              {trades && list.length === 0 && (
                <p className="sx-empty">{tab === "recus" ? "Aucune proposition en attente." : tab === "envoyes" ? "Aucune proposition envoyée en attente." : "Pas encore d'échange terminé."}</p>
              )}
              {list.map(t => (
                <Trade key={t.id} t={t}>
                  {tab === "recus" && (
                    <>
                      <button type="button" className="sx-btn sm" onClick={act(() => api.accepterEchange(t.id), "Échange conclu : les cartes sont dans ta collection.")}>Accepter</button>
                      <button type="button" className="sx-btn alt sm" onClick={act(() => api.refuserEchange(t.id))}>Refuser</button>
                    </>
                  )}
                  {tab === "envoyes" && <button type="button" className="sx-btn alt sm" onClick={act(() => api.annulerEchange(t.id))}>Annuler</button>}
                </Trade>
              ))}
            </section>
            <section className="sx-pane" aria-labelledby="ex-dbl" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 id="ex-dbl" className="sx-lbl">Tes doubles · {doubles.length}</h2>
              {doubles.length === 0
                ? <span className="sx-muted">Les cartes que tu possèdes en plusieurs exemplaires apparaîtront ici.</span>
                : <div className="cm-grid sm">{doubles.slice(0, 12).map(c => (
                    <button key={c.id} type="button" className="cm-pick" aria-pressed={give.includes(c.id)} aria-label={`Proposer ${c.nom}`}
                      disabled={!give.includes(c.id) && give.length >= MAX} onClick={() => toggle(setGive)(c.id)}>
                      <MiniCarte c={byId.get(c.id) || c} qty={c.quantite} small />
                    </button>))}
                  </div>}
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
