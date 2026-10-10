/* Coffret 3D (épaisseur 28 px), de face par défaut, incliné au survol. Styles : app/coffret.css (.cf-*). */

export default function Coffret({ theme, nbCartes = 5, roman = "I", lid = "closed", shake = false }) {
  return (
    <div className="cf" style={{ "--cc": theme.couleur }} data-lid={lid}>
      <div className="cf-box">
        <div className={shake ? "cf-body cf-shake" : "cf-body"}>
          <div className="cf-side"><div><span>ASTRODEX</span></div></div>
          <div className="cf-top" />
          <div className="cf-front">
            <div className="cf-lacquer">
              <div className="cf-ring" />
              <div className="cf-port">
                <div className="cf-port-in">
                  {theme.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={`cf-art ${theme.cadrage}`} src={theme.image} alt="" draggable={false} />
                  )}
                </div>
              </div>
              <div className="cf-dash" />
              <div className="cf-title">
                <span>BOOSTER</span>
                <b>{theme.titre.toUpperCase()}</b>
              </div>
              <div className="cf-foot"><span>SÉRIE {roman}</span><span>{nbCartes} CARTES</span></div>
            </div>
          </div>
          <div className="cf-lid">
            <div className="cf-lid-top"><div><b>ASTRODEX</b></div></div>
            <div className="cf-lid-side" />
            <div className="cf-lid-front"><div><b>ASTRODEX</b></div></div>
          </div>
          <div className="cf-seam" />
        </div>
      </div>
    </div>
  );
}
