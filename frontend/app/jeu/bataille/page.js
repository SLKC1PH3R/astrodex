"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import MiniCarte from "@/components/MiniCarte";
import { api } from "@/lib/api";
import { ago, fr, until } from "@/lib/social";
import { prefersReduced } from "@/lib/motion";

/* Onglet « Bataille » : composer sa main de 5 cartes, choisir un mode (rapide, classée, défi d'un ami),
   jouer et voir les manches se dérouler une à une, rang et historique.
   La partie est résolue par le serveur (voir backend/app/battle.py). Styles : app/arene.css (.bt-*). */

const MODES = [
  { id: "rapide", icon: "ph-lightning", nom: "Partie rapide", desc: () => "Un adversaire de ton niveau, sans enjeu de rang." },
  { id: "classee", icon: "ph-trophy", nom: "Classée", desc: d => `Gagne des points de rang. Saison en cours : fin dans ${until(d.saison_fin)}.` },
  { id: "ami", icon: "ph-sword", nom: "Défier un ami", desc: () => "Affronte la main enregistrée d'un ami ; il reçoit le résultat par message." },
];
const STATS = [["attaque", "Attaque"], ["defense", "Défense"], ["vitesse", "Vitesse"], ["puissance", "Puissance"]];
const sum = (cards, k) => cards.reduce((s, c) => s + (c[k] || 0), 0);
const resultOf = h => (h.victoire ? "win" : h.score[0] === h.score[1] ? "draw" : "loss");
const RESULT = { win: "Victoire", loss: "Défaite", draw: "Égalité" };

