"use client";
/* Landing « Atlas d'observatoire ». Styles : app/landing.css (préfixe .lx-). Cartes : components/Carte.js. */
import { useEffect, useMemo, useRef, useState } from "react";
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

export default function Landing() {
  const [cards, setCards] = useState(DEMO);
  const [scrolled, setScrolled] = useState(false);
  const [sel, setSel] = useState(4);
  const pointer = useRef({ x: .5, y: .5 });
  const tilt = useRef(null), sheen = useRef(null);

  useEffect(() => {
    api.seriesDetail("S1").then(d => { if (d?.cartes?.length) setCards(d.cartes); }).catch(() => {});
    const onScroll = () => setScrolled(scrollY > 40);
    onScroll(); addEventListener("scroll", onScroll, { passive: true });
    return () => removeEventListener("scroll", onScroll);
  }, []);

  const by = slug => cards.find(c => c.slug === slug) || DEMO.find(c => c.slug === slug);
  const marquee = useMemo(() => {
    const set = [...cards].sort((a, b) => (a.numero * 7) % 11 - (b.numero * 7) % 11).slice(0, 18);
    return [...set, ...set];
  }, [cards]);
  const fan = ["phoebe", "charon", "titania", "mars", "terre"].map(by);
  const k = ORDER[sel], c = RC[k];

  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    pointer.current = { x, y };
    if (e.pointerType === "touch" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (tilt.current) tilt.current.style.transform = `rotateX(${(.5 - y) * 14}deg) rotateY(${(x - .5) * 22}deg)`;
    if (sheen.current) sheen.current.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,.5), transparent 42%)`;
  };
  const onLeave = () => { pointer.current = { x: .5, y: .5 }; if (tilt.current) tilt.current.style.transform = ""; };

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
          <StarField pointer={pointer} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="lighten lx-hero-planet" aria-hidden="true"><img src="/media/saturne.webp" alt="" fetchPriority="high" /></div>
          <div className="lx-dec" aria-hidden="true"><span>+60°</span><i /><span>−60°</span></div>

          <div className="lx-hero-grid">
            <div className="lx-hero-copy">
              <span className="lx-kicker">SÉRIE I · SYSTÈME SOLAIRE · 39 CARTES</span>
              <h1 id="hero-title">L'espace, <span className="lx-outline">carte</span> après carte.</h1>
              <p>Chaque carte est une photo prise par une sonde ou un télescope. Déchire un booster, retourne tes cartes, complète la série.</p>
              <div className="lx-actions">
                <Link href="/inscription" className="lx-btn-shimmer">Ouvrir mon premier booster<i className="ph ph-arrow-right" aria-hidden="true" /></Link>
                <a href="#atlas" className="lx-btn-glass"><i className="ph ph-globe-hemisphere-west" aria-hidden="true" />Explorer l'atlas 3D</a>
              </div>
              <span className="lx-mono">GRATUIT · UN PSEUDO SUFFIT</span>
            </div>

            <div className="lx-stage" aria-hidden="true">
              <div className="lx-tilt" ref={tilt}>
                <div className="lx-back lx-back-l"><Carte c={by("mars")} /></div>
                <div className="lx-back lx-back-r"><Carte c={by("titania")} /></div>
                <div className="lx-orbit lx-orbit-a"><div><i /></div></div>
                <div className="lx-orbit lx-orbit-b"><div><i /></div></div>
                <div className="lx-hero-card">
                  <div className="lx-hero-glow" />
                  <Carte c={by("saturne")} />
                  <div className="lx-sheen" ref={sheen} />
                </div>
              </div>
            </div>
          </div>

          <div className="lx-hero-foot">
            <Graduation left="RA 00h" right="RA 24h" />
            <dl className="lx-readouts">
              <Odometer value={39} label="CARTES DANS LA SÉRIE I" sr="39" />
              <Odometer value={5} label="CARTES PAR BOOSTER" sr="5" delay={120} />
              <Odometer value={6} suffix="%" label="LÉGENDAIRE AU 5E EMPLACEMENT" sr="6 %" delay={240} />
              <Odometer value={500} suffix="M al" label="PORTÉE DE L'ATLAS 3D" sr="500 millions d'années-lumière" delay={360} />
            </dl>
          </div>
        </section>

        <section className="lx-marquee" aria-label="Aperçu des cartes de la série I">
          <div className="lx-wrap lx-marquee-head"><span>CHAQUE CARTE · UNE VRAIE PHOTO</span><span>CRÉDIT ET LICENCE AU DOS</span></div>
          <div className="lx-marquee-mask">
            <div className="lx-marquee-track">
              {marquee.map((m, i) => <div key={i} className="lx-marquee-item"><Carte c={m} /></div>)}
            </div>
          </div>
        </section>

        <section id="jeu" className="lx-wrap lx-section" aria-labelledby="jeu-title">
          <Graduation left="RA 02h" right="DÉC +12°" />
          <div className="lx-split lx-rise">
            <h2 id="jeu-title">Trois gestes, <span className="lx-outline">cinq</span> cartes.</h2>
            <p>Ouvre un booster, révèle tes cartes, complète la série. Les autres modes se débloquent avec la collection.</p>
          </div>
          <ol className="lx-steps">
            <li>
              <div className="lx-step-art lx-art-tear" aria-hidden="true">
                <div className="lx-pack">
                  <div className="lx-pack-peek" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="lx-pack-body"><div className="lighten"><img src="/media/saturne.webp" alt="" loading="lazy" /></div><span>ASTRODEX</span></div>
                  <div className="lx-pack-top" /><div className="lx-pack-dash" />
                </div>
              </div>
              <div className="lx-step-txt"><span>01 · DÉCHIRE</span><h3>Ouverture tactile.</h3><p>Déchire l'emballage d'un geste. Cinq cartes, dont au moins une Rare en dernière position.</p></div>
            </li>
            <li>
              <div className="lx-step-art lx-art-flip" aria-hidden="true">
                <div className="lx-flash" />
                <div className="lx-flipcard">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="lx-flip-front"><img src={by("io").image_url} alt="" loading="lazy" /><div><b>Io</b><span>ULTRA RARE</span></div></div>
                  <div className="lx-flip-back"><span /></div>
                </div>
              </div>
              <div className="lx-step-txt"><span>02 · RÉVÈLE</span><h3>Révélation carte par carte.</h3><p>Chaque carte se retourne individuellement. Sa bordure annonce la rareté avant l'image.</p></div>
            </li>
            <li>
              <div className="lx-step-art lx-art-fill" aria-hidden="true">
                <div className="lx-minigrid">
                  {Array.from({ length: 16 }, (_, i) => {
                    const r = ["L", "UR", "R", "C", "UR", "C", "R", "UR", "C", "PC"][i];
                    return <i key={i} style={r ? { background: `color-mix(in srgb, ${RC[r]} 55%, #161826)`, boxShadow: `0 0 10px -2px ${RC[r]}` } : undefined} />;
                  })}
                </div>
                <div className="lx-progress"><div><span>SÉRIE I</span><span>24 / 39</span></div><p><i /></p></div>
              </div>
              <div className="lx-step-txt"><span>03 · COLLECTIONNE</span><h3>39 objets à réunir.</h3><p>Quantités, doubles et cartes manquantes : ta progression est suivie série par série.</p></div>
            </li>
          </ol>
        </section>

        <section id="atlas" className="lx-wrap lx-section" aria-labelledby="bento-title">
          <Graduation left="RA 06h" right="DÉC −04°" />
          <h2 id="bento-title" className="lx-rise lx-h2-solo">Un jeu de cartes doublé d'un <span className="lx-outline">atlas</span>.</h2>
          <div className="lx-bento">
            <article className="lx-tile lx-t-atlas" aria-labelledby="t-atlas">
              <div className="lx-solar" aria-hidden="true">
                <div className="lx-solar-plane">
                  <div className="lx-sun" />
                  {[[150, "terre", 20, 14, -3, "rgba(106,168,255,.35)"], [210, "mars", 16, 22, -9, "rgba(233,233,237,.16)"], [300, "jupiter", 34, 40, -14, "rgba(233,233,237,.14)"], [400, "saturne", 52, 62, -30, "rgba(255,207,107,.45)"]].map(([d, img, s, dur, delay, ring]) => (
                    <div key={img}>
                      <div className="lx-ring" style={{ width: d, height: d, left: -d / 2, top: -d / 2, borderColor: ring }} />
                      <div className="lx-orbiter" style={{ width: d, height: d, left: -d / 2, top: -d / 2, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <div className="lx-planet" style={{ width: s, height: s, margin: `${-s / 2}px 0 0 ${-s / 2}px`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}><img src={`/media/${img}.webp`} alt="" loading="lazy" /></div>
                      </div>
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

        <section className="lx-wrap lx-proof" aria-labelledby="proof-title">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/saturne_anneaux.webp" alt="Les anneaux de Saturne photographiés par la sonde Cassini en 2005" loading="lazy" />
            <div className="lx-proof-frame" aria-hidden="true" /><div className="lx-proof-ticks" aria-hidden="true" />
            <figcaption><span>SATURNE · ANNEAUX</span><span>NASA/JPL/SSI · CASSINI · 2005</span></figcaption>
          </figure>
          <div className="lx-proof-txt">
            <h2 id="proof-title" className="lx-rise">Des photos qui <span className="lx-outline">existent</span>.</h2>
            <p>Aucune image n'est générée. Chaque carte vient des archives publiques d'une agence spatiale, avec son instrument, son année et sa licence.</p>
            <dl>{SOURCES.map(([who, what]) => <div key={who}><dt>{who}</dt><dd>{what}</dd></div>)}</dl>
            <span className="lx-mono">LICENCES · DOMAINE PUBLIC · CC BY-SA 4.0 · CC BY-SA 3.0 IGO</span>
          </div>
        </section>

        <section className="lx-cta" aria-labelledby="cta-title">
          <div className="lx-eclipse" aria-hidden="true"><div className="lx-corona" /><div className="lx-rays" /><div className="lx-disc" /><i /></div>
          <h2 id="cta-title">Ton premier booster <span className="lx-outline lx-gold">t'attend</span>.</h2>
          <p>Un pseudo, un clic, cinq cartes.</p>
          <Link href="/inscription" className="lx-beam"><span className="lx-beam-dot" aria-hidden="true" /><span className="lx-beam-in">Ouvrir mon premier booster<i className="ph ph-arrow-right" aria-hidden="true" /></span></Link>
          <span className="lx-mono">GRATUIT · SANS CARTE BANCAIRE</span>
        </section>
      </main>

      <footer className="lx-footer">
        <div className="lx-wrap">
          <div><span className="lx-brand"><span className="lx-logo sm" aria-hidden="true"><span /></span><b>ASTRODEX</b></span><p>Un jeu de cartes sur l'espace et ses planètes.</p></div>
          <nav aria-label="Pied de page"><h4>JEU</h4><a href="#jeu">Le jeu</a><a href="#raretes">Raretés</a><a href="#atlas">Atlas 3D</a><Link href="/inscription?mode=connexion">Se connecter</Link></nav>
          <div><h4>CRÉDITS DES IMAGES</h4><p>NASA, JPL-Caltech, SSI, JHUAPL, SwRI, ESA/Hubble, ESA/Rosetta, ESO.</p><p>Domaine public, CC BY-SA 4.0, CC BY-SA 3.0 IGO.</p></div>
          <div><h4>OPEN SOURCE</h4><a href="https://github.com/SLKC1PH3R/astrodex"><i className="ph ph-github-logo" aria-hidden="true" />Code source sur GitHub</a><p>astrodex.digitalstack.cloud</p></div>
        </div>
      </footer>
    </div>
  );
}
