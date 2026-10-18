/* Visuel statique d'un paquet scellé (sans la bande à déchirer), utilisé dans les carrousels
   3D de BoosterCarousel.js et PackPicker.js. Styles : app/coverflow.css (.pka-*). */
export default function PackArt({ theme, roman, nbCartes }) {
  return (
    <span className="pka-pack" style={{ "--cc": theme.couleur }}>
      <span className="pka-foil" />
      <span className="pka-brand">ASTRODEX</span>
      <span className="pka-port">
        {theme.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={`pka-art ${theme.cadrage}`} src={theme.image} alt="" draggable={false} />
        )}
      </span>
      <span className="pka-title"><small>BOOSTER</small><b>{theme.titre}</b></span>
      <span className="pka-foot"><span>SÉRIE {roman}</span><span>{nbCartes} CARTES</span></span>
      <span className="pka-seal" />
    </span>
  );
}
