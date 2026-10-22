"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CardCarousel from "@/components/CardCarousel";
import { api, hasPlayer, login, playAsGuest, signup } from "@/lib/api";

/* Une face de la carte. login = verso (connexion), sinon recto (inscription). */
function Face({ login, active, busy, error, form, set, onSubmit, onGuest, onFlip, guest }) {
  const tab = active ? 0 : -1;
  const sfx = login ? "l" : "s";
  const [forgot, setForgot] = useState(false);
  return (
    <form className={`auth-face${login ? " back" : ""}`} onSubmit={onSubmit} aria-hidden={!active}>
      <div className="auth-face-ring" />
      <div className="auth-face-top">
        <span>{login ? "VERSO · CONNEXION" : "RECTO · INSCRIPTION"}</span>
        <span className="auth-gems"><i className={login ? "" : "on"} /><i className={login ? "on" : ""} /></span>
      </div>
      <div>
        <h2>{login ? "Bon retour" : "Crée ton compte"}</h2>
        <p className="sub">
          {login ? "Connecte-toi avec ton e-mail pour retrouver ta collection, sur n'importe quel appareil."
            : guest ? "Tu joues en invité sur cet appareil : ta collection sera rattachée à ton nouveau compte."
            : "Ta collection est sauvegardée et te suit sur tous tes appareils."}
        </p>
      </div>
      {!login && (
        <div className="field">
          <label htmlFor="pseudo">Pseudo</label>
          <input className="input" id="pseudo" placeholder="ex. orion42" autoComplete="nickname" minLength={2} maxLength={24} required
            value={form.pseudo} onChange={set("pseudo")} tabIndex={tab} />
        </div>
      )}
      <div className="field">
        <label htmlFor={`email-${sfx}`}>E-mail</label>
        <input className="input" id={`email-${sfx}`} type="email" placeholder="toi@exemple.fr" autoComplete="email" required
          value={form.email} onChange={set("email")} tabIndex={tab} />
      </div>
      <div className="field">
        <label htmlFor={`mdp-${sfx}`} className="auth-label-row">
          Mot de passe{login && <button type="button" className="auth-forgot" onClick={() => setForgot(v => !v)} tabIndex={tab}>Oublié ?</button>}
        </label>
        <input className="input" id={`mdp-${sfx}`} type="password" placeholder="8 caractères minimum" minLength={login ? undefined : 8} required
          autoComplete={login ? "current-password" : "new-password"} value={form.motDePasse} onChange={set("motDePasse")} tabIndex={tab} />
        {login && forgot && <p className="auth-hint">Contacte l'administrateur du jeu : il peut te donner un nouveau mot de passe.</p>}
      </div>
      {!login && (
        <label className="ax-check">
          <input type="checkbox" required tabIndex={tab} />
          <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
        </label>
      )}
      {active && error && <p className="ax-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={busy} tabIndex={tab}>
        {login ? "Se connecter" : guest ? "Créer mon compte et garder ma collection" : "Créer mon compte"}<i className="ph ph-arrow-right" />
      </button>
      {!guest && (
        <>
          <div className="ax-or">ou</div>
          <button className="btn btn-secondary auth-guest" type="button" disabled={busy} onClick={onGuest} tabIndex={tab}>Continuer en invité</button>
        </>
      )}
      <button className="auth-flip-link" type="button" onClick={onFlip} tabIndex={tab}>
        <i className="ph ph-arrows-clockwise" />{login ? "Pas encore de compte ? Retourne la carte" : "Déjà un compte ? Retourne la carte"}
      </button>
    </form>
  );
}

function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState(params.get("mode") === "connexion" ? "connexion" : "inscription");
  const [form, setForm] = useState({ pseudo: "", email: "", motDePasse: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [guest, setGuest] = useState(false);
  const isSignup = mode === "inscription";

  // Déjà connecté avec un compte e-mail : direction le jeu. Profil invité sur cet appareil : on reste ici
  // pour qu'il puisse créer son compte (sa collection y est rattachée) ou se connecter à un compte existant.
  useEffect(() => {
    if (!hasPlayer()) return;
    api.me().then(me => (me.email ? router.replace("/jeu") : setGuest(true))).catch(() => {});
  }, [router]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const go = async action => {
    setBusy(true); setError(null);
    try { await action(); router.push("/jeu"); }
    catch (x) { setError(/fetch|réseau|network/i.test(x.message) ? "Le serveur de jeu ne répond pas. Réessaie dans un instant." : x.message); setBusy(false); }
  };
  const submit = e => {
    e.preventDefault();
    go(() => (isSignup ? signup({ pseudo: form.pseudo.trim(), email: form.email, motDePasse: form.motDePasse })
      : login({ email: form.email, motDePasse: form.motDePasse })));
  };
  const flip = () => { setError(null); setMode(isSignup ? "connexion" : "inscription"); };
  const shared = { busy, error, form, set, guest, onSubmit: submit, onGuest: () => go(playAsGuest), onFlip: flip };

  return (
    <div className="auth-stack">
      <div className="seg" role="radiogroup" aria-label="Inscription ou connexion">
        <label className="seg-opt"><input type="radio" name="mode" checked={isSignup} onChange={() => setMode("inscription")} />Inscription</label>
        <label className="seg-opt"><input type="radio" name="mode" checked={!isSignup} onChange={() => setMode("connexion")} />Connexion</label>
      </div>
      <div className="auth-scene">
        <div className="auth-flip" data-back={isSignup ? undefined : ""}>
          <Face {...shared} login={false} active={isSignup} />
          <Face {...shared} login active={!isSignup} />
        </div>
      </div>
    </div>
  );
}

export default function InscriptionPage() {
  const [cards, setCards] = useState([]);
  useEffect(() => {
    api.series().then(list => list[0] && api.seriesDetail(list[0].code)).then(d => d && setCards(d.cartes)).catch(() => {});
  }, []);

  return (
    <div className="ax-auth">
      <div className="ax-auth-side">
        <Link className="ax-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>
        <Suspense><AuthCard /></Suspense>
        <span className="ob-credit">Images NASA, ESA/Hubble et ESO</span>
      </div>
      <div className="ax-carousel">
        {cards.length > 0 && <CardCarousel cards={cards} />}
        <div className="ax-carousel-caption">
          <b>{cards.length || ""} cartes <em>à découvrir.</em></b>
          <span>Planètes, lunes, nébuleuses, galaxies et amas — photographiés par Hubble, l'ESO et la NASA.</span>
        </div>
      </div>
    </div>
  );
}
