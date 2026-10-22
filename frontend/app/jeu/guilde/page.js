"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { Avatar, ago, crestColor, fr, initial, until } from "@/lib/social";

/* Onglet « Guilde ».
   Sans guilde : annuaire (recherche, rejoindre) et création. /jeu/guilde?rejoindre=ID met une guilde en avant (lien d'invitation).
   Avec guilde : bannière (niveau, effectif, rang), objectifs de la semaine et récompenses, discussion (relue toutes les 5 s),
   membres triés par contribution avec gestion des rôles (guilde relue toutes les 30 s). Styles : app/arene.css (.gd-*), app/social.css (.sx-*, .ms-*). */

const ROLE = { chef: "Chef", officier: "Officier", membre: "Membre" };
const ordinal = n => (n === 1 ? "1re" : `${n}e`);

function Crest({ g, size }) {
  return <span className="gd-crest" style={{ "--gc": crestColor(g.id), ...(size ? { width: size, height: size } : null) }} aria-hidden="true">{initial(g.nom)}</span>;
}

function Directory({ onJoined }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState(null);
  const [nom, setNom] = useState("");
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState(null);
  const [wanted, setWanted] = useState(null);
  useEffect(() => { setWanted(Number(new URLSearchParams(window.location.search).get("rejoindre")) || null); }, []);
  useEffect(() => { const t = setTimeout(() => api.guildes(q.trim()).then(setList).catch(() => setList([])), 250); return () => clearTimeout(t); }, [q]);

  const join = id => api.rejoindreGuilde(id).then(onJoined).catch(e => setMsg({ err: true, text: e.message }));
  const create = e => {
    e.preventDefault();
    api.creerGuilde(nom.trim(), desc.trim()).then(onJoined).catch(x => setMsg({ err: true, text: x.message }));
  };
  const sorted = list && wanted ? [...list].sort((a, b) => (b.id === wanted) - (a.id === wanted)) : list;

  return (
    <div className="sx-row" style={{ alignItems: "flex-start" }}>
      <section className="sx-grow" style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="gd-dir">
        <div className="sx-head">
          <h2 id="gd-dir" className="sx-lbl">Trouver une guilde</h2>
          <span className="sx-muted">Classées par points de la semaine</span>
        </div>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher une guilde par son nom" aria-label="Chercher une guilde" />
        {msg && <p role="status" className={`cm-msg${msg.err ? " err" : ""}`}>{msg.text}</p>}
        {list && list.length === 0 && <p className="sx-empty">{q ? "Aucune guilde ne porte ce nom." : "Aucune guilde pour l'instant : fonde la première !"}</p>}
        <div className="gd-list">
          {sorted?.map(g => {
            const full = g.membres >= 30;
            return (
              <article key={g.id} className={`gd-row${g.id === wanted ? " hl" : ""}`}>
                <Crest g={g} />
                <div>
                  <b>{g.nom}{g.id === wanted ? " · tu es invité" : ""}</b>
                  <span>Niveau {g.niveau} · {g.membres}/30 membres · {ordinal(g.rang)} · {fr(g.points_semaine)} pts cette semaine</span>
                  {g.description && <span>{g.description}</span>}
                </div>
                <button type="button" className="sx-btn sm" disabled={!g.recrutement || full} onClick={() => join(g.id)}>
                  {full ? "Complète" : g.recrutement ? "Rejoindre" : "Sur invitation"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <aside className="sx-side sx-pane" aria-labelledby="gd-new">
        <form className="gd-form" onSubmit={create}>
          <h2 id="gd-new" className="sx-lbl">Fonder une guilde</h2>
          <label>Nom<input className="input" value={nom} onChange={e => setNom(e.target.value)} minLength={3} maxLength={30} required placeholder="Les Veilleurs d'Orion" /></label>
          <label>Présentation<textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} maxLength={280} placeholder="Ce qui réunit ta guilde (facultatif)" /></label>
          <button type="submit" className="sx-btn">Fonder la guilde</button>
          <span className="sx-muted">Tu en deviens le chef. Jusqu'à 30 membres ; les objectifs de la semaine rapportent des éclats à chacun.</span>
        </form>
      </aside>
    </div>
  );
}

function Settings({ g, onSaved, onClose }) {
  const [desc, setDesc] = useState(g.description);
  const [rec, setRec] = useState(g.recrutement);
  const [err, setErr] = useState(null);
  const chef = g.mon_role === "chef";
  const save = e => { e.preventDefault(); api.majGuilde({ description: desc, recrutement: rec }).then(x => { onSaved(x); onClose(); }).catch(x => setErr(x.message)); };
  const leave = () => api.quitterGuilde().then(() => { onSaved(null); onClose(); }).catch(x => setErr(x.message));
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <form className="sx-modal gd-form" role="dialog" aria-modal="true" aria-labelledby="gd-set" onClick={e => e.stopPropagation()} onSubmit={save} style={{ width: "min(520px, 100%)" }}>
        <h2 id="gd-set">Paramètres de la guilde</h2>
        {chef ? (
          <>
            <label>Présentation<textarea className="input" value={desc} onChange={e => setDesc(e.target.value)} maxLength={280} /></label>
            <label className="gd-switch"><input type="checkbox" checked={rec} onChange={e => setRec(e.target.checked)} />Recrutement ouvert (tout joueur peut rejoindre)</label>
          </>
        ) : <span className="sx-muted">Seul le chef peut modifier la présentation et le recrutement.</span>}
        {err && <p className="cm-msg err">{err}</p>}
        <div className="sx-modal-foot" style={{ justifyContent: "space-between" }}>
          <button type="button" className="sx-btn danger" onClick={leave}>Quitter la guilde</button>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="sx-btn alt" onClick={onClose}>Fermer</button>
            {chef && <button type="submit" className="sx-btn">Enregistrer</button>}
          </span>
        </div>
        {chef && g.membres > 1 && <span className="sx-muted">Si tu pars, l'officier (ou le membre) le plus ancien devient chef.</span>}
      </form>
    </div>
  );
}

function Invite({ onClose }) {
  const [friends, setFriends] = useState(null);
  const [done, setDone] = useState({});
  useEffect(() => { api.amis().then(d => setFriends(d.amis)).catch(() => setFriends([])); }, []);
  const invite = id => api.inviterGuilde(id).then(() => setDone(d => ({ ...d, [id]: "Invité" }))).catch(e => setDone(d => ({ ...d, [id]: e.message })));
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <div className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="gd-inv" onClick={e => e.stopPropagation()} style={{ width: "min(520px, 100%)" }}>
        <h2 id="gd-inv">Inviter un ami</h2>
        <div className="sx-modal-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {friends && friends.length === 0 && <p className="sx-empty">Pas encore d'ami. <Link href="/jeu/amis">Ajoute des amis</Link> pour les inviter.</p>}
          {friends?.map(f => (
            <div key={f.id} className="gd-member">
              <Avatar id={f.id} pseudo={f.pseudo} size={34} />
              <div><b>{f.pseudo}</b><span className="gd-role">{done[f.id] && done[f.id] !== "Invité" ? done[f.id] : f.en_ligne ? "En ligne" : `Vu ${ago(f.vu_le)}`}</span></div>
              <button type="button" className="sx-btn sm" disabled={!!done[f.id]} onClick={() => invite(f.id)}>{done[f.id] === "Invité" ? "Invité" : "Inviter"}</button>
            </div>
          ))}
        </div>
        <span className="sx-muted">L'invitation part en message privé, avec un lien pour rejoindre.</span>
        <div className="sx-modal-foot"><button type="button" className="sx-btn alt" onClick={onClose}>Fermer</button></div>
      </div>
    </div>
  );
}

function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const box = useRef(null);
  const last = useRef(0);
  const pull = useCallback(() => api.messagesGuilde(last.current).then(n => {
    if (!n.length) return;
    last.current = n[n.length - 1].id;
    setMsgs(m => [...m, ...n.filter(x => !m.some(y => y.id === x.id))].slice(-200));
  }).catch(() => {}), []);
  useEffect(() => { pull(); const t = setInterval(pull, 5000); return () => clearInterval(t); }, [pull]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs.length]);
  const send = e => {
    e.preventDefault();
    if (!text.trim()) return;
    api.ecrireGuilde(text.trim()).then(() => { setText(""); pull(); }).catch(() => {});
  };
  return (
    <section className="sx-pane gd-chat" aria-labelledby="gd-chat" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 id="gd-chat" className="sx-lbl">Discussion de guilde</h2>
      <div className="ms-msgs" ref={box} aria-live="polite">
        {msgs.length === 0 && <span className="sx-muted">Aucun message. Lance la conversation !</span>}
        {msgs.map((m, i) => {
          if (m.systeme) return <span key={m.id} className="gd-sys">{m.texte}</span>;
          const head = !m.de_moi && (i === 0 || msgs[i - 1].auteur_id !== m.auteur_id);
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {head && <span className="gd-author">{m.auteur} · {ago(m.le)}</span>}
              <div className={m.de_moi ? "ms-me" : "ms-them"}>{m.texte}</div>
            </div>
          );
        })}
      </div>
      <form className="ms-form" onSubmit={send}>
        <label htmlFor="gd-text" style={{ position: "absolute", left: -9999 }}>Message à la guilde</label>
        <input id="gd-text" className="input" value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder="Message à la guilde" />
        <button type="submit" className="sx-btn" disabled={!text.trim()}>Envoyer</button>
      </form>
    </section>
  );
}