function HandPicker({ hand, onSave, onClose }) {
  const [coll, setColl] = useState(null);
  const [chosen, setChosen] = useState(hand.map(c => c.id));
  const [q, setQ] = useState("");
  const [err, setErr] = useState(null);
  useEffect(() => { api.collection().then(cs => setColl([...cs].sort((a, b) => b.puissance - a.puissance))).catch(() => setColl([])); }, []);
  const toggle = id => setChosen(l => (l.includes(id) ? l.filter(x => x !== id) : l.length < 5 ? [...l, id] : l));
  const save = () => api.mainBataille(chosen).then(r => { onSave(r.main); onClose(); }).catch(e => setErr(e.message));
  const shown = (coll || []).filter(c => !q || c.nom.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <div className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="bt-pick" onClick={e => e.stopPropagation()}>
        <h2 id="bt-pick">Compose ta main · {chosen.length}/5</h2>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher une carte" aria-label="Chercher une carte" />
        <div className="sx-modal-body">
          {coll && coll.length === 0 && <p className="sx-empty">Ta collection est vide : ouvre un booster d'abord.</p>}
          <div className="cm-grid">
            {shown.map(c => {
              const k = chosen.indexOf(c.id);
              return (
                <button key={c.id} type="button" className="cm-pick sx-pick" aria-pressed={k >= 0} aria-label={c.nom}
                  disabled={k < 0 && chosen.length >= 5} onClick={() => toggle(c.id)}>
                  {k >= 0 && <span className="sx-n">{k + 1}</span>}
                  <MiniCarte c={c} />
                </button>
              );
            })}
          </div>
        </div>
        {err && <p className="cm-msg err">{err}</p>}
        <div className="sx-modal-foot">
          <span className="sx-muted" style={{ marginRight: "auto", alignSelf: "center" }}>L'ordre compte : la 1re carte joue la 1re manche.</span>
          <button type="button" className="sx-btn alt" onClick={onClose}>Annuler</button>
          <button type="button" className="sx-btn" onClick={save}>Enregistrer la main</button>
        </div>
      </div>
    </div>
  );
}

function Arena({ r, onAgain, onBack }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduced = prefersReduced();
    if (reduced) { setShown(r.manches.length); return; }
    setShown(0);
    const t = setInterval(() => setShown(n => { if (n >= r.manches.length) { clearInterval(t); return n; } return n + 1; }), 900);
    return () => clearInterval(t);
  }, [r]);
  const mine = Object.fromEntries(r.main.map(c => [c.id, c]));
  const theirs = Object.fromEntries(r.adversaire.main.map(c => [c.id, c]));
  const partial = r.manches.slice(0, shown).reduce((s, m) => ({ ...s, [m.gagnant]: (s[m.gagnant] || 0) + 1 }), {});
  const done = shown >= r.manches.length;
  const verdict = r.victoire ? "win" : r.egalite ? "draw" : "loss";
  const label = side => (side === "moi" ? "Ta carte" : r.adversaire.nom);

  return (
    <section className="sx-pane bt-arena" aria-label="Déroulé de la bataille">
      <div className="bt-score" aria-live="polite">
        <span style={{ textAlign: "right" }}>Toi</span>{partial.moi || 0} – {partial.eux || 0}<span>{r.adversaire.nom}</span>
      </div>
      {r.manches.slice(0, shown).map((m, i) => (
        <div key={i} className="bt-round">
          <div className={m.gagnant === "moi" ? "won" : m.gagnant ? "lost" : ""}><MiniCarte c={mine[m.moi]} /></div>
          <div className="bt-log">
            <b>Manche {i + 1} · {m.gagnant === "moi" ? "gagnée" : m.gagnant === "eux" ? "perdue" : "égalité"}</b>
            {m.coups.map((c, k) => (
              <span key={k}>{label(c.attaquant)} attaque : {c.attaque} contre {c.defense} de défense {c.attaque > c.defense ? "· percée !" : "· bloquée"}</span>
            ))}
            {m.raison === "plus puissante" && <span>Aucune ne perce : la plus puissante l'emporte.</span>}
          </div>
          <div className={m.gagnant === "eux" ? "won" : m.gagnant ? "lost" : ""}><MiniCarte c={theirs[m.eux]} /></div>
        </div>
      ))}
      {done && (
        <>
          <div className={`bt-verdict bt-res ${verdict}`}>{RESULT[verdict]} {r.score.moi}–{r.score.eux}</div>
          {r.mode === "classee" && <p className="sx-muted" style={{ textAlign: "center", margin: 0 }}>{r.points > 0 ? "+" : ""}{r.points} point{Math.abs(r.points) > 1 ? "s" : ""} de rang · {r.rang.nom} ({fr(r.rang.points)} pts)</p>}
          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="sx-btn" onClick={onAgain}>Rejouer</button>
            <button type="button" className="sx-btn alt" onClick={onBack}>Retour</button>
          </div>
        </>
      )}
    </section>
  );
}

