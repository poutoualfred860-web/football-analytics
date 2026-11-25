import { useEffect, useState } from "react";
import { chargerMatchs } from "../services/matchs.js";
import { AVERTISSEMENT } from "../prediction/moteur.js";

const FUSEAU = "Africa/Porto-Novo";
const GROUPES = ["Résultat", "Double chance", "Buts", "Autres marchés"];
const CLASSES_CONFIANCE = {
  "Élevée": "haute",
  Moyenne: "moyenne",
  Faible: "faible"
};

function formatHeure(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU,
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

function LogoEquipe({ equipe }) {
  if (equipe.logo) {
    return (
      <img
        className="logo-equipe"
        src={equipe.logo}
        alt={equipe.nom}
        loading="lazy"
      />
    );
  }
  return <div className="logo-vide">{equipe.nom.slice(0, 2).toUpperCase()}</div>;
}

function Marche({ marche }) {
  const [ouvert, setOuvert] = useState(false);
  const classe = CLASSES_CONFIANCE[marche.confiance.niveau] || "faible";

  return (
    <li className="marche">
      <button
        type="button"
        className="marche-bouton"
        aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}
      >
        <span className="marche-nom">{marche.marche}</span>
        <span className="marche-proba">{marche.probabilite} %</span>
        <span className="barre">
          <span
            className="barre-remplie"
            style={{ width: `${marche.probabilite}%` }}
          />
        </span>
        <span className="marche-meta">
          <span className={`badge confiance-${classe}`}>
            Confiance : {marche.confiance.niveau}
          </span>
          <span className="badge">Données : {marche.qualiteDonnees}</span>
          <span className="marche-plus">{ouvert ? "Masquer ▲" : "Raisons ▼"}</span>
        </span>
      </button>

      {ouvert && (
        <ul className="raisons">
          {marche.raisons.map((raison, i) => (
            <li key={i}>{raison}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function CartePrediction({ match }) {
  const [ouvert, setOuvert] = useState(false);
  const p = match.prediction;
  const date = new Date(match.dateUTC);

  return (
    <article className={ouvert ? "carte-pred ouverte" : "carte-pred"}>
      <button
        type="button"
        className="pred-bouton"
        aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}
      >
        <div className="carte-entete">
          <span>
            {match.competition} · {formatDate(date)} {formatHeure(date)}
          </span>
          <span className="statut">Données : {p.qualiteDonnees.niveau}</span>
        </div>
        <div className="equipes">
          <div className="equipe">
            <LogoEquipe equipe={match.domicile} />
            <span>{match.domicile.nom}</span>
          </div>
          <div className="score">
            {p.butsAttendus.domicile} - {p.butsAttendus.exterieur}
          </div>
          <div className="equipe">
            <LogoEquipe equipe={match.exterieur} />
            <span>{match.exterieur.nom}</span>
          </div>
        </div>
        <div className="carte-bascule">
          Buts attendus ·{" "}
          {ouvert ? "Masquer les prédictions ▲" : "Voir les prédictions ▼"}
        </div>
      </button>

      {ouvert && (
        <div className="pred-contenu">
          <p className="avertissement">{p.avertissement}</p>

          <h3 className="stats-sous-titre">Qualité des données</h3>
          <ul className="details-qualite">
            <li>
              Qualité globale : {p.qualiteDonnees.niveau} ({p.qualiteDonnees.score}
              /100)
            </li>
            {p.qualiteDonnees.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
            <li>Modèles utilisés : {p.modeles.join(" + ")}.</li>
            {p.elo && (
              <li>
                Classement Elo : {match.domicile.nom} {p.elo.domicile} –{" "}
                {match.exterieur.nom} {p.elo.exterieur}.
              </li>
            )}
          </ul>

          <h3 className="stats-sous-titre">Scores les plus probables</h3>
          <div className="scores-probables">
            {p.scoresProbables.map((s) => (
              <span key={s.score} className="puce-score">
                {s.score} · {s.probabilite} %
              </span>
            ))}
          </div>

          {GROUPES.map((groupe) => {
            const liste = p.marches.filter((m) => m.groupe === groupe);
            if (liste.length === 0) return null;
            return (
              <div key={groupe}>
                <h3 className="stats-sous-titre">{groupe}</h3>
                <ul className="liste-marches">
                  {liste.map((m) => (
                    <Marche key={m.id} marche={m} />
                  ))}
                </ul>
              </div>
            );
          })}

          {p.indisponibles.length > 0 && (
            <div>
              <h3 className="stats-sous-titre">Marchés indisponibles</h3>
              <ul className="details-qualite">
                {p.indisponibles.map((x) => (
                  <li key={x.marche}>
                    {x.marche} : {x.raison}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function Predictions() {
  const [matchs, setMatchs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let actif = true;

    async function charger() {
      try {
        const donnees = await chargerMatchs();
        if (!actif) return;
        setMatchs(donnees);
        setErreur(null);
      } catch (e) {
        if (!actif) return;
        setErreur("Impossible de charger les matchs pour le moment.");
      } finally {
        if (actif) setChargement(false);
      }
    }

    charger();
    const minuteur = setInterval(charger, 60000);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, []);

  if (chargement) {
    return <div className="chargement">Chargement des prédictions…</div>;
  }
  if (erreur) {
    return <div className="erreur">{erreur}</div>;
  }

  const liste = matchs
    .filter((m) => m.prediction)
    .sort((a, b) => new Date(a.dateUTC) - new Date(b.dateUTC));

  return (
    <section>
      <p className="avertissement">{AVERTISSEMENT}</p>

      {liste.length === 0 ? (
        <div className="vide">
          Aucune prédiction disponible pour le moment. Une prédiction n'apparaît
          que lorsque les données suffisent : au moins 5 matchs terminés par
          équipe et 30 par compétition. Aucun pourcentage n'est inventé.
        </div>
      ) : (
        <div className="liste">
          {liste.map((m) => (
            <CartePrediction key={m.id} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}
