Statistiques d'un match. Elles viennent du champ facultatif match.stats :
 {
  possession:    { domicile: 55, exterieur: 45 },
   tirs:          { domicile: 12, exterieur: 7 },
   tirsCadres:    { domicile: 5,  exterieur: 2 },
  corners:       { domicile: 6,  exterieur: 3 },
  fautes:        { domicile: 9,  exterieur: 11 },
   cartonsJaunes: { domicile: 1,  exterieur: 2 },
  cartonsRouges: { domicile: 0,  exterieur: 0 },
  xg:            { domicile: 1.42, exterieur: 0.67 },
 buteurs: [{ joueur: "Nom", minute: 23, equipe: "domicile" | "exterieur" }]
}
Toute donnée absente s'affiche « Donnée indisponible ». Rien n'est inventé.

const INDISPONIBLE = "Donnée indisponible";

const LIGNES = [
  { cle: "possession", label: "Possession", suffixe: " %" },
  { cle: "tirs", label: "Tirs" },
  { cle: "tirsCadres", label: "Tirs cadrés" },
  { cle: "corners", label: "Corners" },
  { cle: "fautes", label: "Fautes" },
  { cle: "cartonsJaunes", label: "Cartons jaunes" },
  { cle: "cartonsRouges", label: "Cartons rouges" },
  { cle: "xg", label: "xG", decimales: 2 }
];

function estNombre(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function formater(valeur, ligne) {
  const texte = ligne.decimales
    ? valeur.toFixed(ligne.decimales)
    : String(valeur);
  return texte + (ligne.suffixe || "");
}

function Buteurs({ match }) {
  const buteurs = match.stats ? match.stats.buteurs : undefined;

  if (Array.isArray(buteurs) && buteurs.length > 0) {
    return (
      <ul className="buteurs">
        {buteurs.map((b, i) => (
          <li key={i}>
            <span>{b.minute !== undefined ? `${b.minute}'` : ""}</span>
            <span>{b.joueur}</span>
            <span className="buteur-equipe">
              {b.equipe === "exterieur" ? match.exterieur.nom : match.domicile.nom}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const zeroZero =
    match.scoreDomicile === 0 && match.scoreExterieur === 0;
  if (Array.isArray(buteurs) && buteurs.length === 0 && zeroZero) {
    return <p className="stat-indispo">Aucun but</p>;
  }

  return <p className="stat-indispo">{INDISPONIBLE}</p>;
}

export default function StatsMatch({ match }) {
  const stats = match.stats || {};

  return (
    <div className="stats-match">
      <div className="stats-equipes">
        <span>{match.domicile.nom}</span>
        <span>{match.exterieur.nom}</span>
      </div>

      <ul className="stats-liste">
        {LIGNES.map((ligne) => {
          const s = stats[ligne.cle] || {};
          const dispo = estNombre(s.domicile) && estNombre(s.exterieur);

          if (!dispo) {
            return (
              <li key={ligne.cle} className="stat-ligne indispo">
                <span className="stat-nom">{ligne.label}</span>
                <span className="stat-indispo">{INDISPONIBLE}</span>
              </li>
            );
          }

          return (
            <li key={ligne.cle} className="stat-ligne">
              <span className="stat-valeur-dom">
                {formater(s.domicile, ligne)}
              </span>
              <span className="stat-nom">{ligne.label}</span>
              <span className="stat-valeur-ext">
                {formater(s.exterieur, ligne)}
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="stats-sous-titre">Buteurs</h3>
      <Buteurs match={match} />
    </div>
  );
}
