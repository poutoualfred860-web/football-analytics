import { useState } from "react";
import Matchs from "./pages/Matchs.jsx";
import Dashboard from "./pages/Dashboard.jsx";
const SECTIONS = [
  { id: "dashboard", label: "Tableau de bord", icone: "🏠" },
  { id: "jour", label: "Matchs du jour", icone: "📅", onglet: "aujourdhui" },
  { id: "live", label: "Matchs en direct", icone: "🔴", onglet: "live" },
  { id: "calendrier", label: "Calendrier", icone: "🗓️", onglet: "avenir" },
  { id: "analyses", label: "Analyses automatiques", icone: "📊" },
  { id: "predictions", label: "Prédictions", icone: "🎯" },
  { id: "statistiques", label: "Statistiques", icone: "📈" },
  { id: "classements", label: "Classements", icone: "🏆" },
  { id: "historique", label: "Historique des analyses", icone: "🕘" },
  { id: "parametres", label: "Paramètres", icone: "⚙️" }
];

const DESCRIPTIONS = {
  dashboard:
    "Vue d'ensemble : matchs en direct, matchs du jour, meilleures analyses et performances des prédictions.",
  analyses:
    "Analyse automatique des matchs et classement selon leur qualité statistique (VERT, ORANGE, ROUGE).",
  predictions:
    "Probabilités de résultats et prédictions statistiques.",
  statistiques:
    "Statistiques des équipes et des joueurs, avec tableaux et graphiques interactifs.",
  classements: "Classements des compétitions couvertes.",
  historique:
    "Historique des analyses et évaluation des prédictions passées.",
  parametres:
    "Fuseau horaire : Africa/Porto-Novo. Langue : français."
};

function EnPreparation({ section }) {
  return (
    <div className="section-prep">
      <h2>
        {section.icone} {section.label}
      </h2>
      <p>{DESCRIPTIONS[section.id]}</p>
      <p className="section-prep-note">
        En préparation : aucune donnée n'est affichée tant que les sources
        fiables ne sont pas branchées.
      </p>
    </div>
  );
}

export default function App() {
  const [actif, setActif] = useState("dashboard");
  const [ouvert, setOuvert] = useState(false);
  const section = SECTIONS.find((s) => s.id === actif);

  function choisir(id) {
    setActif(id);
    setOuvert(false);
  }

  return (
    <div className="plateforme">
      {ouvert && (
        <div className="fond-menu" onClick={() => setOuvert(false)} />
      )}

      <aside className={ouvert ? "barre-laterale ouverte" : "barre-laterale"}>
        <div className="marque">
          <div className="logo">⚽</div>
          <span className="marque-nom">FOOTBALL ANALYTICS</span>
        </div>

        <nav className="menu">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === actif ? "menu-item actif" : "menu-item"}
              onClick={() => choisir(s.id)}
            >
              <span className="menu-icone">{s.icone}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <p className="pied-menu">Fuseau : Africa/Porto-Novo</p>
      </aside>

      <div className="zone-principale">
        <header className="haut">
          <button
            type="button"
            className="bouton-menu"
            aria-label="Ouvrir le menu"
            onClick={() => setOuvert(true)}
          >
            ☰
          </button>
          <h1 className="haut-titre">{section.label}</h1>
        </header>

        <main className="contenu">
          {section.onglet ? (
            <Matchs key={section.id} ongletInitial={section.onglet} />
          ) : (
            <EnPreparation section={section} />
          )}
        </main>
      </div>
    </div>
  );
}
