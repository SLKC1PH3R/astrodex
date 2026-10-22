"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
import { usePlayer } from "@/components/PlayerProvider";
import { api } from "@/lib/api";
import { Avatar, ago, fr } from "@/lib/social";

/* Administration des comptes (réservée aux administrateurs, rôle donné par ADMIN_EMAILS côté serveur) :
   chiffres clés, nettoyage des profils invités, recherche, suppression (un ou plusieurs), nouveau mot de passe.
   Styles : app/observatoire.css (.gm-*), app/social.css (.sx-*). */

const TYPES = [["tous", "Tous"], ["comptes", "Comptes e-mail"], ["invites", "Invités"]];
const SORTS = [["recent", "Inscription récente"], ["actif", "Dernière activité"], ["cartes", "Plus de cartes"], ["pseudo", "Pseudo A → Z"]];
const ACTIVITY = [["0", "Toute activité"], ["7", "Inactifs depuis 7 j"], ["30", "Inactifs depuis 30 j"], ["90", "Inactifs depuis 90 j"]];
const STATS = [["comptes", "Profils"], ["avec_email", "Comptes e-mail"], ["invites", "Invités"], ["invites_vides", "Invités sans carte"], ["actifs_7j", "Actifs 7 j"], ["nouveaux_24h", "Nouveaux 24 h"]];

