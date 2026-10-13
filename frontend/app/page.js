"use client";
/* Landing « Atlas d'observatoire ». Styles : app/landing.css (préfixe .lx-). Cartes : components/Carte.js. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Carte, { ORDER, RAR } from "@/components/Carte";
import StarField from "@/components/StarField";
import { api } from "@/lib/api";
import { DEMO, RC, SLOTS, COUNT, NOTES, SOURCES } from "@/lib/landing-data";

const pct = x => Math.round(x * 100) + " %";
const anyOf = r => 1 - SLOTS.reduce((p, s) => p * (1 - (s[r] || 0)), 1);

function Graduation({ left, right }) {
  return <div className="lx-grad" aria-hidden="true"><span>{left}</span><i /><span>{right}</span></div>;
}

function Odometer({ value, suffix = "", label, sr, delay = 0 }) {
  return (
    <div className="lx-readout">
      <dt>{label}</dt>
      <dd>
        <span className="lx-sr">{sr}</span>
        <span aria-hidden="true" className="lx-odo">
          {String(value).split("").map((d, i) => (
            <span key={i} className="lx-odo-col">
              <span style={{ transform: `translateY(-${d}em)`, animationDelay: `${delay + i * 120}ms` }}>
                {"0123456789".split("").map(n => <span key={n}>{n}</span>)}
              </span>
            </span>
          ))}
        </span>
        {suffix && <span aria-hidden="true" className="lx-odo-suf">{suffix}</span>}
      </dd>
    </div>
  );
}

const Reticle = () => (
  <div className="lx-reticle" aria-hidden="true"><i /><i /><i /><i /><b /><b /></div>
);

const ROMAN = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
const toRoman = code => ROMAN[Number(String(code).replace(/\D/g, ""))] || code;

export default function Landing() {
  const [cards, setCards] = useState(DEMO);
  const [allSeries, setAllSeries] = useState([]);
  const [scrolled, setScrolled] = useState(false);
  const [sel, setSel] = useState(4);
  const pointer = useRef({ x: .5, y: .5 });

  useEffect(() => {
    api.series().then(setAllSeries).catch(() => {});
    api.seriesDetail("S1").then(d => { if (d?.cartes?.length) setCards(d.cartes); }).catch(() => {});
    const onScroll = () => setScrolled(scrollY > 40);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".lx-rise");
    if (!els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(el => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  const by = slug => cards.find(c => c.slug === slug) || DEMO.find(c => c.slug === slug);
  const fan = ["phoebe", "charon", "titania", "mars", "terre"].map(by);
  const k = ORDER[sel], c = RC[k];

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onLeave = () => { pointer.current = { x: .5, y: .5 }; };

  return (
    <div className="lx">
      <header className={`lx-nav${scrolled ? " is-compact" : ""}`}>
        <nav aria-label="Navigation principale">
          <Link href="/" className="lx-brand" aria-label="Astrodex, accueil"><span className="lx-logo" aria-hidden="true"><span /><span /></span><b>ASTRODEX</b></Link>
          <div className="lx-nav-links">
            <a href="#jeu">Le jeu</a><a href="#raretes">Raretés</a><a href="#atlas">Atlas</a>
          </div>
          <div className="lx-nav-cta">
            <Link href="/inscription?mode=connexion" className="lx-nav-login">Se connecter</Link>
            <Link href="/inscription" className="lx-nav-start">Commencer</Link>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="lx-hero" aria-labelledby="hero-title" onPointerMove={onMove} onPointerLeave={onLeave}>
          <div className="lx-hero-fx" aria-hidden="true">
            <StarField pointer={pointer} />
            <div className="lx-dec"><span>+60°</span><i /><span>−60°</span></div>
          </div>

          <div className="lx-hero-photo" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/saturne.webp" alt="" fetchPriority="high" />
            <div className="lx-hero-photo-shade" />
          </div>

          <div className="lx-hero-grid">
            <div className="lx-hero-copy">
              <div className="lx-series-kicker">
                {(allSeries.length ? allSeries : [{ code: "S1", nom: "Système solaire", nb_cartes: 39 }, { code: "S2", nom: "Astéroïdes", nb_cartes: 15 }, { code: "S3", nom: "Nébuleuses", nb_cartes: 65 }])
                  .map(s => <span key={s.code} className="lx-kicker">SÉRIE {toRoman(s.code)} · {s.nom.toUpperCase()} · {s.nb_cartes}</span>)}
              </div>
              <h1 id="hero-title"><span className="lx-h1-line">L'espace,</span><span className="lx-h1-line lx-h1-italic">carte après carte.</span></h1>
              <p>Chaque carte est une photo prise par une sonde ou un télescope. Déchire un booster, retourne tes cartes, complète la série.</p>
              <div className="lx-actions">
                <Link href="/inscription" className="lx-btn-shimmer">Ouvrir mon premier booster<i className="ph ph-arrow-right" aria-hidden="true" /></Link>
                <a href="#atlas" className="lx-btn-glass"><i className="ph ph-globe-hemisphere-west" aria-hidden="true" />Explorer l'atlas 3D</a>
              </div>
              <span className="lx-mono">GRATUIT · UN PSEUDO SUFFIT</span>

              <dl className="lx-readouts">
                <Odometer value={allSeries.reduce((n, s) => n + (s.nb_cartes || 0), 0) || 119} label="CARTES · 3 SÉRIES" sr="119" />
                <Odometer value={5} label="CARTES PAR BOOSTER" sr="5" delay={120} />
                <Odometer value={6} suffix="%" label="LÉGENDAIRE AU 5E EMPLACEMENT" sr="6 %" delay={240} />
              </dl>
            </div>
          </div>
        </section>

        <section className="lx-section-dark lx-section-dark-a" aria-labelledby="gallery-title">
        <div className="lx-wrap lx-section lx-gallery">
          <div className="lx-gallery-head">
            <div>
              <span className="lx-kicker">COLLECTION · SÉRIE I</span>
              <h2 id="gallery-title">Cartes à <span className="lx-outline">collectionner</span>.</h2>
              <p>Chaque carte est une vraie photo, avec sa rareté et ses crédits au dos. Rien n'est généré.</p>
            </div>
            <Link href="/jeu/cartes" className="lx-link">Voir toute la collection<i className="ph ph-arrow-up-right" aria-hidden="true" /></Link>
          </div>
          <div className="lx-gallery-row">
            {[by("saturne"), by("io"), by("encelade")].map(c => (
              <div key={c.slug} className="lx-gallery-card">
                <Carte c={c} />
                <div className="lx-gallery-meta"><b>{c.nom}</b><span style={{ color: RC[c.rarete] }}>{RAR[c.rarete].label}</span></div>
              </div>
            ))}
          </div>
        </div>
        </section>

        <section id="jeu" className="lx-wrap lx-section" aria-labelledby="jeu-title">
          <Graduation left="RA 02h" right="DÉC +12°" />
          <div className="lx-process-row lx-rise">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="lx-process-media" aria-hidden="true"><img src="/media/neb-pillars_m16.webp" alt="" loading="lazy" /></div>
            <div className="lx-process-col">
              <h2 id="jeu-title">Trois gestes,<br />cinq <span className="lx-outline">cartes</span>.</h2>
              <p>Ouvre un booster, révèle tes cartes, complète la série. Les autres modes se débloquent avec la collection.</p>
            </div>
            <ol className="lx-process-list">
              <li><span className="lx-pnum">01</span><div><h3>Déchire.</h3><p>Ouverture tactile d'un geste. Cinq cartes, dont au moins une Rare en dernière position.</p></div></li>
              <li><span className="lx-pnum">02</span><div><h3>Révèle.</h3><p>Chaque carte se retourne individuellement. Sa bordure annonce la rareté avant l'image.</p></div></li>
              <li><span className="lx-pnum">03</span><div><h3>Collectionne.</h3><p>39 objets à réunir par série. Quantités, doubles et cartes manquantes sont suivies en continu.</p></div></li>
            </ol>
          </div>
        </section>

        <section id="atlas" className="lx-section-dark lx-section-dark-b" aria-labelledby="bento-title">
        <div className="lx-wrap lx-section">
          <Graduation left="RA 06h" right="DÉC −04°" />
          <h2 id="bento-title" className="lx-rise lx-h2-solo">Un jeu de cartes doublé d'un <span className="lx-outline">atlas</span>.</h2>
          <div className="lx-bento">
            <article className="lx-tile lx-t-atlas" aria-labelledby="t-atlas">
              <div className="lx-solar" aria-hidden="true">
                <div className="lx-solar-plane">
                  <div className="lx-sun" />
                  {[[150, "terre", 26, 14, -3, "rgba(106,168,255,.35)"], [210, "mars", 22, 22, -9, "rgba(233,233,237,.16)"], [300, "jupiter", 42, 40, -14, "rgba(233,233,237,.14)"], [400, "saturne", 64, 62, -30, "rgba(255,207,107,.45)"]].map(([d, img, s, dur, delay, ring]) => (
                    <div key={img}>
                      <div className="lx-ring" style={{ width: d, height: Math.round(d * 0.407), left: -d / 2, top: -Math.round(d * 0.407) / 2, borderColor: ring }} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <div className="lx-planet" style={{
                        width: s, height: s,
                        "--rx": `${d / 2}px`, "--ry": `${Math.round(d / 2 * 0.407)}px`,
                        animationDuration: `${dur}s`, animationDelay: `${delay}s`,
                      }}><img src={`/media/${img}.webp`} alt="" loading="lazy" /></div>
                    </div>
                  ))}
                </div>
                <div className="lx-solar-tag"><span><i />SATURNE · 8,4 UA</span><span>DE LA TERRE AUJOURD'HUI</span></div>
              </div>
              <div className="lx-tile-txt">
                <span className="lx-tile-kicker">ATLAS 3D</span>
                <h3 id="t-atlas" className="lx-h3-lg">Chaque objet à sa vraie place.</h3>
                <p>Zoome du Système solaire jusqu'à 500 millions d'années-lumière. Mesure la distance entre deux objets de ta collection.</p>
                <div className="lx-scale" aria-hidden="true"><span>1 UA</span><span>1 al</span><span>1 kpc</span><span>1 Mpc</span><span>500 M al</span></div>
                <Link href="/jeu/atlas" className="lx-link">Explorer l'atlas 3D<i className="ph ph-arrow-right" aria-hidden="true" /></Link>
              </div>
            </article>

            <article className="lx-tile lx-t-photo" aria-labelledby="t-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/encelade.webp" alt="Encelade, lune de Saturne, photographiée par la sonde Cassini" loading="lazy" />
              <div className="lx-photo-shade" aria-hidden="true" />
              <Reticle />
              <div className="lx-photo-txt">
                <span className="lx-tile-kicker">DE VRAIES PHOTOS</span>
                <h3 id="t-photo">Imagerie Cassini, sans retouche générative.</h3>
                <span className="lx-mono">ENCELADE · NASA/JPL/SSI · DOMAINE PUBLIC</span>
              </div>
            </article>

            <article className="lx-tile lx-t-taux" aria-labelledby="t-taux">
              <div className="lx-tile-head"><h3 id="t-taux">Taux publics</h3><span className="lx-mono">BOOSTER S1-STD</span></div>
              <table className="lx-rates">
                <caption className="lx-sr">Taux de rareté par emplacement du booster</caption>
                <tbody>
                  {SLOTS.map((s, i) => (
                    <tr key={i}>
                      <th scope="row">E{i + 1}</th>
                      <td><div className="lx-rate-bar">{ORDER.filter(r => s[r]).map(r => <i key={r} style={{ width: s[r] * 100 + "%", background: RC[r] }} />)}</div></td>
                      <td>{ORDER.filter(r => s[r]).map(r => `${r} ${Math.round(s[r] * 100)}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="lx-tile lx-t-ech" aria-labelledby="t-ech">
              <div className="lx-tile-txt-sm">
                <span className="lx-tile-kicker lx-k-mint">ÉCHANGES<em>BIENTÔT</em></span>
                <h3 id="t-ech">Tes doubles ont une valeur.</h3>
                <p>Échange-les avec d'autres joueurs ou mets-les en vente sur le marché.</p>
              </div>
              <div className="lx-swap" aria-hidden="true">
                <div className="lx-swap-a"><Carte c={by("io")} /></div>
                <div className="lx-swap-b"><Carte c={by("encelade")} /></div>
              </div>
            </article>

            <article className="lx-tile lx-t-bat" aria-labelledby="t-bat">
              <span className="lx-tile-kicker lx-k-coral">BATAILLE<em>BIENTÔT</em></span>
              <h3 id="t-bat">Saturne contre Jupiter.</h3>
              <div className="lx-battle">
                {[["ATQ", "attaque"], ["DÉF", "defense"], ["VIT", "vitesse"]].map(([lbl, key]) => {
                  const a = by("saturne")[key], b = by("jupiter")[key];
                  return (
                    <div key={key}>
                      <div className="lx-battle-lbl"><span>{lbl}</span><span>{a} · {b}</span></div>
                      <p><i style={{ width: a + "%" }} /></p>
                      <p><i className="is-b" style={{ width: b + "%" }} /></p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="lx-tile lx-t-series" aria-labelledby="t-series">
              <div>
                <span className="lx-tile-kicker">DÉJÀ DISPONIBLES</span>
                <h3 id="t-series" className="lx-h3-lg">Astéroïdes. Nébuleuses.</h3>
                <div className="lx-chips"><span className="is-on">S2 · ASTÉROÏDES · 15</span><span className="is-on">S3 · NÉBULEUSES · 65</span></div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="lx-ghosts" aria-hidden="true">
                <div className="lighten"><img src="/media/ast-vesta.webp" alt="" loading="lazy" /></div>
                <div className="lighten"><img src="/media/neb-ring_m57.webp" alt="" loading="lazy" /></div>
                <div className="lighten"><img src="/media/neb-pillars_m16.webp" alt="" loading="lazy" /></div>
              </div>
            </article>
          </div>
        </div>
        </section>

        <section id="raretes" className="lx-rarity" aria-labelledby="rar-title">
          <div className="lx-wrap">
            <Graduation left="RA 12h" right="DÉC −30°" />
            <div className="lx-rarity-grid">
              <div>
                <h2 id="rar-title" className="lx-rise">Cinq raretés, des taux <span className="lx-outline">publics</span>.</h2>
                <div className="lx-fan" role="tablist" aria-label="Choisir une rareté">
                  {fan.map((card, i) => {
                    const on = i === sel, o = i - 2, r = ORDER[i];
                    return (
                      <button key={r} type="button" role="tab" aria-selected={on} aria-label={RAR[r].label}
                        onClick={() => setSel(i)} onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)}
                        style={{
                          zIndex: on ? 10 : 5 - Math.abs(o),
                          transform: on ? "translateY(-30px) scale(1.06)" : `translateY(${Math.abs(o) * 12}px) rotate(${o * 6}deg)`,
                          filter: on ? `drop-shadow(0 0 ${r === "L" ? 28 : 22}px ${RC[r]}${r === "L" ? "8c" : "88"})` : "none",
                        }}>
                        <Carte c={card} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="lx-rarity-panel" role="tabpanel" aria-live="polite" style={{ "--rc": c }}>
                <div className="lx-rp-head"><i /><b>{RAR[k].label}</b><span>{COUNT[k]} CARTE{COUNT[k] > 1 ? "S" : ""} SUR 39</span></div>
                <div className="lx-rp-any"><span>AU MOINS UNE PAR BOOSTER</span><b>{pct(anyOf(k))}</b></div>
                <div className="lx-rp-slots">
                  {SLOTS.map((s, i) => (
                    <div key={i} className={s[k] ? "is-on" : undefined} style={s[k] ? { background: `color-mix(in srgb, ${c} ${Math.round(8 + s[k] * 30)}%, transparent)` } : undefined}>
                      <span>E{i + 1}</span><b>{s[k] ? pct(s[k]) : "—"}</b>
                    </div>
                  ))}
                </div>
                <p>{NOTES[k]}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lx-manifesto" aria-labelledby="manifesto-title">
          <i className="ph ph-sparkle lx-manifesto-icon" aria-hidden="true" />
          <h2 id="manifesto-title" className="lx-rise">Jamais une image <span className="lx-outline">générée</span>.</h2>
          <p>Chaque carte vient des archives publiques d'une agence spatiale, avec son instrument, son année et sa licence.</p>
          <dl className="lx-manifesto-sources">{SOURCES.map(([who, what]) => <div key={who}><dt>{who}</dt><dd>{what}</dd></div>)}</dl>
          <span className="lx-mono">LICENCES · DOMAINE PUBLIC · CC BY-SA 4.0 · CC BY-SA 3.0 IGO</span>
        </section>

        <section className="lx-section-dark lx-cta-wrap" aria-labelledby="cta-title">
        <div className="lx-wrap">
          <div className="lx-cta">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lx-cta-photo" src="/media/neb-pillars_m16.webp" alt="" aria-hidden="true" loading="lazy" />
            <div className="lx-cta-shade" aria-hidden="true" />
            <h2 id="cta-title">Ton premier booster <span className="lx-outline lx-gold">t'attend</span>.</h2>
            <p>Un pseudo, un clic, cinq cartes.</p>
            <Link href="/inscription" className="lx-beam"><span className="lx-beam-dot" aria-hidden="true" /><span className="lx-beam-in">Ouvrir mon premier booster<i className="ph ph-arrow-right" aria-hidden="true" /></span></Link>
            <span className="lx-mono">GRATUIT · SANS CARTE BANCAIRE</span>
          </div>
        </div>
        </section>
      </main>

      <footer className="lx-footer">
        <div className="lx-footer-wm" aria-hidden="true">ASTRODEX</div>
        <div className="lx-wrap lx-footer-top">
          <div>
            <span className="lx-brand"><span className="lx-logo sm" aria-hidden="true"><span /></span><b>ASTRODEX</b></span>
            <p className="lx-footer-tag">L'espace, carte après carte.</p>
            <p>Un jeu de cartes sur l'espace et ses planètes.</p>
          </div>
          <nav aria-label="Pied de page"><h4><i className="lx-dot" aria-hidden="true" />JEU</h4><a href="#jeu">Le jeu</a><a href="#raretes">Raretés</a><a href="#atlas">Atlas 3D</a><Link href="/inscription?mode=connexion">Se connecter</Link></nav>
          <div><h4><i className="lx-dot" aria-hidden="true" />CRÉDITS DES IMAGES</h4><p>NASA, JPL-Caltech, SSI, JHUAPL, SwRI, ESA/Hubble, ESA/Rosetta, ESO.</p><p>Domaine public, CC BY-SA 4.0, CC BY-SA 3.0 IGO.</p></div>
          <div><h4><i className="lx-dot" aria-hidden="true" />OPEN SOURCE</h4><a href="https://github.com/SLKC1PH3R/astrodex"><i className="ph ph-github-logo" aria-hidden="true" />Code source sur GitHub</a><p>astrodex.digitalstack.cloud</p></div>
        </div>
        <div className="lx-wrap lx-footer-bottom">
          <span>© 2026 Astrodex. Tous droits réservés.</span>
          <div><a href="https://github.com/SLKC1PH3R/astrodex">GITHUB</a><Link href="/jeu/atlas">ATLAS 3D</Link></div>
        </div>
      </footer>
    </div>
  );
}
