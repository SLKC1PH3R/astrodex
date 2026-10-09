"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CardCarousel from "@/components/CardCarousel";
import { api, ensurePlayer, signup } from "@/lib/api";

/* Une face de la carte. login = verso (connexion), sinon recto (inscription). */
function Face({ login, active, busy, error, pseudo, setPseudo, onSubmit, onGuest, onFlip }) {
  const tab = active ? 0 : -1;
  const sfx = login ? "l" : "s";
  return (
    <form className={`auth-face${login ? " back" : ""}`} onSubmit={onSubmit} aria-hidden={!active}>
      <div className="auth-face-ring" />
      <div className="auth-face-top">
        <span>{login ? "VERSO · CONNEXION" : "RECTO · INSCRIPTION"}</span>
        <span className="auth-gems"><i className={login ? "" : "on"} /><i className={login ? "on" : ""} /></span>
      </div>
      <div>
        <h2>{login ? "Bon retour" : "Crée ton compte"}</h2>
        <p className="sub">{login ? "Connecte-toi pour retrouver ta collection et tes boosters." : "Ta collection est sauvegardée et te suit sur tous tes appareils."}</p>
      </div>
      {!login && (
        <div className="field">
          <label htmlFor="pseudo">Pseudo</label>
          <input className="input" id="pseudo" placeholder="ex. orion42" autoComplete="username" maxLength={32} value={pseudo} onChange={e => setPseudo(e.target.value)} tabIndex={tab} />
        </div>
      )}
      <div className="field">
        <label htmlFor={`email-${sfx}`}>E-mail</label>
        <input className="input" id={`email-${sfx}`} type="email" placeholder="toi@exemple.fr" autoComplete="email" tabIndex={tab} />
      </div>
      <div className="field">
        <label htmlFor={`mdp-${sfx}`} className="auth-label-row">
          Mot de passe{login && <a href="#" tabIndex={tab}>Oublié ?</a>}
        </label>
        <input className="input" id={`mdp-${sfx}`} type="password" placeholder="8 caractères minimum" autoComplete={login ? "current-password" : "new-password"} tabIndex={tab} />
      </div>
      {!login && (
        <label className="ax-check">
          <input type="checkbox" required tabIndex={tab} />
          <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
        </label>
      )}
      {active && error && <p className="ax-error">{error}</p>}
      <button className="btn btn-primary btn-block auth-submit" type="submit" disabled={busy} tabIndex={tab}>
        {login ? "Se connecter" : "Créer mon compte"}<i className="ph ph-arrow-right" />
      </button>
      <div className="ax-or">ou</div>
      <button className="btn btn-secondary auth-guest" type="button" disabled={busy} onClick={onGuest} tabIndex={tab}>Continuer en invité</button>
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
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const isSignup = mode === "inscription";

  const go = async action => {
    setBusy(true); setError(null);
    try { await action(); router.push("/jeu"); }
    catch { setError("Le serveur de jeu ne répond pas. Réessaie dans un instant."); setBusy(false); }
  };
  // TODO : e-mail + mot de passe quand l'auth (Authentik / NextAuth) sera branchée côté backend.
  const submit = e => { e.preventDefault(); go(() => (isSignup ? signup(pseudo) : ensurePlayer())); };
  const flip = () => { setError(null); setMode(isSignup ? "connexion" : "inscription"); };
  const shared = { busy, error, pseudo, setPseudo, onSubmit: submit, onGuest: () => go(ensurePlayer), onFlip: flip };

  return (
    <div className="auth-stack">
      <div className="seg" role="radiogroup">
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
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>Images NASA, ESA/Hubble et ESO</span>
      </div>
      <div className="ax-carousel">
        {cards.length > 0 && <CardCarousel cards={cards} />}
        <div className="ax-carousel-caption">
          <b>{cards.length || ""} cartes à découvrir</b>
          <span>Planètes, lunes, nébuleuses, galaxies et amas — photographiés par Hubble, l'ESO et la NASA.</span>
        </div>
      </div>
    </div>
  );
}