function Confirm({ title, children, action, danger, onClose, onDone }) {
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = async e => {
    e.preventDefault(); setBusy(true);
    try { onDone(await action(new FormData(e.target))); onClose(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="sx-modal-bg" onClick={onClose}>
      <form className="sx-modal pf-form" role="dialog" aria-modal="true" aria-labelledby="gm-dlg" onClick={e => e.stopPropagation()} onSubmit={go} style={{ width: "min(480px, 100%)" }}>
        <h2 id="gm-dlg">{title}</h2>
        {children}
        {err && <p className="cm-msg err">{err}</p>}
        <div className="sx-modal-foot">
          <button type="button" className="sx-btn alt" onClick={onClose}>Annuler</button>
          <button type="submit" className={`sx-btn${danger ? " danger" : ""}`} disabled={busy}>{danger ? "Supprimer" : "Valider"}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const { stats: me } = usePlayer();
  const [stats, setStats] = useState(null);
  const [f, setF] = useState({ q: "", type: "tous", tri: "recent", inactif: "0", page: 1 });
  const [data, setData] = useState(null);
  const [sel, setSel] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [purge, setPurge] = useState({ jours: 30, vides: true, comptes: false, apercu: null });
  const [msg, setMsg] = useState(null);
  const [denied, setDenied] = useState(false);

  const loadStats = useCallback(() => api.adminStats().then(setStats).catch(e => setDenied(/administrateur/i.test(e.message))), []);
  const loadList = useCallback(() => api.adminJoueurs({ ...f, q: f.q.trim(), inactif: f.inactif === "0" ? "" : f.inactif }).then(d => { setData(d); setSel([]); }).catch(() => {}), [f]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [loadList]);
  useEffect(() => { setPurge(p => ({ ...p, apercu: null })); }, [purge.jours, purge.vides, purge.comptes]);

  const refresh = text => { setMsg(text); loadStats(); loadList(); };
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value, page: k === "page" ? Number(e.target.value) : 1 }));
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const selectable = (data?.joueurs || []).filter(j => !j.is_admin);
  const allOn = selectable.length > 0 && selectable.every(j => sel.includes(j.id));

  if (denied) {
    return (
      <>
        <Topbar title="Administration" />
        <section className="sx-page"><p className="sx-empty">Cette page est réservée aux administrateurs.</p></section>
      </>
    );
  }

  return (
    <>
      <Topbar title="Administration" sub="Comptes des joueurs" />
      <section className="sx-page">
        {msg && <p role="status" className="cm-msg">{msg}</p>}
        <div className="gm-stats">
          {STATS.map(([k, l]) => <div key={k} className="pf-stat"><b>{stats ? fr(stats[k]) : "…"}</b><span>{l}</span></div>)}
        </div>

        <section className="sx-pane" aria-labelledby="gm-purge">
          <div className="sx-head">
            <h2 id="gm-purge" className="sx-lbl">Supprimer les profils inactifs</h2>
            <span className="sx-muted">Les administrateurs ne sont jamais supprimés</span>
          </div>
          <div className="gm-purge">
            <label>Inactifs depuis
              <span className="gm-inline"><input className="input" type="number" min={0} max={3650} value={purge.jours} onChange={e => setPurge(p => ({ ...p, jours: Number(e.target.value) }))} /> jours</span>
            </label>
            <label className="gm-check"><input type="checkbox" checked={purge.comptes} onChange={e => setPurge(p => ({ ...p, comptes: e.target.checked }))} />Inclure les comptes e-mail (sinon : invités seulement)</label>
            <label className="gm-check"><input type="checkbox" checked={purge.vides} onChange={e => setPurge(p => ({ ...p, vides: e.target.checked }))} />Seulement ceux qui n'ont aucune carte</label>
            <button type="button" className="sx-btn alt sm" onClick={() => api.adminPurge(purge.jours, purge.vides, false, purge.comptes).then(r => setPurge(p => ({ ...p, apercu: r.concernes })))}>Compter</button>
            {purge.apercu != null && (
              purge.apercu === 0 ? <span className="sx-muted">Aucun profil concerné.</span> : (
                <button type="button" className="sx-btn danger sm" onClick={() => setDialog({ kind: "purge" })}>Supprimer {fr(purge.apercu)} profil{purge.apercu > 1 ? "s" : ""}</button>
              )
            )}
          </div>
        </section>

        <div className="gm-tools">
          <div className="sx-tabs" role="tablist" aria-label="Type de profil">
            {TYPES.map(([id, l]) => <button key={id} type="button" role="tab" className="sx-tab" aria-selected={f.type === id} onClick={() => setF(x => ({ ...x, type: id, page: 1 }))}>{l}</button>)}
          </div>
          <div className="gm-filters">
            <input className="input" value={f.q} onChange={set("q")} placeholder="Pseudo, e-mail ou identifiant" aria-label="Chercher un joueur" />
            <select className="input" value={f.inactif} onChange={set("inactif")} aria-label="Activité">{ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select className="input" value={f.tri} onChange={set("tri")} aria-label="Trier">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            {sel.length > 0 && <button type="button" className="sx-btn danger sm" onClick={() => setDialog({ kind: "bulk" })}>Supprimer la sélection · {sel.length}</button>}
          </div>
        </div>

        <div className="gm-table">
          <table>
            <thead>
              <tr>
                <th scope="col" className="gm-cb"><input type="checkbox" aria-label="Tout sélectionner" checked={allOn} onChange={() => setSel(allOn ? [] : selectable.map(j => j.id))} /></th>
                <th scope="col">Joueur</th>
                <th scope="col">Inscrit</th>
                <th scope="col">Vu</th>
                <th scope="col" className="num">Cartes</th>
                <th scope="col" className="num">Boosters</th>
                <th scope="col" className="num">Appareils</th>
                <th scope="col"><span className="sx-sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data?.joueurs.map(j => (
                <tr key={j.id} className={sel.includes(j.id) ? "on" : undefined}>
                  <td className="gm-cb">{!j.is_admin && <input type="checkbox" aria-label={`Sélectionner ${j.pseudo}`} checked={sel.includes(j.id)} onChange={() => toggle(j.id)} />}</td>
                  <td>
                    <Link className="gm-who" href={`/jeu/profil?id=${encodeURIComponent(j.id)}`}>
                      <Avatar id={j.id} pseudo={j.pseudo} size={32} />
                      <span><b>{j.pseudo}{j.is_admin && <em className="gm-role">Admin</em>}{me?.id === j.id && " (toi)"}</b>
                        <small>{j.email || "Invité, sans e-mail"}</small></span>
                    </Link>
                  </td>
                  <td>{new Date(j.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "2-digit" })}</td>
                  <td>{j.last_seen ? ago(j.last_seen) : "—"}</td>
                  <td className="num">{fr(j.cartes)}</td>
                  <td className="num">{fr(j.boosters)}</td>
                  <td className="num">{fr(j.appareils)}</td>
                  <td className="gm-actions">
                    {j.email && <button type="button" className="sx-btn alt sm" onClick={() => setDialog({ kind: "pwd", j })}>Mot de passe</button>}
                    {!j.is_admin && <button type="button" className="sx-btn danger sm" onClick={() => setDialog({ kind: "one", j })}>Supprimer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.joueurs.length === 0 && <p className="sx-empty" style={{ margin: 16 }}>Aucun joueur ne correspond.</p>}
        </div>
        {data && data.pages > 1 && (
          <div className="gm-pages">
            <button type="button" className="sx-btn alt sm" disabled={f.page <= 1} onClick={() => setF(x => ({ ...x, page: x.page - 1 }))}>Précédent</button>
            <span className="sx-muted">Page {data.page} / {data.pages} · {fr(data.total)} profils</span>
            <button type="button" className="sx-btn alt sm" disabled={f.page >= data.pages} onClick={() => setF(x => ({ ...x, page: x.page + 1 }))}>Suivant</button>
          </div>
        )}
      </section>

      {dialog?.kind === "one" && (
        <Confirm title={`Supprimer ${dialog.j.pseudo} ?`} danger onClose={() => setDialog(null)}
          action={() => api.adminSupprimer(dialog.j.id)} onDone={() => refresh(`${dialog.j.pseudo} a été supprimé.`)}>
          <p className="gm-p">Sa collection, ses éclats, ses messages, ses annonces et son historique seront effacés définitivement. {dialog.j.email && `L'e-mail ${dialog.j.email} pourra à nouveau servir à créer un compte.`}</p>
        </Confirm>
      )}
      {dialog?.kind === "bulk" && (
        <Confirm title={`Supprimer ${sel.length} profil${sel.length > 1 ? "s" : ""} ?`} danger onClose={() => setDialog(null)}
          action={() => api.adminSupprimerPlusieurs(sel)} onDone={r => refresh(`${r.supprime} profil${r.supprime > 1 ? "s" : ""} supprimé${r.supprime > 1 ? "s" : ""}.`)}>
          <p className="gm-p">Toutes leurs données seront effacées définitivement. Les comptes administrateurs ne sont jamais supprimés.</p>
        </Confirm>
      )}
      {dialog?.kind === "purge" && (
        <Confirm title={`Supprimer ${fr(purge.apercu)} profil${purge.apercu > 1 ? "s" : ""} inactif${purge.apercu > 1 ? "s" : ""} ?`} danger onClose={() => setDialog(null)}
          action={() => api.adminPurge(purge.jours, purge.vides, true, purge.comptes)}
          onDone={r => { setPurge(p => ({ ...p, apercu: null })); refresh(`${fr(r.supprime)} profil${r.supprime > 1 ? "s" : ""} inactif${r.supprime > 1 ? "s" : ""} supprimé${r.supprime > 1 ? "s" : ""}.`); }}>
          <p className="gm-p">{purge.comptes ? "Invités et comptes e-mail" : "Profils invités (sans e-mail)"} inactifs depuis {purge.jours} jour{purge.jours > 1 ? "s" : ""}{purge.vides ? ", sans aucune carte" : ""}. Leurs données seront effacées définitivement.</p>
        </Confirm>
      )}
      {dialog?.kind === "pwd" && (
        <Confirm title={`Nouveau mot de passe pour ${dialog.j.pseudo}`} onClose={() => setDialog(null)}
          action={fd => api.adminMotDePasse(dialog.j.id, String(fd.get("nouveau") || ""))}
          onDone={() => refresh(`Mot de passe de ${dialog.j.pseudo} changé : transmets-le lui, ses appareils ont été déconnectés.`)}>
          <label>Mot de passe (8 caractères minimum)
            <input className="input" name="nouveau" type="text" minLength={8} required autoComplete="off" autoFocus />
          </label>
          <span className="sx-muted">Pour un joueur qui a oublié le sien. Il pourra le changer ensuite dans ses Paramètres.</span>
        </Confirm>
      )}
    </>
  );
}
