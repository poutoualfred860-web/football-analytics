import { useState } from "react";
import Matchs from "./pages/Matchs.jsx";

const SECTIONS = [
  { id: "matchs", label: "Matchs", icone: "⚽" },
  { id: "analyses", label: "Analyses", icone: "📊" },
  { id: "equipes", label: "Équipes", icone: "🛡️" },
  { id: "joueurs", label: "Joueurs", icone: "👤" },
  { id: "predictions", label: "Prédictions", icone: "🎯" }
];

const DESCRIPTIONS = {
  analyses:
    "Analyse automatique des matchs et classement selon leur qualité statistique (VERT, ORANGE, ROUGE).",
  equipes:
    "Statistiques des équipes et analyse de leurs performances.",
  joueurs: "Statistiques des joueurs.",
  predictions:
    "Probabilités de résultats, prédictions statistiques et évaluation historique des prédictions."
};

function EnPreparation({ section }) {
  return (
    <div className="section-prep">
      <h2>{section.icone} {section.label}</h2>
      <p>{DESCRIPTIONS[section.id]}</p>
      <p className="section-prep-note">
        En préparation : aucune donnée n'est affichée tant que les sources
        fiables ne sont pas branchées.
      </p>
    </div>
  );
}

export default function App() {
  const [actif, setActif] = useState("matchs");
  const section = SECTIONS.find((s) => s.id === actif);

  return (
    <div className="app">
      <header className="header">
        <div className="logo">⚽</div>
        <div>
          <h1 className="titre">FOOTBALL ANALYTICS</h1>
          <p className="sous-titre">{section.label}</p>
        </div>
      </header>

      <main className="contenu">
        {actif === "matchs" ? <Matchs /> : <EnPreparation section={section} />}
      </main>

      <nav className="nav-bas">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={s.id === actif ? "nav-bouton actif" : "nav-bouton"}
            onClick={() => setActif(s.id)}
          >
            <span className="nav-icone">{s.icone}</span>
            <span className="nav-label">{s.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
