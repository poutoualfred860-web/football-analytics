import Matchs from "./pages/Matchs.jsx";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">⚽</div>
        <div>
          <h1 className="titre">FOOTBALL ANALYTICS</h1>
          <p className="sous-titre">Matchs et analyses</p>
        </div>
      </header>

      <main className="contenu">
        <Matchs />
      </main>
    </div>
  );
}
