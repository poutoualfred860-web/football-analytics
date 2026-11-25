import { useEffect, useState } from "react";
import { chargerMatchs } from "../services/matchs.js";
import { COMPETITIONS_PRINCIPALES } from "../config/competitions.js";

const FUSEAU = "Africa/Porto-Novo";

// Un match peut recevoir plus tard deux champs facultatifs :
//   analyse: { niveau: "VERT" | "ORANGE" | "ROUGE", score: nombre }
//   prediction: { ... }
// Tant qu'ils sont absents, les compteurs correspondants restent à 0.

function cleJour(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

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

function Ligne({ match, extra }) {
  const date = new Date(match.dateUTC);
  const aScore =
    match.scoreDomicile !== null &&
    match.scoreDomicile !== undefined &&
    match.scoreExterieur !== null &&
    match.scoreExterieur !== undefined;
  const info = aScore
    ? `${match.scoreDomicile} - ${match.scoreExterieur}`
    : `${formatDate(date)} · ${formatHeure(date)}`;

  return (
    <li className="ligne-match">
      <span className="ligne-comp">{match.competition}</span>
      <span className="ligne-equipes">
        {match.domicile.nom} - {match.exterieur.nom}
      </span>
      <span className="ligne-info">{extra || info}</span>
    </li>
  );
}

function Bloc({ titre, vide, liste, children }) {
  return (
    <section className="bloc">
      <h2 className="bloc-titre">{titre}</h2>
      {liste && liste.length === 0 ? (
        <p className="bloc-vide">{vide}</p>
      ) : (
        children
      )}
    </section>
  );
}

export default function Dashboard() {
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
    return <div className="chargement">Chargement du tableau de bord…</div>;
  }
  if (erreur) {
    return <div className="erreur">{erreur}</div>;
  }

  const maintenant = new Date();
  const aujourdhui = cleJour(maintenant);

  const duJour = matchs.filter(
    (m) => cleJour(new Date(m.dateUTC)) === aujourdhui
  );
  const enDirect = matchs.filter((m) => m.statut === "LIVE");
  const analyses = matchs.filter((m) => m.analyse);
  const predictions = matchs.filter((m) => m.prediction);

  const resultats = matchs
    .filter((m) => m.statut === "TERMINE")
    .sort((a, b) => new Date(b.dateUTC) - new Date(a.dateUTC))
    .slice(0, 5);

  const prochains = matchs
    .filter((m) => m.statut === "A_VENIR" && new Date(m.dateUTC) >= maintenant)
    .sort((a, b) => new Date(a.dateUTC) - new Date(b.dateUTC))
    .slice(0, 5);

  const niveaux = { VERT: 0, ORANGE: 0, ROUGE: 0 };
  analyses.forEach((m) => {
    if (niveaux[m.analyse.niveau] !== undefined) niveaux[m.analyse.niveau] += 1;
  });

  const interessants = analyses
    .filter((m) => typeof m.analyse.score === "number")
    .sort((a, b) => b.analyse.score - a.analyse.score)
    .slice(0, 5);

  const competitions = COMPETITIONS_PRINCIPALES.map((c) => ({
    nom: c.nom,
    total: matchs.filter(
      (m) => String(m.competition || "").toLowerCase() === c.nom.toLowerCase()
    ).length
  }));

  const stats = [
    { label: "Matchs du jour", valeur: duJour.length },
    { label: "Matchs en direct", valeur: enDirect.length },
    { label: "Matchs analysés", valeur: analyses.length },
    { label: "Prédictions disponibles", valeur: predictions.length }
  ];

  return (
    <div className="dashboard">
      <div className="grille-stats">
        {stats.map((s) => (
          <div key={s.label} className="carte-stat">
            <div className="stat-valeur">{s.valeur}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <Bloc
        titre="Matchs les plus intéressants statistiquement"
        liste={interessants}
        vide="Aucune analyse statistique disponible pour le moment. Cette zone se remplira quand le moteur d'analyse sera branché."
      >
        <ul className="liste-lignes">
          {interessants.map((m) => (
            <Ligne
              key={m.id}
              match={m}
              extra={`${m.analyse.niveau || ""} · indice ${m.analyse.score}`}
            />
          ))}
        </ul>
      </Bloc>

      <div className="grille-blocs">
        <Bloc
          titre="Prochains matchs"
          liste={prochains}
          vide="Aucun match à venir."
        >
          <ul className="liste-lignes">
            {prochains.map((m) => (
              <Ligne key={m.id} match={m} />
            ))}
          </ul>
        </Bloc>

        <Bloc
          titre="Derniers résultats"
          liste={resultats}
          vide="Aucun résultat disponible."
        >
          <ul className="liste-lignes">
            {resultats.map((m) => (
              <Ligne key={m.id} match={m} />
            ))}
          </ul>
        </Bloc>
      </div>

      <div className="grille-blocs">
        <Bloc titre="Résumé des analyses automatiques">
          {analyses.length === 0 ? (
            <p className="bloc-vide">
              Aucune analyse disponible pour le moment.
            </p>
          ) : null}
          <div className="niveaux">
            <div className="niveau vert">
              <strong>{niveaux.VERT}</strong>
              <span>VERT</span>
            </div>
            <div className="niveau orange">
              <strong>{niveaux.ORANGE}</strong>
              <span>ORANGE</span>
            </div>
            <div className="niveau rouge">
              <strong>{niveaux.ROUGE}</strong>
              <span>ROUGE</span>
            </div>
          </div>
        </Bloc>

        <Bloc titre="Principales compétitions">
          <ul className="liste-competitions">
            {competitions.map((c) => (
              <li key={c.nom} className="competition">
                <span>{c.nom}</span>
                <strong>{c.total}</strong>
              </li>
            ))}
          </ul>
        </Bloc>
      </div>
    </div>
  );
}
