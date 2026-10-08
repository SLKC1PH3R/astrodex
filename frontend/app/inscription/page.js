"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CardCarousel from "@/components/CardCarousel";
import { api, ensurePlayer, signup } from "@/lib/api";

function AuthForm() {
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

  return (
    <form onSubmit={submit}>
      <div className="seg" role="radiogroup">
        <label className="seg-opt"><input type="radio" name="mode" checked={isSignup} onChange={() => setMode("inscription")} />Inscription</label>
        <label className="seg-opt"><input type="radio" name="mode" checked={!isSignup} onChange={() => setMode("connexion")} />Connexion</label>
      </div>
      <div>
        <h2>{isSignup ? "Crée ton compte" : "Bon retour"}</h2>
        <p className="sub">{isSignup ? "Ta collection est sauvegardée et te suit sur tous tes appareils." : "Connecte-toi pour retrouver ta collection et tes boosters."}</p>
      </div>
      {isSignup && (
        <div className="field">
          <label htmlFor="pseudo">Pseudo</label>
          <input className="input" id="pseudo" placeholder="ex. orion42" autoComplete="username" maxLength={32} value={pseudo} onChange={e => setPseudo(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input className="input" id="email" type="email" placeholder="toi@exemple.fr" autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="mdp" style={{ display: "flex", justifyContent: "space-between" }}>
          Mot de passe{!isSignup && <a href="#" style={{ fontSize: 12 }}>Oublié ?</a>}
        </label>
        <input className="input" id="mdp" type="password" placeholder="8 caractères minimum" autoComplete={isSignup ? "new-password" : "current-password"} />
      </div>
      {isSignup && (
        <label className="ax-check">
          <input type="checkbox" required />
          <span>J'accepte les conditions d'utilisation et la politique de confidentialité.</span>
        </label>
      )}
      {error && <p className="ax-error">{error}</p>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy} style={{ padding: 11, fontSize: 15 }}>
        {isSignup ? "Créer mon compte" : "Se connecter"}<i className="ph ph-arrow-right" />
      </button>
      <div className="ax-or">ou</div>
      <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => go(ensurePlayer)} style={{ padding: 10 }}>Continuer en invité</button>
      <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-400)" }}>
        {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
        <a href="#" onClick={e => { e.preventDefault(); setMode(isSignup ? "connexion" : "inscription"); }}>{isSignup ? "Se connecter" : "Créer un compte"}</a>
      </p>
    </form>
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
        <Suspense><AuthForm /></Suspense>
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
