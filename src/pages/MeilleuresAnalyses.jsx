import { useEffect, useState } from "react";
import { chargerMatchs } from "../services/matchs.js";
import { matchsClasses } from "../analyse/classement.js";

const FUSEAU = "Africa/Porto-Novo";

const CATEGORIES = [
  {
    id: "VERT",
    classe: "vert",
    definition: "Données de bonne qualité et analyse suffisamment fiable."
  },
  {
    id: "ORANGE",
    classe: "orange",
    definition: "Données partielles ou incertitude importante."
  },
  {
    id: "ROUGE",
    classe: "rouge",
    definition: "Données insuffisantes ou analyse trop incertaine."
  }
];

function formatHeure(date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: FUSEAU,
    hour: "2-digit",
    minute: "2-digit"
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

function classeCategorie(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.classe : "rouge";
}

function CarteClassee({ match, rang }) {
  const [ouvert, setOuvert] = useState(false);
  const c = match.classement;
  const date = new Date(match.dateUTC);
  const classe = classeCategorie(c.categorie);

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
            <span className="rang">#{rang}</span> {match.competition} ·{" "}
            {formatHeure(date)}
          </span>
          <span className={`badge-cat ${classe}`}>
            {c.categorie} · {c.score}/100
          </span>
        </div>
        <div className="equipes">
          <div className="equipe">
            <LogoEquipe equipe={match.domicile} />
            <span>{match.domicile.nom}</span>
          </div>
          <div className="score">vs</div>
          <div className="equipe">
            <LogoEquipe equipe={match.exterieur} />
            <span>{match.exterieur.nom}</span>
          </div>
        </div>
        <div className="carte-bascule">
          {ouvert ? "Masquer le détail ▲" : "Voir le détail du classement ▼"}
        </div>
      </button>

      {ouvert && (
        <div className="pred-contenu">
          <h3 className="stats-sous-titre">Les 6 critères</h3>
          <ul className="liste-criteres">
            {c.criteres.map((cr) => (
              <li key={cr.id} className="critere">
                <div className="critere-tete">
                  <span>
                    {cr.nom} ({cr.poids} %)
                  </span>
                  <strong>
                    {cr.score === null ? "Indisponible" : `${cr.score}/100`}
                  </strong>
                </div>
                <span className="barre">
                  <span
                    className="barre-remplie"
                    style={{ width: `${cr.score === null ? 0 : cr.score}%` }}
                  />
                </span>
                <p className="critere-detail">{cr.detail}</p>
              </li>
            ))}
          </ul>

          {c.forces.length > 0 && (
            <div>
              <h3 className="stats-sous-titre">Points forts</h3>
              <ul className="raisons">
                {c.forces.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {c.faiblesses.length > 0 && (
            <div>
              <h3 className="stats-sous-titre">Points faibles</h3>
              <ul className="raisons">
                {c.faiblesses.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="avertissement">
            Ce classement ne tient pas compte de la hauteur des probabilités.
          </p>
        </div>
      )}
    </article>
  );
}

export default function MeilleuresAnalyses() {
  const [matchs, setMatchs] = useState([]);
  const [filtre, setFiltre] = useState("TOUS");
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
    return <div className="chargement">Chargement des analyses…</div>;
  }
  if (erreur) {
    return <div className="erreur">{erreur}</div>;
  }

  const classes = matchsClasses(matchs);
  const compte = (id) => classes.filter((m) => m.classement.categorie === id).length;
  const affiches =
    filtre === "TOUS"
      ? classes
      : classes.filter((m) => m.classement.categorie === filtre);

  return (
    <section>
      <h2 className="titre-rubrique">MEILLEURES ANALYSES DU JOUR</h2>
      <p className="avertissement">
        Classement statistique, non commercial : il mesure la fiabilité de
        l'analyse (qualité et quantité des données, régularité des équipes,
        cohérence des indicateurs, solidité du modèle, incertitude des
        probabilités). Un match n'est jamais classé parce qu'une probabilité est
        élevée.
      </p>

      <ul className="legende">
        {CATEGORIES.map((c) => (
          <li key={c.id} className="legende-item">
            <span className={`badge-cat ${c.classe}`}>{c.id}</span>
            <span>{c.definition}</span>
          </li>
        ))}
      </ul>

      {classes.length > 0 && (
        <div className="filtre-competitions">
          <button
            type="button"
            className={filtre === "TOUS" ? "puce actif" : "puce"}
            onClick={() => setFiltre("TOUS")}
          >
            Tous ({classes.length})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={filtre === c.id ? "puce actif" : "puce"}
              onClick={() => setFiltre(c.id)}
            >
              {c.id} ({compte(c.id)})
            </button>
          ))}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="vide">
          Aucune analyse disponible pour le moment. Un match du jour n'est classé
          que si ses deux équipes ont un historique de matchs terminés. Rien
          n'est inventé.
        </div>
      ) : affiches.length === 0 ? (
        <div className="vide">Aucun match dans cette catégorie.</div>
      ) : (
        <div className="liste">
          {affiches.map((m) => (
            <CarteClassee
              key={m.id}
              match={m}
              rang={classes.indexOf(m) + 1}
            />
          ))}
        </div>
      )}
    </section>
  );
}
