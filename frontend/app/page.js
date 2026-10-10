"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Carte, { ORDER, RAR } from "@/components/Carte";
import { BorderBeam, Marquee, NumberTicker, ShimmerButton } from "@/components/MagicUI";
import { api } from "@/lib/api";

const LEGENDAIRES = [1, 2, 3];                                // Terre, Saturne, Jupiter
const LADDER = [[31, "C"], [10, "PC"], [30, "R"], [11, "UR"], [2, "L"]];
const FEATURES = [
  { icon: "ph-cards", t: "Collection", d: "Quantités, cartes manquantes, filtres par rareté." },
  { icon: "ph-arrows-left-right", t: "Échanges et marché", d: "Tes doubles deviennent une monnaie." },
  { icon: "ph-sword", t: "Bataille", d: "ATQ, DÉF, VIT : chaque carte a son rôle." },
  { icon: "ph-shield", t: "Guilde, amis, messages", d: "Joue avec ceux qui regardent le même ciel." },
  { icon: "ph-trophy", t: "Succès et classement", d: "Chaque série complétée laisse une trace." },
];
const pct = x => `${Math.round(x * 100)} %`;

function mixRarities(cards, n) {
  const lists = [...ORDER].reverse().map(r => cards.filter(c => c.rarete === r));
  const out = [];
  for (let i = 0; out.length < Math.min(n, cards.length); i++) lists.forEach(l => l[i] && out.length < n && out.push(l[i]));
  return out;
}

