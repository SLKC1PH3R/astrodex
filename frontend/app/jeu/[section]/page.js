"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import Topbar from "@/components/Topbar";
import { findSection } from "@/lib/menu";

/* Sections du menu pas encore développées : Échanges, Marché, Profil, Guilde, Amis, Messages, Bataille, Succès, Classement, Paramètres. */
export default function SectionPage() {
  const { section } = useParams();
  const m = findSection(section);
  if (!m) notFound();

  return (
    <>
      <Topbar title={m.label} />
      <section className="ax-empty">
        <div>
          <i className={`ph ${m.icon}`} />
          <h4>{m.label}</h4>
          <p>{m.empty}</p>
          <Link className="btn btn-primary" href="/jeu" style={{ marginTop: 6 }}>Ouvrir un booster</Link>
        </div>
      </section>
    </>
  );
}
