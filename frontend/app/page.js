"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Carte, { RAR } from "@/components/Carte";
import { api } from "@/lib/api";

const HERO = [13, 2, 12];                // Iris, Saturne, Moulinet austral
const SHOWCASE = [46, 38, 31, 5, 1];     // une carte par rareté, de C à L

const STEPS = [
  { icon: "ph-package", t: "Ouvre un booster", d: "Chaque booster contient 5 cartes. Le tirage est fait par le serveur, avec un aléa cryptographique : personne ne peut le prévoir." },
  { icon: "ph-cards", t: "Révèle tes cartes", d: "Retourne-les une à une. La tranche trahit déjà les rares, les ultra rares et les légendaires avant que tu ne les découvres." },
  { icon: "ph-squares-four", t: "Complète ta collection", d: "Ta collection garde chaque carte et ses doubles. Vise toute la série, puis les suivantes." },
];
const FEATURES = [
  { icon: "ph-cards", t: "Collection", d: "Toutes tes cartes, leurs quantités et celles qui te manquent, filtrées par rareté.", menu: "Collection · Toutes les cartes" },
  { icon: "ph-arrows-left-right", t: "Échanges et marché", d: "Propose tes doubles à d'autres joueurs, ou mets-les en vente sur le marché.", menu: "Échanges · Marché" },
  { icon: "ph-sword", t: "Bataille", d: "Attaque, défense, vitesse : compose une main et affronte d'autres collectionneurs.", menu: "Bataille" },
  { icon: "ph-shield", t: "Guilde et amis", d: "Rejoins une guilde, ajoute tes amis et discute avec eux par messages.", menu: "Guilde · Amis · Messages" },
  { icon: "ph-trophy", t: "Succès et classement", d: "Débloque des succès en complétant des séries et grimpe au classement.", menu: "Succès · Classement" },
  { icon: "ph-percent", t: "Taux publics", d: "Les probabilités de chaque emplacement sont affichées. Pas de surprise sur les chances.", menu: "Paquets" },
];

const pct = x => `${Math.round(x * 100)} %`;

export default function LandingPage() {
  const [cards, setCards] = useState([]);
  const [booster, setBooster] = useState(null);

  useEffect(() => {
    api.series().then(list => list[0] && api.seriesDetail(list[0].code)).then(d => {
      if (!d) return;
      setCards(d.cartes);
      setBooster(d.boosters?.[0] || null);
    }).catch(() => {});
  }, []);

  const byNum = n => cards.find(c => c.numero === n);
  const hero = HERO.map(byNum).filter(Boolean);
  const show = SHOWCASE.map(byNum).filter(Boolean);
  const slots = booster?.emplacements || [];
  const lastL = slots.at(-1)?.taux?.L;

  // chance par rareté décrite à partir des vrais taux
  const odds = r => {
    const at = slots.filter(s => s.taux[r]);
    if (!at.length) return "";
    if (r === "C") return `Emplacements ${at[0].position} à ${at.at(-1).position}`;
    return at.map(s => `${pct(s.taux[r])} en carte ${s.position}`).join(" · ");
  };

  return (
    <div className="ax-landing">
      <nav className="nav ax-topnav">
        <Link className="ax-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>
        <a href="#concept">Concept</a>
        <a href="#cartes">Cartes</a>
        <a href="#fonctionnalites">Fonctionnalités</a>
        <div className="ax-actions" style={{ gap: 8 }}>
          <Link className="btn btn-secondary" href="/inscription?mode=connexion">Se connecter</Link>
          <Link className="btn btn-primary" href="/inscription">Créer un compte</Link>
        </div>
      </nav>

      <header className="ax-wrap ax-hero">
        <div>
          <span className="tag tag-accent">Série I · Ciel profond</span>
          <h1>Le ciel profond, carte par carte.</h1>
          <p>Astrodex est un jeu de cartes à collectionner sur l'univers. Ouvre des boosters, découvre planètes, nébuleuses et galaxies photographiées par Hubble, l'ESO et la NASA, et complète ta collection.</p>
          <div className="ax-actions">
            <Link className="btn btn-primary btn-lg" href="/inscription"><i className="ph ph-package" style={{ fontSize: 18 }} />Ouvrir mon premier booster</Link>
            <a className="btn btn-secondary btn-lg" href="#concept" style={{ color: "var(--color-text)" }}>Comment ça marche</a>
          </div>
        </div>
        <div className="ax-fan">
          {hero.map(c => <div key={c.id}><Carte c={c} /></div>)}
        </div>
      </header>

      <section id="concept" className="ax-wrap ax-section">
        <h6 className="ax-kicker">Le concept</h6>
        <h2>Trois gestes : ouvrir, révéler, collectionner.</h2>
        <div className="ax-steps">
          {STEPS.map((s, i) => (
            <div className="ax-step" key={s.t}>
              <div className="ax-step-n">{String(i + 1).padStart(2, "0")}<span className="ax-fade-rule" /></div>
              <i className={`ph ${s.icon}`} />
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="cartes" className="ax-wrap ax-section">
        <div className="ax-sec-head">
          <div>
            <h6 className="ax-kicker">Les cartes</h6>
            <h2>Cinq raretés, de la nébuleuse discrète à la planète légendaire.</h2>
          </div>
          <p>Chaque carte porte une vraie photographie, sa constellation et trois statistiques : attaque, défense, vitesse.</p>
        </div>
        <div className="ax-showcase">
          {show.map(c => (
            <div className="ax-show ax-lift" key={c.id}>
              <Carte c={c} />
              <div>
                <div className="ax-show-label"><i className="ax-dot" style={{ background: RAR[c.rarete].color }} />{RAR[c.rarete].label}</div>
                <div className="ax-show-odds">{odds(c.rarete)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {booster && (
        <section className="ax-band">
          <div className="ax-wrap">
            <div><b>{cards.length}</b><span>cartes dans la série {booster.serie}</span></div>
            <div><b>{booster.nb_cartes}</b><span>cartes par booster, une rare garantie</span></div>
            {lastL != null && <div><b>{pct(lastL)}</b><span>de chance de légendaire au dernier emplacement</span></div>}
          </div>
        </section>
      )}

      <section id="fonctionnalites" className="ax-wrap ax-section" style={{ paddingTop: 96 }}>
        <h6 className="ax-kicker">Fonctionnalités</h6>
        <h2 style={{ marginBottom: 40 }}>Une collection, puis tout un univers de joueurs.</h2>
        <div className="ax-features">
          {FEATURES.map(f => (
            <div className="card elev-sm" key={f.t}>
              <i className={`ph ${f.icon}`} />
              <div className="card-title">{f.t}</div>
              <p className="card-body">{f.d}</p>
              <div className="card-meta">{f.menu}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="ax-wrap" style={{ paddingBlock: "32px 112px" }}>
        <div className="ax-close">
          <div>
            <h2>Ton premier booster t'attend.</h2>
            <p>Crée ton compte en quelques secondes, ta collection est sauvegardée sur le serveur.</p>
          </div>
          <Link className="btn btn-primary btn-lg" href="/inscription">Créer un compte<i className="ph ph-arrow-right" /></Link>
        </div>
      </section>

      <footer className="ax-wrap ax-footer">
        <span>Astrodex · un jeu de cartes sur l'univers</span>
        <span>Images NASA, ESA/Hubble et ESO — domaine public et CC BY 4.0</span>
      </footer>
    </div>
  );
}