export default function BataillePage() {
  const [d, setD] = useState(null);
  const [mode, setMode] = useState("rapide");
  const [friends, setFriends] = useState([]);
  const [ami, setAmi] = useState("");
  const [picking, setPicking] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [allHist, setAllHist] = useState(null);

  const load = () => api.bataille().then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); api.amis().then(x => setFriends(x.amis)).catch(() => {}); }, []);

  const fight = async () => {
    setBusy(true); setErr(null);
    try { setResult(await api.combattre(mode, mode === "ami" ? ami : undefined)); load(); setAllHist(null); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const hand = d?.main || [];
  const hist = allHist || d?.historique || [];
  const ready = hand.length === 5 && (mode !== "ami" || ami);

  return (
    <>
      <Topbar title="Bataille" sub="Compose une main de 5 cartes et affronte un autre joueur" />
      <section className="sx-page">
        {d && (
          <div className="bt-head">
            <span className="bt-chip"><i className="ph-fill ph-shield-star" aria-hidden="true" style={{ color: "#ffcf6b" }} />Rang <b>{d.rang.nom}</b> · {fr(d.rang.points)} pts</span>
            <span className="bt-chip">Victoires <b>{fr(d.stats.victoires)}</b></span>
            <span className="bt-chip">Parties <b>{fr(d.stats.parties)}</b></span>
            {d.rang.prochain && <span className="sx-muted">Encore {fr(d.rang.prochain_seuil - d.rang.points)} pts pour {d.rang.prochain}</span>}
          </div>
        )}
        {err && <p role="alert" className="cm-msg err">{err}</p>}

        {result ? (
          <Arena r={result} onAgain={() => { setResult(null); fight(); }} onBack={() => setResult(null)} />
        ) : (
          <div className="sx-row" style={{ alignItems: "flex-start" }}>
            <div className="sx-grow" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <section className="sx-pane" aria-labelledby="bt-main" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="sx-head">
                  <h2 id="bt-main" className="sx-lbl">Ta main · {hand.length} / 5 cartes</h2>
                  <button type="button" className="sx-btn alt sm" onClick={() => setPicking(true)}>Modifier la main</button>
                </div>
                <div className="bt-hand">
                  {Array.from({ length: 5 }, (_, i) => hand[i]
                    ? <button key={hand[i].id} type="button" className="cm-pick" onClick={() => setPicking(true)} aria-label={`${hand[i].nom}, modifier la main`}><MiniCarte c={hand[i]} /></button>
                    : <button key={i} type="button" className="bt-slot" onClick={() => setPicking(true)} aria-label="Ajouter une carte">+</button>)}
                </div>
                <div className="bt-totals">
                  {STATS.map(([k, l]) => <div key={k}><b>{fr(sum(hand, k))}</b><span>{l}</span></div>)}
                </div>
                <span className="sx-muted">Chaque manche, la carte la plus rapide attaque en premier ; son Attaque se mesure à la Défense adverse. Trois manches gagnées emportent la partie.</span>
              </section>

              <section className="sx-pane" aria-labelledby="bt-mode" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h2 id="bt-mode" className="sx-lbl">Choisis un mode</h2>
                <div className="bt-modes">
                  {d && MODES.map(m => (
                    <button key={m.id} type="button" className="bt-mode" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
                      <i className={`ph ${m.icon}`} aria-hidden="true" />
                      <span><b>{m.nom}</b><span>{m.desc(d)}</span></span>
                    </button>
                  ))}
                </div>
                {mode === "ami" && (
                  friends.length === 0
                    ? <span className="sx-muted">Ajoute des amis pour les défier.</span>
                    : <select className="input" value={ami} onChange={e => setAmi(e.target.value)} aria-label="Ami à défier">
                        <option value="">Choisis un ami…</option>
                        {friends.map(f => <option key={f.id} value={f.id}>{f.pseudo}{f.en_ligne ? " · en ligne" : ""}</option>)}
                      </select>
                )}
                <button type="button" className="sx-btn" disabled={!ready || busy} onClick={fight} style={{ alignSelf: "flex-end" }}>
                  <i className="ph ph-sword" aria-hidden="true" />{hand.length < 5 ? "Compose ta main d'abord" : "Lancer la bataille"}
                </button>
              </section>
            </div>

            <aside className="sx-side sx-pane" aria-labelledby="bt-hist" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 id="bt-hist" className="sx-lbl" style={{ marginBottom: 6 }}>Dernières batailles</h2>
              {d && hist.length === 0 && <span className="sx-muted">Aucune bataille pour l'instant.</span>}
              {hist.map(h => {
                const res = resultOf(h);
                return (
                  <div key={h.id} className="bt-hist">
                    <span>contre <b>{h.adversaire.nom}</b><br /><span className="sx-muted">{MODES.find(m => m.id === h.mode)?.nom} · {ago(h.le)}{h.points ? ` · ${h.points > 0 ? "+" : ""}${h.points} pts` : ""}</span></span>
                    <span className={`bt-res ${res}`}>{RESULT[res]} {h.score[0]}–{h.score[1]}</span>
                  </div>
                );
              })}
              {d && d.historique.length >= 10 && !allHist && (
                <button type="button" className="sx-btn alt sm" onClick={() => api.historiqueBatailles().then(setAllHist).catch(() => {})}>Voir tout l'historique</button>
              )}
            </aside>
          </div>
        )}
      </section>
      {picking && <HandPicker hand={hand} onSave={main => setD(x => ({ ...x, main }))} onClose={() => setPicking(false)} />}
    </>
  );
}
