import { useEffect, useState } from "react";
import { chargerMatchs } from "../services/matchs.js";

const FUSEAU = "Africa/Porto-Novo";

const ONGLETS = [
  { id: "live", label: "En direct" },
  { id: "aujourdhui", label: "Aujourd'hui" },
  { id: "avenir", label: "À venir" },
  { id: "termines", label: "Terminés" }
];

const MESSAGES_VIDES = {
  live: "Aucun match en direct pour le moment.",
  aujourdhui: "Aucun match aujourd'hui.",
  avenir: "Aucun match à venir.",
  termines: "Aucun match terminé."
};

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

function filtrer(matchs, onglet) {
  const aujourdhui = cleJour(new Date());
  return matchs.filter((m) => {
    const jour = cleJour(new Date(m.dateUTC));
    if (onglet === "live") return m.statut === "LIVE";
    if (onglet === "aujourdhui") return jour === aujourdhui;
    if (onglet === "avenir") return m.statut === "A_VENIR" && jour > aujourdhui;
    if (onglet === "termines") return m.statut === "TERMINE";
    return false;
  });
}

function trier(liste, onglet) {
  const copie = [...liste];
  copie.sort((a, b) => new Date(a.dateUTC) - new Date(b.dateUTC));
  if (onglet === "termines") copie.reverse();
  return copie;
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

function CarteMatch({ match }) {
  const date = new Date(match.dateUTC);
  const aDesScores =
    match.scoreDomicile !== null &&
    match.scoreDomicile !== undefined &&
    match.scoreExterieur !== null &&
    match.scoreExterieur !== undefined;

  let statutTexte = `${formatDate(date)} · ${formatHeure(date)}`;
  let statutClasse = "statut";
  if (match.statut === "LIVE") {
    statutTexte = match.minute ? `● EN DIRECT ${match.minute}'` : "● EN DIRECT";
    statutClasse = "statut live";
  } else if (match.statut === "TERMINE") {
    statutTexte = "Terminé";
  }

  return (
    <article className="carte-match">
      <div className="carte-entete">
        <span>{match.competition}</span>
        <span className={statutClasse}>{statutTexte}</span>
      </div>
      <div className="equipes">
        <div className="equipe">
          <LogoEquipe equipe={match.domicile} />
          <span>{match.domicile.nom}</span>
        </div>
        <div className="score">
          {aDesScores
            ? `${match.scoreDomicile} - ${match.scoreExterieur}`
            : formatHeure(date)}
        </div>
        <div className="equipe">
          <LogoEquipe equipe={match.exterieur} />
          <span>{match.exterieur.nom}</span>
        </div>
      </div>
    </article>
  );
}

export default function Matchs() {
  const [onglet, setOnglet] = useState("aujourdhui");
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

  const liste = trier(filtrer(matchs, onglet), onglet);

  return (
    <section>
      <nav className="onglets">
        {ONGLETS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={o.id === onglet ? "onglet actif" : "onglet"}
            onClick={() => setOnglet(o.id)}
          >
            {o.label}
          </button>
        ))}
      </nav>

      {chargement && <div className="chargement">Chargement des matchs…</div>}
      {!chargement && erreur && <div className="erreur">{erreur}</div>}
      {!chargement && !erreur && liste.length === 0 && (
        <div className="vide">{MESSAGES_VIDES[onglet]}</div>
      )}
      {!chargement && !erreur && liste.length > 0 && (
        <div className="liste">
          {liste.map((m) => (
            <CarteMatch key={m.id} match={m} />
          ))}
        </div>
      )}
    </section>
  );
}
