"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import { usePlayer } from "@/components/PlayerProvider";
import { api, currentKey, deleteAccount, loginWithKey, logout, rotateKey } from "@/lib/api";
import { getMotion, setMotion } from "@/lib/motion";

/* Onglet « Paramètres » : compte (pseudo, code ami), clé de connexion (afficher, copier, se connecter avec
   une autre clé, en générer une nouvelle), confidentialité, animations, déconnexion et suppression du compte.
   Styles : app/arene.css (.st-*), app/social.css (.sx-*). */

const MOTIONS = [["systeme", "Comme l'appareil"], ["reduit", "Réduites"], ["complet", "Complètes"]];

function Section({ id, title, children, danger }) {
  return (
    <section className={`sx-pane st-sec${danger ? " danger" : ""}`} aria-labelledby={id}>
      <h2 id={id} className="sx-lbl">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({ on, onChange, label, desc }) {
  return (
    <label className="st-toggle">
      <span><b>{label}</b>{desc && <small>{desc}</small>}</span>
      <input type="checkbox" role="switch" checked={on} onChange={e => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function DeleteDialog({ pseudo, onClose }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [err, setErr] = useState(null);
  const word = pseudo || "SUPPRIMER";
  const go = e => {
    e.preventDefault();
    deleteAccount(text).then(() => router.push("/")).catch(x => setErr(x.message));
  };
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <form className="sx-modal pf-form" role="alertdialog" aria-modal="true" aria-labelledby="st-del" onClick={e => e.stopPropagation()} onSubmit={go} style={{ width: "min(480px, 100%)" }}>
        <h2 id="st-del">Supprimer ton compte ?</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-neutral-300)" }}>
          Ta collection, tes éclats, tes amis, tes messages, tes annonces et ton historique de batailles seront effacés définitivement.
          Si tu es chef de guilde, la guilde passe à l'officier ou au membre le plus ancien.
        </p>
        <label>Pour confirmer, tape « {word} »
          <input className="input" value={text} onChange={e => setText(e.target.value)} autoComplete="off" autoFocus />
        </label>
        {err && <p className="cm-msg err">{err}</p>}
        <div className="sx-modal-foot">
          <button type="button" className="sx-btn alt" onClick={onClose}>Annuler</button>
          <button type="submit" className="sx-btn danger" disabled={text.trim().toLowerCase() !== word.toLowerCase()}>Supprimer définitivement</button>
        </div>
      </form>
    </div>
  );
}

export default function ParametresPage() {
  const router = useRouter();
  const { refresh } = usePlayer();
  const [s, setS] = useState(null);
  const [pseudo, setPseudo] = useState("");
  const [key, setKey] = useState("");
  const [shown, setShown] = useState(false);
  const [other, setOther] = useState("");
  const [motion, setMotionState] = useState("systeme");
  const [msg, setMsg] = useState(null);
  const [del, setDel] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [pwd, setPwd] = useState({ actuel: "", nouveau: "" });

  const load = () => api.parametres().then(x => { setS(x); setPseudo(x.pseudo || ""); setKey(currentKey()); }).catch(e => setMsg({ err: true, text: e.message }));
  useEffect(() => { load(); setMotionState(getMotion()); }, []);

  const say = (text, err = false) => setMsg({ text, err });
  const copy = async (value, what) => {
    try { await navigator.clipboard.writeText(value); say(`${what} copié${what === "Code ami" ? "" : "e"}.`); } catch { say("Copie impossible : sélectionne le texte à la main.", true); }
  };
  const savePseudo = e => {
    e.preventDefault();
    api.majProfil({ pseudo }).then(() => { say("Pseudo enregistré."); refresh(); load(); }).catch(x => say(x.message, true));
  };
  const toggle = (id, on) => api.majParametres({ [id]: on }).then(setS).catch(x => say(x.message, true));
  const login = e => {
    e.preventDefault();
    loginWithKey(other).then(me => { say(`Connecté au compte ${me.pseudo || "Joueur"}.`); setOther(""); refresh(); load(); }).catch(x => say(x.message, true));
  };
  const rotate = () => rotateKey().then(k => { setKey(k); setShown(true); setConfirmRotate(false); say("Nouvelle clé créée : note-la, l'ancienne ne fonctionne plus."); }).catch(x => say(x.message, true));
  const changePwd = e => {
    e.preventDefault();
    api.changerMotDePasse(pwd.actuel, pwd.nouveau)
      .then(() => { setPwd({ actuel: "", nouveau: "" }); say("Mot de passe changé. Tes autres appareils ont été déconnectés."); })
      .catch(x => say(x.message, true));
  };
  const chooseMotion = v => { setMotion(v); setMotionState(v); };

  return (
    <>
      <Topbar title="Paramètres" sub="Compte, confidentialité et affichage" />
      <section className="sx-page st-page">
        {msg && <p role="status" className={`cm-msg${msg.err ? " err" : ""}`}>{msg.text}</p>}

        <Section id="st-account" title="Compte">
          <form className="st-line" onSubmit={savePseudo}>
            <label htmlFor="st-pseudo"><b>Pseudo</b><small>Visible par les autres joueurs</small></label>
            <div className="st-field">
              <input id="st-pseudo" className="input" value={pseudo} onChange={e => setPseudo(e.target.value)} minLength={2} maxLength={24} />
              <button type="submit" className="sx-btn sm" disabled={!s || pseudo.trim() === (s.pseudo || "") || pseudo.trim().length < 2}>Enregistrer</button>
            </div>
          </form>
          <div className="st-line">
            <span><b>E-mail</b><small>{s?.email ? "Sert à te connecter sur n'importe quel appareil" : "Profil invité : il n'existe que sur ce navigateur"}</small></span>
            {s?.email
              ? <div className="st-field"><code>{s.email}</code></div>
              : <Link className="sx-btn sm" href="/inscription">Créer mon compte</Link>}
          </div>
          <div className="st-line">
            <span><b>Code ami</b><small>À partager pour qu'on t'ajoute</small></span>
            <div className="st-field"><code>{s?.code_ami || "…"}</code><button type="button" className="sx-btn alt sm" onClick={() => copy(s.code_ami, "Code ami")} disabled={!s}>Copier</button></div>
          </div>
          {s && <span className="sx-muted">Joueur depuis le {new Date(s.inscrit_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</span>}
        </Section>

        {s?.email && (
          <Section id="st-pwd" title="Mot de passe">
            <form className="st-pwd" onSubmit={changePwd}>
              <label>Mot de passe actuel<input className="input" type="password" autoComplete="current-password" required value={pwd.actuel} onChange={e => setPwd(p => ({ ...p, actuel: e.target.value }))} /></label>
              <label>Nouveau mot de passe<input className="input" type="password" autoComplete="new-password" minLength={8} required value={pwd.nouveau} onChange={e => setPwd(p => ({ ...p, nouveau: e.target.value }))} /></label>
              <button type="submit" className="sx-btn sm">Changer</button>
            </form>
            <span className="sx-muted">Les autres appareils connectés à ton compte seront déconnectés.</span>
          </Section>
        )}

        <Section id="st-key" title="Clé de connexion de cet appareil">
          <p className="st-note">{s?.email
            ? "Avec ton e-mail, tu n'en as normalement pas besoin : connecte-toi simplement avec ton e-mail et ton mot de passe. Cette clé sert de secours. Ne la partage avec personne."
            : "Ton profil invité est lié à cette clé, enregistrée dans ce navigateur. Crée plutôt un compte avec ton e-mail pour retrouver ta collection partout. Ne la partage avec personne."}</p>
          <div className="st-key">
            <code aria-label="Clé de connexion">{key ? (shown ? key : `${key.slice(0, 4)}${"•".repeat(24)}`) : "…"}</code>
            <button type="button" className="sx-btn alt sm" onClick={() => setShown(v => !v)} disabled={!key}>{shown ? "Masquer" : "Afficher"}</button>
            <button type="button" className="sx-btn alt sm" onClick={() => copy(key, "Clé")} disabled={!key}>Copier</button>
          </div>
          <form className="st-line" onSubmit={login}>
            <label htmlFor="st-other"><b>Utiliser une autre clé</b><small>Bascule ce navigateur sur un autre compte</small></label>
            <div className="st-field">
              <input id="st-other" className="input" value={other} onChange={e => setOther(e.target.value)} placeholder="Colle ta clé" autoComplete="off" spellCheck={false} />
              <button type="submit" className="sx-btn sm" disabled={other.trim().length < 20}>Se connecter</button>
            </div>
          </form>
          <div className="st-line">
            <span><b>Nouvelle clé</b><small>Si tu penses que ta clé a fuité : l'ancienne cessera de fonctionner sur tous tes appareils</small></span>
            {confirmRotate
              ? <div className="st-field"><button type="button" className="sx-btn sm" onClick={rotate}>Confirmer</button><button type="button" className="sx-btn alt sm" onClick={() => setConfirmRotate(false)}>Annuler</button></div>
              : <button type="button" className="sx-btn alt sm" onClick={() => setConfirmRotate(true)}>Générer</button>}
          </div>
        </Section>

        <Section id="st-privacy" title="Confidentialité">
          {s?.confidentialite.map(p => <Toggle key={p.id} on={p.actif} label={p.libelle} onChange={on => toggle(p.id, on)} />)}
          <span className="sx-muted">Tes amis voient toujours ton profil. Seuls tes amis peuvent t'écrire ou te proposer un échange.</span>
        </Section>

        <Section id="st-display" title="Affichage">
          <div className="st-line">
            <span><b>Animations</b><small>Ouverture des boosters, cartes holographiques, ciel étoilé… Réglage propre à cet appareil.</small></span>
            <div className="sx-tabs" role="radiogroup" aria-label="Animations">
              {MOTIONS.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={motion === v} aria-pressed={motion === v} className="sx-tab" onClick={() => chooseMotion(v)}>{l}</button>)}
            </div>
          </div>
        </Section>

        <Section id="st-danger" title="Session et compte" danger>
          <div className="st-line">
            <span><b>Se déconnecter</b><small>{s?.email ? "Tu pourras te reconnecter avec ton e-mail, ici ou ailleurs" : "Profil invité : sans compte ni clé, tu ne pourras plus revenir sur ce profil"}</small></span>
            <button type="button" className="sx-btn alt sm" onClick={() => { logout(); router.push("/"); }}>Se déconnecter</button>
          </div>
          <div className="st-line">
            <span><b>Supprimer mon compte</b><small>Efface définitivement ta collection et toutes tes données</small></span>
            <button type="button" className="sx-btn danger sm" onClick={() => setDel(true)} disabled={!s}>Supprimer…</button>
          </div>
        </Section>
      </section>
      {del && <DeleteDialog pseudo={s?.pseudo} onClose={() => setDel(false)} />}
    </>
  );
}