export default function LandingPage() {
  const [serie, setSerie] = useState(null);
  const [cards, setCards] = useState([]);
  const [booster, setBooster] = useState(null);

  useEffect(() => {
    api.series()
      .then(list => { if (list[0]) { setSerie(list[0]); return api.seriesDetail(list[0].code); } })
      .then(d => { if (d) { setCards(d.cartes); setBooster(d.boosters?.[0] || null); } })
      .catch(() => {});
  }, []);

  const byNum = n => cards.find(c => c.numero === n);
  const slots = booster?.emplacements || [];
  const lastL = slots.at(-1)?.taux?.L;
  const hero = byNum(1);           // Terre, pour le nom/constellation affichés sous le titre
  const photo2 = byNum(34);        // Anneaux de Saturne (Cassini), gros plan
  const odds = r => r === "C"
    ? (() => { const at = slots.filter(s => s.taux.C); return at.length ? `Emplacements ${at[0].position} à ${at.at(-1).position}` : ""; })()
    : slots.filter(s => s.taux[r]).map(s => `${pct(s.taux[r])} en carte ${s.position}`).join(" · ");

  return (
    <div className="lp">
      <header className="lp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="lighten lp-hero-photo"><img src="/hero/pillars.webp" alt="" /></div>
        <div className="lp-hero-shade" />
        <nav className="nav lp-nav">
          <Link className="ax-brand" href="/"><span className="ax-mark" /><b>ASTRODEX</b></Link>
          <a href="#raretes">Raretés</a>
          <a href="#jeu">Le jeu</a>
          <Link className="btn btn-secondary" href="/inscription?mode=connexion">Se connecter</Link>
          <Link className="btn btn-primary" href="/inscription">Commencer</Link>
        </nav>
        <div className="lp-hero-meta">
          <span>SÉRIE {serie?.code?.replace(/^S/, "") === "1" ? "I" : serie?.code || "I"}</span>
          <span>{(serie?.nom || "Système solaire").toUpperCase()}</span>
          {hero && <span className="lp-push">{hero.nom.toUpperCase()} · {hero.constellation.toUpperCase()}</span>}
        </div>
        <div className="lp-hero-body">
          <h1>{cards.length || 39} vraies photos<br /><span>de l'espace.</span></h1>
          <p>Chaque carte est une vraie photographie d'un objet céleste. Ouvre des boosters, réunis la série, échange tes doubles.</p>
          <div><ShimmerButton href="/inscription">Ouvrir un booster</ShimmerButton></div>
        </div>
      </header>

      {cards.length > 0 && (
        <div className="lp-marquee">
          <Marquee>{mixRarities(cards, 16).map(c => <div key={c.id} className="lp-marquee-card"><Carte c={c} /></div>)}</Marquee>
        </div>
      )}

      <div className="lp-wrap lp-tickers">
        <div><b><NumberTicker value={cards.length || 39} /></b><span>cartes dans la série {serie?.nom || "Système solaire"}</span></div>
        <div><b><NumberTicker value={booster?.nb_cartes || 5} /></b><span>cartes par booster, une rare garantie</span></div>
        {lastL != null && <div><b><NumberTicker value={Math.round(lastL * 100)} /> %</b><span>de chance de Légendaire au 5e emplacement</span></div>}
      </div>

      <section className="lp-lamp-section">
        <div className="lp-lamp">
          <div className="lp-lamp-cone l" /><div className="lp-lamp-cone r" />
          <div className="lp-lamp-glow" /><div className="lp-lamp-core" /><div className="lp-lamp-line" />
          <div className="lp-lamp-text">
            <h2>Six chances sur cent de tomber sur une Légendaire.</h2>
            <p>Au cinquième emplacement de chaque booster. Et quand elle sort, elle sort en holo, pleine illustration.</p>
          </div>
        </div>
        <div className="lp-legend-row">
          {LEGENDAIRES.map(byNum).filter(Boolean).map(c => <div key={c.id}><Carte c={c} /></div>)}
        </div>
      </section>

      <section id="raretes" className="lp-wrap lp-block">
        <div className="lp-head">
          <h2>De la Commune<br />à la Légendaire.</h2>
          <p>Cinq raretés. Les taux de chaque emplacement sont publics : tu sais exactement ce que tu peux espérer.</p>
        </div>
        <div className="lp-ladder">
          {LADDER.map(([n, r], i) => {
            const c = byNum(n);
            if (!c) return null;
            return (
              <div key={r}>
                <div className="lp-ladder-card" style={{ width: `${72 + i * 7}%` }}><Carte c={c} /></div>
                <div className="lp-ladder-info" style={{ "--rc": RAR[r].color }}>
                  <b>{RAR[r].label}</b>
                  <span>{cards.filter(x => x.rarete === r).length} cartes dans la série</span>
                  <small>{odds(r)}</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="lp-wrap lp-duo">
        <div className="lp-photos">
          {photo2 && (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="lighten"><img src={photo2.image_url} alt="" /></div>
          )}
          <h4>Des photos qui existent</h4>
          <p>Hubble, ESO, NASA. Chaque carte crédite sa source.</p>
        </div>
        <div className="lp-count">
          <span className="lp-gems">{ORDER.map(r => <i key={r} style={{ background: RAR[r].color }} />)}</span>
          <div><b>{cards.length || 39}</b><span>cartes disponibles dans la série {serie?.nom || "Système solaire"}</span></div>
        </div>
      </section>

      <section id="jeu" className="lp-wrap lp-features">
        <div>
          <h2>Une collection,<br />puis tout un univers.</h2>
          <p>Ce que tu débloques en jouant.</p>
        </div>
        <ol>
          {FEATURES.map((f, i) => (
            <li key={f.t}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div><h4>{f.t}</h4><p>{f.d}</p></div>
              <i className={`ph ${f.icon}`} />
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-wrap lp-block">
        <div className="lp-cta">
          <BorderBeam />
          <BorderBeam delay={4.5} from="#ffcf6b" to="var(--color-accent-700)" />
          <div>
            <h2>Ton premier booster est prêt.</h2>
            <p>Un pseudo, un clic, cinq cartes.</p>
          </div>
          <ShimmerButton href="/inscription">Créer mon compte</ShimmerButton>
        </div>
      </section>

      <footer className="lp-wrap lp-footer">
        <span>Astrodex · un jeu de cartes sur l'univers</span>
        <span>Images NASA, ESA/Hubble, ESO — domaine public et CC BY 4.0</span>
      </footer>
    </div>
  );
}