function MyGuild({ g, setG }) {
  const [dialog, setDialog] = useState(null);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState(null);
  const act = p => p.then(x => { if (x && x.id) setG(x); }).catch(e => setMsg({ err: true, text: e.message }));
  const claim = o => api.recompenseObjectif(o.id)
    .then(r => { setMsg({ text: `+${r.gain} éclats récupérés.` }); return api.maGuilde().then(d => setG(d.guilde)); })
    .catch(e => setMsg({ err: true, text: e.message }));
  const me = g.mon_role;
  const members = all ? g.membres_liste : g.membres_liste.slice(0, 8);

  return (
    <>
      <section className="gd-banner" style={{ "--gc": crestColor(g.id) }} aria-label="Ta guilde">
        <Crest g={g} />
        <div className="gd-id">
          <span className="sx-lbl">Guilde · niveau {g.niveau}</span>
          <h2>{g.nom}</h2>
          <span className="sx-muted">{g.membres} / {g.max_membres} membres · {ordinal(g.rang)} au classement des guildes · {g.recrutement ? "Recrutement ouvert" : "Sur invitation"}</span>
          {g.description && <p>{g.description}</p>}
        </div>
        <div className="gd-actions">
          <button type="button" className="sx-btn" onClick={() => setDialog("invite")}><i className="ph ph-user-plus" aria-hidden="true" />Inviter un ami</button>
          <button type="button" className="sx-btn alt" onClick={() => setDialog("settings")}><i className="ph ph-gear" aria-hidden="true" />Paramètres</button>
        </div>
      </section>
      {msg && <p role="status" className={`cm-msg${msg.err ? " err" : ""}`}>{msg.text}</p>}

      <div className="sx-row" style={{ alignItems: "flex-start" }}>
        <div className="sx-grow" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="sx-pane" aria-labelledby="gd-obj" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="sx-head">
              <h2 id="gd-obj" className="sx-lbl">Objectifs de la semaine</h2>
              <span className="sx-muted">Fin dans {until(g.fin_semaine)}</span>
            </div>
            {g.objectifs.map(o => (
              <div key={o.id} className="gd-obj">
                <div><b>{o.nom}</b><span className="sx-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{fr(o.valeur)} / {fr(o.cible)}</span></div>
                <div className="sx-bar" role="progressbar" aria-valuemin={0} aria-valuemax={o.cible} aria-valuenow={o.valeur} aria-label={o.nom}>
                  <i style={{ width: `${(100 * o.valeur) / o.cible}%`, "--bc": o.atteint ? "#5ee0c0" : undefined }} />
                </div>
                <div>
                  <span className="sx-muted">Récompense : {o.recompense} éclats pour chaque membre</span>
                  {o.atteint && (o.recuperee
                    ? <span className="sx-muted" style={{ color: "#5ee0c0" }}>Récupérée</span>
                    : <button type="button" className="sx-btn sm" onClick={() => claim(o)}>Récupérer</button>)}
                </div>
              </div>
            ))}
            <span className="sx-muted">Tout le monde contribue : boosters ouverts, nouvelles Ultra rares et Légendaires, batailles gagnées.</span>
          </section>
          <Chat />
        </div>

        <aside className="sx-side sx-pane" aria-labelledby="gd-mem" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="sx-head">
            <h2 id="gd-mem" className="sx-lbl">Membres</h2>
            <span className="sx-muted">Trié par contribution</span>
          </div>
          {members.map(m => (
            <div key={m.id} className={`gd-member${m.moi ? " me" : ""}`}>
              <Avatar id={m.id} pseudo={m.pseudo} size={36} style={m.en_ligne ? { boxShadow: "0 0 0 2px #5ee0c0" } : undefined} />
              <div>
                <Link href={`/jeu/profil?id=${encodeURIComponent(m.id)}`}>{m.pseudo}{m.moi ? " (toi)" : ""}</Link>
                <span className={`gd-role ${m.role}`}>{ROLE[m.role]}</span>
              </div>
              <span className="gd-pts">{fr(m.points)} pts</span>
              {!m.moi && (me === "chef" || (me === "officier" && m.role === "membre")) && (
                <span className="gd-menu">
                  {me === "chef" && m.role === "membre" && <button type="button" className="sx-btn alt sm" onClick={() => act(api.roleMembre(m.id, "officier"))} title="Nommer officier">Promouvoir</button>}
                  {me === "chef" && m.role === "officier" && <button type="button" className="sx-btn alt sm" onClick={() => act(api.roleMembre(m.id, "chef"))} title="Lui confier la guilde">Chef</button>}
                  {me === "chef" && m.role === "officier" && <button type="button" className="sx-btn alt sm" onClick={() => act(api.roleMembre(m.id, "membre"))}>Rétrograder</button>}
                  <button type="button" className="sx-btn danger sm" onClick={() => act(api.exclureMembre(m.id))} aria-label={`Exclure ${m.pseudo}`}>Exclure</button>
                </span>
              )}
            </div>
          ))}
          {g.membres_liste.length > 8 && (
            <button type="button" className="sx-btn alt sm" onClick={() => setAll(v => !v)}>{all ? "Réduire" : `Voir les ${g.membres_liste.length} membres`}</button>
          )}
        </aside>
      </div>
      {dialog === "settings" && <Settings g={g} onSaved={setG} onClose={() => setDialog(null)} />}
      {dialog === "invite" && <Invite onClose={() => setDialog(null)} />}
    </>
  );
}

export default function GuildePage() {
  const [g, setG] = useState(undefined);
  const [error, setError] = useState(null);
  useEffect(() => {
    const load = () => api.maGuilde().then(d => setG(d.guilde)).catch(e => setError(e.message));
    load();
    const t = setInterval(() => { if (!document.hidden) api.maGuilde().then(d => setG(x => (x === null && d.guilde === null ? x : d.guilde))).catch(() => {}); }, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <Topbar title="Guilde" sub={g ? `${g.nom} · ${g.membres} membre${g.membres > 1 ? "s" : ""}` : g === null ? "Rejoins ou fonde une guilde" : ""} />
      <section className="sx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        {g === null && <Directory onJoined={setG} />}
        {g && <MyGuild g={g} setG={setG} />}
      </section>
    </>
  );
}
