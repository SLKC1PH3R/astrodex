"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { api } from "@/lib/api";
import { Avatar, fr } from "@/lib/social";

/* Onglet « Classement » : podium des trois premiers, tableau, ligne du joueur toujours visible.
   Types : collection (cartes différentes), semaine (nouvelles cartes des 7 derniers jours),
   bataille (points de rang) et guildes (points de la semaine).
   Styles : app/social.css (.sx-*, .rk-*). */

const TYPES = [
  { id: "collection", label: "Collection", extra: "Légendaires", vide: "Ouvre un booster pour prendre la tête !" },
  { id: "semaine", label: "Cette semaine", extra: "Légendaires", vide: "Ouvre un booster pour prendre la tête !" },
  { id: "bataille", label: "Bataille", extra: "Victoires", vide: "Lance une bataille pour entrer au classement !" },
  { id: "guildes", label: "Guildes", extra: "Membres", vide: "Fonde la première guilde !" },
];
// Les guildes arrivent dans un autre format : on les présente comme des lignes de classement.
const guildRanking = list => ({
  libelle: "pts cette semaine", participants: list.length, moi: null,
  joueurs: list.map(g => ({ rang: g.rang, id: `g${g.id}`, pseudo: g.nom, titre: `Niveau ${g.niveau}`, valeur: g.points_semaine, legendaires: g.membres, guilde: true })),
});
const PODIUM = [ // ordre d'affichage : 2e, 1er, 3e
  { i: 1, h: 110, c: "#cfd3e5", bg: "rgba(207,211,229,.3)", s: 60 },
  { i: 0, h: 150, c: "#ffcf6b", bg: "rgba(255,207,107,.35)", s: 76 },
  { i: 2, h: 84, c: "#e9b48a", bg: "rgba(215,154,106,.3)", s: 56 },
];
const profile = id => `/jeu/profil?id=${encodeURIComponent(id)}`;

export default function ClassementPage() {
  const [type, setType] = useState("collection");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(null);
    (type === "guildes" ? api.guildes().then(guildRanking) : api.classement(type)).then(setData).catch(e => setError(e.message));
  }, [type]);

  const top = data?.joueurs || [];
  const rest = top.slice(3);
  const meOutside = data?.moi && !top.some(j => j.moi);
  const T = TYPES.find(t => t.id === type);

  return (
    <>
      <Topbar title="Classement" sub={data ? type === "guildes" ? `${fr(data.participants)} guilde${data.participants > 1 ? "s" : ""}` : `${fr(data.participants)} joueur${data.participants > 1 ? "s" : ""} classé${data.participants > 1 ? "s" : ""}` : ""} />
      <section className="sx-page">
        <div className="sx-tabs" role="tablist" aria-label="Type de classement">
          {TYPES.map(t => <button key={t.id} type="button" role="tab" className="sx-tab" aria-selected={type === t.id} onClick={() => setType(t.id)}>{t.label}</button>)}
        </div>
        {error && <p className="ax-notice"><strong>Oups.</strong> {error}</p>}
        {data && top.length === 0 && <p className="sx-empty">Personne n'est encore classé{type === "semaine" ? " cette semaine" : ""}. {T.vide}</p>}
        {data && top.length > 0 && (
          <div className="sx-row" style={{ alignItems: "flex-start" }}>
            <section className="rk-podium" aria-label="Podium">
              {PODIUM.map(pl => {
                const j = top[pl.i];
                if (!j) return <div key={pl.i} />;
                return (
                  <div key={pl.i} className="rk-pod">
                    {pl.i === 0 && <i className="ph-fill ph-crown-simple" aria-hidden="true" style={{ color: "#ffcf6b", fontSize: 26 }} />}
                    <Link href={j.guilde ? "/jeu/guilde" : profile(j.id)} aria-label={j.guilde ? j.pseudo : `Profil de ${j.pseudo}`}>
                      <Avatar id={j.id} pseudo={j.pseudo} size={pl.s} style={{ boxShadow: `0 0 0 3px ${pl.c}` }} />
                    </Link>
                    <b>{j.pseudo}{j.moi ? " (toi)" : ""}</b>
                    <span className="sx-muted">{fr(j.valeur)} {data.libelle}</span>
                    <div className="rk-step" style={{ height: pl.h, background: `linear-gradient(180deg, ${pl.bg}, transparent)`, color: pl.c }}>{j.rang}</div>
                  </div>
                );
              })}
            </section>

            <section className="rk-table" aria-label="Classement complet">
              <table>
                <thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col" className="num">{data.libelle}</th><th scope="col" className="num">{T.extra}</th></tr></thead>
                <tbody>
                  {rest.map(j => <Row key={j.id} j={j} />)}
                  {meOutside && <Row j={data.moi} />}
                </tbody>
              </table>
              {rest.length === 0 && !meOutside && <p className="sx-muted" style={{ padding: "12px 16px", margin: 0 }}>Seuls les trois premiers sont classés pour l'instant.</p>}
              {!data.moi && type !== "guildes" && <p className="sx-muted" style={{ padding: "12px 16px", margin: 0 }}>Tu n'es pas encore classé ici. {T.vide}</p>}
            </section>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ j }) {
  return (
    <tr className={j.moi ? "is-me" : undefined}>
      <td>{j.rang}</td>
      <td>
        <Link className="rk-who" href={j.guilde ? "/jeu/guilde" : profile(j.id)}>
          <Avatar id={j.id} pseudo={j.pseudo} size={30} />{j.pseudo}{j.moi ? " (toi)" : ""}
          {j.titre && <span className="sx-muted">· {j.titre}</span>}
        </Link>
      </td>
      <td className="num">{fr(j.valeur)}</td>
      <td className="num" style={{ color: j.guilde ? undefined : "#ffcf6b" }}>{fr(j.legendaires)}</td>
    </tr>
  );
}
