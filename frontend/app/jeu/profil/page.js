"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import Carte from "@/components/Carte";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";
import { Avatar, fr } from "@/lib/social";
import { BlasonClasse, Embleme, LEVEL_TITLES, LevelBar, TitreAffiche } from "@/components/Progression";

/* Onglet « Profil » : bannière (pseudo, titre, emblème), niveau et XP, chiffres clés, vitrine de 5 cartes favorites,
   progression par série. /jeu/profil?id=… affiche le profil public d'un autre joueur (lecture seule).
   Styles : app/social.css (.sx-*, .pf-*). */

const SERIE_COLORS = { S1: "#ec8a2e", S2: "#c88c4a", S3: "#d4477c", S4: "#6b6ed9" };
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

export default function ProfilPage() {
  const { refresh } = usePlayer();
  const [other, setOther] = useState(undefined); // id d'un autre joueur, ou null pour soi
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => { setOther(new URLSearchParams(window.location.search).get("id")); }, []);
  useEffect(() => {
    if (other === undefined) return;
    (other ? api.profilJoueur(other) : api.profil()).then(setP).catch(e => setError(e.message));
  }, [other]);

  const save = async patch => {
    const next = await api.majProfil(patch);
    setP(next); refresh();
  };

  const mine = other === null;
  const serieDone = p?.series.filter(s => s.total && s.possedees === s.total).length || 0;

  return (
    <>
      <Topbar title={mine ? "Profil" : "Profil d'un joueur"} sub={p ? p.pseudo : ""} />
      <section className="sx-page">
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        {p && (
          <>
            <section className="pf-banner" aria-label="En-tête du profil">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/${p.banniere || "saturne"}.webp`} alt="" data-fond={p.banniere || "saturne"} />
              <Avatar id={p.id} pseudo={p.pseudo} img={p.avatar} size={104} style={{ boxShadow: "0 0 0 4px var(--color-bg), 0 0 0 6px var(--color-accent)" }} />
              <div className="pf-id">
                <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {!LEVEL_TITLES.some(([, t]) => t === p.titre) && <Embleme e={p.progression.embleme} size={56} title={`Emblème ${p.progression.embleme.nom}`} />}
                  <TitreAffiche titre={p.titre} height={70} />
                </span>
                <h2>{p.pseudo}</h2>
                <span className="sx-muted" style={{ color: "var(--color-neutral-300)" }}>
                  Collectionneur depuis le {new Date(p.inscrit_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="pf-rk" aria-label={`Rang classé ${p.classe.libelle}`}>
                <BlasonClasse rang={p.classe} size={62} plaque />
                <span>{p.parties ? `${p.classe.libelle} · ${fr(p.classe.points)} points` : "Bataille classée · aucune partie"}</span>
                {mine && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" className="sx-btn alt" onClick={() => setEditing(true)}>Modifier le profil</button>
                  <button type="button" className="sx-btn alt" onClick={() => setPicking(true)}>Changer la vitrine</button>
                </div>
                )}
              </div>
            </section>

            <section className="pf-level" aria-label="Niveau">
              <Embleme e={p.progression.rang} size={58} />
              <div className="pf-level-id"><span>Rang</span><b>{p.progression.rang.nom}</b><span>{fr(p.progression.xp)} XP au total</span></div>
              <LevelBar prog={p.progression} />
              {mine && <div className="pf-level-id" style={{ minWidth: 120 }}><span>Réserve</span><b>{p.progression.reserve_max} boosters</b><span>+1 tous les 4 niveaux</span></div>}
            </section>

            <div className="pf-stats">
              <div className="pf-stat"><b>{fr(p.stats.cartes_uniques)}</b><span>cartes différentes</span></div>
              <div className="pf-stat"><b>{fr(p.stats.cartes_total)}</b><span>cartes au total</span></div>
              <div className="pf-stat"><b>{fr(p.stats.boosters_ouverts)}</b><span>boosters ouverts</span></div>
              <div className="pf-stat"><b style={{ color: "#ffcf6b" }}>{fr(p.stats.legendaires)}</b><span>Légendaires</span></div>
              <div className="pf-stat"><b style={{ color: "#c58bff" }}>{fr(p.stats.ultra_rares)}</b><span>Ultra rares</span></div>
              <div className="pf-stat"><b>{p.succes.debloques} / {p.succes.total}</b><span>succès débloqués</span></div>
            </div>

            <div className="sx-row">
              <section className="sx-pane sx-grow" aria-labelledby="pf-vit">
                <div className="sx-head">
                  <h2 id="pf-vit" className="sx-lbl">Vitrine · {p.favoris.length} / 5 cartes favorites</h2>
                  {mine && <button type="button" className="btn btn-ghost" onClick={() => setPicking(true)}>Changer</button>}
                </div>
                <div className="pf-vitrine">
                  {p.favoris.map(c => <div key={c.id}><Carte c={c} /></div>)}
                  {Array.from({ length: 5 - p.favoris.length }, (_, i) => (
                    mine
                      ? <button key={i} type="button" className="pf-slot" aria-label="Ajouter une carte à la vitrine" onClick={() => setPicking(true)}>+</button>
                      : <span key={i} className="pf-slot" style={{ cursor: "default" }} aria-hidden="true" />
                  ))}
                </div>
              </section>

              <section className="sx-pane sx-side" aria-labelledby="pf-ser">
                <h2 id="pf-ser" className="sx-lbl">Progression par série · {serieDone} complétée{serieDone > 1 ? "s" : ""}</h2>
                {p.series.map((s, i) => (
                  <div key={s.code} className="pf-serie">
                    <div><span>{ROMAN[i + 1] || s.code} · {s.nom}</span><b>{fr(s.possedees)} / {fr(s.total)}</b></div>
                    <div className="sx-bar" style={{ "--bc": SERIE_COLORS[s.code] }}><i style={{ width: `${s.total ? (s.possedees / s.total) * 100 : 0}%` }} /></div>
                  </div>
                ))}
                {mine && <Link href="/jeu/collection" className="sx-muted" style={{ marginTop: "auto", color: "var(--color-accent-300)" }}>Voir ma collection</Link>}
              </section>
            </div>
          </>
        )}
      </section>
      {editing && p && <EditDialog p={p} onClose={() => setEditing(false)} onSave={save} />}
      {picking && p && <VitrineDialog current={p.favoris.map(c => c.id)} onClose={() => setPicking(false)} onSave={save} />}
    </>
  );
}

const FS = { border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 };
const LG = { fontSize: 13, color: "var(--color-neutral-300)", marginBottom: 6 };

function EditDialog({ p, onClose, onSave }) {
  const [pseudo, setPseudo] = useState(p.pseudo === "Joueur" ? "" : p.pseudo);
  const [titre, setTitre] = useState(p.titre || "");
  const [embleme, setEmbleme] = useState(p.progression.embleme.id);
  const [avatar, setAvatar] = useState(p.avatar || "");
  const [banniere, setBanniere] = useState(p.banniere || "saturne");
  const [err, setErr] = useState(null);
  const submit = async e => {
    e.preventDefault();
    try { await onSave({ ...(pseudo.trim() ? { pseudo } : {}), titre, embleme, avatar, banniere }); onClose(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <form className="sx-modal" style={{ width: "min(620px, 100%)", maxHeight: "calc(100vh - 40px)", overflowY: "auto" }} onClick={e => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pf-edit">
        <h2 id="pf-edit">Modifier le profil</h2>
        <div className="pf-form">
          <label>Pseudo<input className="input" value={pseudo} onChange={e => setPseudo(e.target.value)} minLength={2} maxLength={24} placeholder="ex. orion42" /></label>
          <label>Titre affiché
            <select className="input" value={titre} onChange={e => setTitre(e.target.value)}>
              <option value="">Aucun titre</option>
              {p.titres_disponibles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {p.titres_disponibles.length === 0 && <span className="sx-muted">Débloque des succès et monte de niveau pour gagner des titres.</span>}
          <span className="sx-muted">Titres de niveau : {p.titres_niveau.map(t => `${t.titre} (niv. ${t.niveau})${t.debloque ? " ✓" : ""}`).join(" · ")}</span>
          <fieldset style={FS}>
            <legend style={LG}>Avatar</legend>
            <div className="pf-pics">
              <button type="button" className="pf-pic" aria-pressed={avatar === ""} onClick={() => setAvatar("")}>
                <Avatar id={p.id} pseudo={pseudo || p.pseudo} size={52} />Initiale
              </button>
              {p.avatars.map(a => (
                <button key={a.id} type="button" className="pf-pic" aria-pressed={avatar === a.id} onClick={() => setAvatar(a.id)}>
                  <Avatar id={p.id} pseudo={p.pseudo} img={a.id} size={52} />{a.nom}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset style={FS}>
            <legend style={LG}>Fond de la bannière</legend>
            <div className="pf-pics">
              {p.bannieres.map(b => (
                <button key={b.id} type="button" className="pf-pic" aria-pressed={banniere === b.id} onClick={() => setBanniere(b.id)}>
                  <span className="pf-thumb" style={{ backgroundImage: `url(/media/${b.id}.webp)` }} />{b.nom}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset style={FS}>
            <legend style={LG}>Emblème affiché</legend>
            <div className="pf-embs">
              {p.emblemes.map(e => (
                <button key={e.id} type="button" className="pf-emb-pick" aria-pressed={embleme === e.id} disabled={!e.debloque} onClick={() => setEmbleme(e.id)}
                  aria-label={e.debloque ? `Emblème ${e.nom}` : `Emblème ${e.nom}, débloqué au niveau ${e.niveau}`}>
                  <Embleme e={e} size={46} off={!e.debloque} />
                  {e.nom}<small>{e.debloque ? "Débloqué" : `Niveau ${e.niveau}`}</small>
                </button>
              ))}
            </div>
          </fieldset>
          {err && <span style={{ color: "#ffb3b3", fontSize: 13 }}>{err}</span>}
        </div>
        <div className="sx-modal-foot">
          <button type="button" className="sx-btn alt" onClick={onClose}>Annuler</button>
          <button type="submit" className="sx-btn">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

function VitrineDialog({ current, onClose, onSave }) {
  const [cards, setCards] = useState(null);
  const [sel, setSel] = useState(current);
  const [err, setErr] = useState(null);
  useEffect(() => {
    // les 150 cartes les plus puissantes : la vitrine sert à montrer ses plus belles prises
    api.collection().then(list => setCards([...list].sort((a, b) => b.puissance - a.puissance).slice(0, 150))).catch(e => setErr(e.message));
  }, []);
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : s.length < 5 ? [...s, id] : s));
  const submit = async () => {
    try { await onSave({ favoris: sel }); onClose(); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <div className="sx-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pf-vit-t">
        <h2 id="pf-vit-t">Choisis jusqu'à 5 cartes pour ta vitrine · {sel.length} / 5</h2>
        <div className="sx-modal-body">
          {!cards && !err && <p className="sx-muted">Chargement de ta collection…</p>}
          {cards && cards.length === 0 && <p className="sx-empty">Ta collection est vide : ouvre un booster d'abord.</p>}
          {cards && (
            <div className="sx-cards">
              {cards.map(c => {
                const k = sel.indexOf(c.id);
                return (
                  <button key={c.id} type="button" className="sx-pick" aria-pressed={k >= 0} aria-label={c.nom} onClick={() => toggle(c.id)}>
                    {k >= 0 && <span className="sx-n">{k + 1}</span>}
                    <Carte c={c} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {err && <span style={{ color: "#ffb3b3", fontSize: 13 }}>{err}</span>}
        <div className="sx-modal-foot">
          <button type="button" className="sx-btn alt" onClick={onClose}>Annuler</button>
          <button type="button" className="sx-btn" onClick={submit}>Enregistrer la vitrine</button>
        </div>
      </div>
    </div>
  );
}
