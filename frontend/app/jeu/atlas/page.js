"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Carte, { ORDER, RAR } from "@/components/Carte";
import { LEVELS, LY_KM, fmtDist, fmtLight, levelOf, mountAtlas } from "@/components/atlas/engine";
import { api, hasPlayer } from "@/lib/api";
import "./atlas.css";

const rank = r => ORDER.indexOf(r);

/* Associe chaque objet de l'atlas à ses cartes (toutes séries) et à la collection du joueur. */
function decorate(objets, cards, ownedIds) {
  for (const o of objets) {
    o.cards = cards.filter(c => c.slug === o.slug).sort((a, b) => rank(b.rarete) - rank(a.rarete));
    const mine = o.cards.filter(c => ownedIds.has(c.id));
    o.owned = mine.length > 0;
    const ref = mine[0] || o.cards[0];
    o.bestRarete = ref?.rarete;
    o.imageUrl = ref?.image_url || (o.image ? `/media/${o.image}` : null);
    o.cadrage = ref?.cadrage || (o.image?.startsWith("dso-") ? "photo" : "globe");
  }
}

export default function AtlasPage() {
  const box = useRef(null);
  const engine = useRef(null);
  const [data, setData] = useState(null);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [level, setLevel] = useState(0);
  const [sel, setSel] = useState(null);
  const [measure, setMeasure] = useState(null);
  const [list, setList] = useState(false);

  /* Données : positions (fichier statique), cartes du catalogue, collection du joueur */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [atlas, series] = await Promise.all([
          fetch("/atlas/atlas.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
          api.series(),
        ]);
        const details = await Promise.all(series.map(s => api.seriesDetail(s.code)));
        const cards = details.flatMap(d => d.cartes);
        const owned = hasPlayer() ? new Set((await api.collection().catch(() => [])).map(c => c.id)) : new Set();
        decorate(atlas.objets, cards, owned);
        if (!cancelled) { setOwnedIds(owned); setData(atlas); }
      } catch {
        if (!cancelled) setError("Impossible de charger l'atlas. Vérifie que le serveur de jeu répond, puis recharge la page.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Montage du moteur 3D */
  useEffect(() => {
    if (!data || !box.current) return;
    const e = mountAtlas(box.current, {
      data,
      onSelect: p => { setSel(p); if (p) setList(false); },
      onLevel: setLevel,
      onMeasure: r => setMeasure(r),
    });
    engine.current = e;
    return () => { e.destroy(); engine.current = null; };
  }, [data]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") { setSel(null); setList(false); engine.current?.deselect(); }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    const c = LEVELS.map(() => ({ cartes: 0, possedees: 0, objets: 0 }));
    for (const o of data?.objets || []) {
      const l = c[levelOf(o)]; l.objets++;
      if (o.cards.length) l.cartes++;
      if (o.owned) l.possedees++;
    }
    return c;
  }, [data]);

  const hint = level === 0
    ? `Positions au ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · les lunes apparaissent en s'approchant de leur planète`
    : LEVELS[level].hint;
  const totalOwned = data ? data.objets.filter(o => o.owned).length : 0;
  const totalCards = data ? data.objets.filter(o => o.cards.length).length : 0;

  return (
    <>
      <header className="ax-topbar">
        <div>
          <h3>Atlas</h3>
          <small>Les objets du catalogue à leurs vraies positions, de la Terre à 500 millions d'années-lumière</small>
        </div>
        <div className="ax-chips">
          {data && <span className="tag tag-neutral"><i className="ph ph-planet" />Découverts <b>{totalOwned}/{totalCards}</b></span>}
          <button className="btn btn-secondary" type="button" aria-pressed={list} onClick={() => { setList(v => !v); setSel(null); }}>
            <i className="ph ph-list-bullets" />Objets
          </button>
        </div>
      </header>

      <section className="atlas" ref={box}>
        {!data && !error && <p className="atlas-state">Chargement de l'atlas…</p>}
        {error && <p className="atlas-state atlas-error">{error}</p>}

        {data && (
          <nav className="atlas-ladder" aria-label="Échelles de distance">
            <h6>Échelle</h6>
            {LEVELS.map((L, i) => (
              <button key={L.nom} type="button" className="atlas-lv" aria-current={level === i ? "true" : undefined}
                onClick={() => engine.current?.goLevel(i)}>
                <i />
                <b>{L.nom}</b>
                <small>{L.echelle}{counts[i].objets ? ` · ${counts[i].cartes ? `${counts[i].possedees}/${counts[i].cartes} cartes` : `${counts[i].objets} objets`}` : ""}</small>
              </button>
            ))}
          </nav>
        )}

        {data && (
          <div className="atlas-bottom">
            {measure && (
              <div className="atlas-measure" role="status">
                {measure.pending ? (
                  <div><small>Depuis {measure.from}</small><b>Choisis un second objet</b><small>Sur cette échelle ou une autre</small></div>
                ) : (
                  <div><small>{measure.a} ↔ {measure.b}</small><b>{measure.distance}</b><small>{measure.lumiere} à la vitesse de la lumière</small></div>
                )}
                <button className="btn btn-ghost btn-icon" type="button" aria-label="Fermer la mesure"
                  onClick={() => { setMeasure(null); engine.current?.clearMeasure(); }}><i className="ph ph-x" /></button>
              </div>
            )}
            <p className="atlas-hint">{hint}</p>
          </div>
        )}

        {sel && (
          <Fiche p={sel} ownedIds={ownedIds}
            onClose={() => { setSel(null); engine.current?.deselect(); }}
            onMeasure={() => { engine.current?.startMeasure(sel); setMeasure({ pending: true, from: sel.ref.nom }); setSel(null); }} />
        )}

        {list && data && (
          <aside className="atlas-panel" aria-label="Objets par distance">
            <div className="atlas-p-head">
              <div><h6>{data.objets.length} objets</h6><h4>Classés par distance</h4></div>
              <button className="btn btn-ghost btn-icon" type="button" aria-label="Fermer" onClick={() => setList(false)}><i className="ph ph-x" /></button>
            </div>
            {LEVELS.map((L, i) => {
              const items = data.objets.filter(o => levelOf(o) === i).sort((a, b) => a.dist - b.dist);
              if (!items.length) return null;
              return (
                <div key={L.nom} className="atlas-list">
                  <h6>{L.nom}</h6>
                  {items.map(o => (
                    <button key={o.slug} type="button" onClick={() => { setList(false); engine.current?.focus(o.slug); }}
                      style={{ "--rc": o.owned ? RAR[o.bestRarete].color : undefined }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.imageUrl ? <img src={o.imageUrl} alt="" className={o.owned ? "" : "off"} /> : <span className="atlas-noimg" />}
                      <span className="nm">{o.nom}</span>
                      <span className="ds">{o.planete === "earth" ? "ici" : fmtDist(o.dist, true)}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </aside>
        )}
      </section>
    </>
  );
}

function Fact({ dt, children }) {
  return <div><dt>{dt}</dt><dd>{children}</dd></div>;
}

function Fiche({ p, ownedIds, onClose, onMeasure }) {
  const r = p.ref;
  let kicker, body;

  if (p.kind === "objet") {
    kicker = r.type;
    const light = r.planete === "earth"
      ? <>La lumière du Soleil met <b>{fmtLight(r.distSoleil)}</b> pour atteindre la Terre.</>
      : r.hote ? <>La lumière met <b>{fmtLight(r.dist_km / LY_KM)}</b> pour aller de {r.nom} à sa planète.</>
      : <>La lumière que tu vois est partie il y a <b>{fmtLight(r.dist)}</b>.</>;
    body = (
      <>
        {r.cards.length ? (
          <div className="atlas-cards">
            {r.cards.map(c => <div key={c.id} className="atlas-card"><Carte c={c} revealed={ownedIds.has(c.id)} /></div>)}
          </div>
        ) : (
          <div className="atlas-nocard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.imageUrl && <img src={r.imageUrl} alt={r.nom} />}
            <p>Pas encore de carte pour cet objet : il arrivera dans une prochaine série.</p>
          </div>
        )}
        {r.cards.length > 0 && !r.owned && <p className="atlas-locked">Pas encore dans ta collection. Ouvre des paquets pour révéler cette carte.</p>}
        <p className="atlas-light">{light}</p>
        <dl className="atlas-facts">
          {r.planete === "earth" ? <Fact dt="Distance au Soleil">{fmtDist(r.distSoleil)}</Fact>
            : r.planete || r.orbite ? <><Fact dt="Distance de la Terre aujourd'hui">{fmtDist(r.dist)}</Fact><Fact dt="Distance au Soleil">{fmtDist(r.distSoleil)}</Fact></>
            : r.hote ? <Fact dt="Distance à sa planète">{new Intl.NumberFormat("fr-FR").format(r.dist_km)} km</Fact>
            : <Fact dt="Distance de la Terre">{fmtDist(r.dist)}</Fact>}
          {r.constellation && r.level > 0 && <Fact dt="Constellation">{r.constellation}</Fact>}
          {r.faits && <Fact dt="Repères">{r.faits}</Fact>}
        </dl>
        {r.hote && <p className="atlas-note">Sur la carte, l'orbite est agrandie ; l'ordre des lunes autour de leur planète est respecté.</p>}
        {r.orbite && <p className="atlas-note">Orbite et position approchées, calculées à partir d'éléments orbitaux simplifiés.</p>}
        {r.level >= 2 && <p className="atlas-note">Distance estimée d'après la littérature ; celle des nébuleuses peut varier du simple au double selon les études.</p>}
      </>
    );
  } else if (p.kind === "etoile") {
    kicker = "Étoile du voisinage";
    const app = r.absmag - 5 * Math.log10(10 / (r.dist / 3.26156));
    const lum = Math.pow(10, (4.83 - r.absmag) / 2.5);
    body = (
      <>
        <p className="atlas-light">La lumière que tu vois est partie il y a <b>{fmtLight(r.dist)}</b>.</p>
        <dl className="atlas-facts">
          <Fact dt="Distance du Soleil">{fmtDist(r.dist)}</Fact>
          <Fact dt="Magnitude apparente">{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(app)}</Fact>
          <Fact dt="Luminosité">{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: lum < 1 ? 3 : 1 }).format(lum)} × le Soleil</Fact>
        </dl>
        <p className="atlas-note">Les étoiles n'ont pas encore de cartes : elles pourront faire l'objet d'une prochaine série.</p>
      </>
    );
  } else {
    kicker = "Repère";
    body = (
      <>
        {r.detail && <p className="atlas-light">{r.detail}</p>}
        {r.dist > 0 && <dl className="atlas-facts"><Fact dt="Distance">{fmtDist(r.dist)}</Fact></dl>}
      </>
    );
  }

  return (
    <aside className="atlas-panel" aria-label={r.nom}>
      <div className="atlas-p-head">
        <div><h6>{kicker}</h6><h4>{r.nom}</h4></div>
        <button className="btn btn-ghost btn-icon" type="button" aria-label="Fermer" onClick={onClose}><i className="ph ph-x" /></button>
      </div>
      {body}
      <button className="btn btn-primary atlas-cta" type="button" onClick={onMeasure}><i className="ph ph-ruler" />Mesurer une distance</button>
    </aside>
  );
}
