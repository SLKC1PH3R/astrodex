"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { Avatar, ago, notifyBadges, Linkify } from "@/lib/social";

/* Onglet « Messages » : conversations à gauche, fil de discussion à droite, envoi entre amis.
   /jeu/messages?avec=ID ouvre directement la conversation avec ce joueur. Le fil ouvert est relu
   toutes les 5 s, la liste toutes les 15 s. Styles : app/social.css (.sx-*, .ms-*). */

export default function MessagesPage() {
  const [convs, setConvs] = useState(null);
  const [friends, setFriends] = useState([]);
  const [current, setCurrent] = useState(null); // id du joueur de la conversation ouverte
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const bottom = useRef(null);

  const loadConvs = useCallback(() => api.conversations().then(setConvs).catch(e => setError(e.message)), []);
  useEffect(() => {
    loadConvs();
    api.amis().then(d => setFriends(d.amis)).catch(() => {});
    const wanted = new URLSearchParams(window.location.search).get("avec");
    if (wanted) setCurrent(wanted);
    const t = setInterval(loadConvs, 15000);
    return () => clearInterval(t);
  }, [loadConvs]);

  // conversation ouverte : chargement puis relecture régulière
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const load = () => api.conversation(current).then(d => { if (alive) setThread(d); }).catch(e => alive && setError(e.message));
    setThread(null); load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [current]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [thread?.messages.length]);
  useEffect(() => { if (thread) { loadConvs(); notifyBadges(); } }, [thread?.joueur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async e => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !current) return;
    try {
      const m = await api.envoyerMessage(current, t);
      setThread(th => ({ ...th, messages: [...th.messages, m] }));
      setText(""); loadConvs();
    } catch (x) { setError(x.message); }
  };

  // amis sans conversation, pour en démarrer une
  const others = friends.filter(f => !(convs || []).some(c => c.id === f.id));

  return (
    <>
      <Topbar title="Messages" sub={convs ? `${convs.reduce((n, c) => n + c.non_lus, 0)} message(s) non lu(s)` : ""} />
      <section className="sx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        <div className="ms-box">
          <nav className="ms-list" aria-label="Conversations">
            {convs && convs.length === 0 && others.length === 0 && (
              <p className="sx-empty">Ajoute des amis pour pouvoir leur écrire.</p>
            )}
            {(convs || []).map(c => (
              <button key={c.id} type="button" className="ms-conv" aria-current={c.id === current || undefined} onClick={() => setCurrent(c.id)}>
                <Avatar id={c.id} pseudo={c.pseudo} size={42} />
                <div>
                  <span className="ms-top"><b style={{ fontSize: 14 }}>{c.pseudo}</b><span className="sx-muted" style={{ fontSize: 12 }}>{ago(c.le)}</span></span>
                  <span className="ms-last">{c.de_moi ? "Toi : " : ""}{c.dernier}</span>
                </div>
                {c.non_lus > 0 && <span className="ax-badge">{c.non_lus}</span>}
              </button>
            ))}
            {others.length > 0 && <span className="sx-lbl" style={{ padding: "12px 12px 4px" }}>Écrire à un ami</span>}
            {others.map(f => (
              <button key={f.id} type="button" className="ms-conv" aria-current={f.id === current || undefined} onClick={() => setCurrent(f.id)}>
                <Avatar id={f.id} pseudo={f.pseudo} size={36} />
                <div><b style={{ fontSize: 14 }}>{f.pseudo}</b><span className="ms-last">{f.en_ligne ? "En ligne" : `Vu ${ago(f.vu_le)}`}</span></div>
              </button>
            ))}
          </nav>

          <section className="ms-thread" aria-label={thread ? `Conversation avec ${thread.joueur.pseudo}` : "Conversation"}>
            {!current && <p className="sx-empty" style={{ margin: "auto 20px" }}>Choisis une conversation.</p>}
            {current && thread && (
              <>
                <div className="ms-thread-head">
                  <Avatar id={thread.joueur.id} pseudo={thread.joueur.pseudo} size={42} />
                  <div style={{ flex: 1 }}>
                    <b>{thread.joueur.pseudo}</b><br />
                    <span className="sx-muted" style={thread.joueur.en_ligne ? { color: "#5ee0c0" } : undefined}>
                      {thread.joueur.en_ligne ? "En ligne" : `Vu ${ago(thread.joueur.vu_le)}`}
                    </span>
                  </div>
                  <Link className="sx-btn alt sm" href={`/jeu/echanges?avec=${encodeURIComponent(thread.joueur.id)}`}>Proposer un échange</Link>
                  <Link className="sx-btn alt sm" href={`/jeu/profil?id=${encodeURIComponent(thread.joueur.id)}`}>Profil</Link>
                </div>
                <div className="ms-msgs" aria-live="polite">
                  {thread.messages.length === 0 && <p className="sx-muted" style={{ margin: "auto", textAlign: "center" }}>Aucun message pour l'instant. Dis bonjour !</p>}
                  {thread.messages.map((m, i) => {
                    const prev = thread.messages[i - 1];
                    const gap = !prev || new Date(m.le) - new Date(prev.le) > 30 * 60 * 1000;
                    return (
                      <div key={m.id} style={{ display: "contents" }}>
                        {gap && <span className="ms-time">{new Date(m.le).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>}
                        <div className={m.de_moi ? "ms-me" : "ms-them"}><Linkify text={m.texte} /></div>
                      </div>
                    );
                  })}
                  <span ref={bottom} />
                </div>
                {thread.amis ? (
                  <form className="ms-form" onSubmit={send}>
                    <label htmlFor="ms-text" style={{ position: "absolute", left: -9999 }}>Message</label>
                    <input id="ms-text" className="input" value={text} onChange={e => setText(e.target.value)} maxLength={1000}
                      placeholder={`Écrire à ${thread.joueur.pseudo}…`} autoComplete="off" />
                    <button type="submit" className="sx-btn" disabled={!text.trim()}>Envoyer</button>
                  </form>
                ) : (
                  <p className="sx-muted" style={{ padding: "14px 20px", margin: 0 }}>Vous n'êtes plus amis : tu ne peux plus écrire à ce joueur.</p>
                )}
              </>
            )}
          </section>
        </div>
      </section>
    </>
  );
}
