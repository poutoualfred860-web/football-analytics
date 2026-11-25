// Compétitions principales à couvrir.
// Les autres compétitions européennes et internationales
// sont acceptées automatiquement, sauf les compétitions africaines.
export const COMPETITIONS_PRINCIPALES = [
  { id: "champions-league", nom: "UEFA Champions League", region: "Europe" },
  { id: "europa-league", nom: "UEFA Europa League", region: "Europe" },
  { id: "premier-league", nom: "Premier League", region: "Angleterre" },
  { id: "laliga", nom: "LaLiga", region: "Espagne" },
  { id: "bundesliga", nom: "Bundesliga", region: "Allemagne" },
  { id: "serie-a", nom: "Serie A", region: "Italie" },
  { id: "ligue-1", nom: "Ligue 1", region: "France" },
  { id: "eredivisie", nom: "Eredivisie", region: "Pays-Bas" },
  { id: "primeira-liga", nom: "Primeira Liga", region: "Portugal" }
];

// Mots qui signalent une compétition africaine (comparés mot par mot,
// sans accents ni majuscules).
const MOTS_AFRICAINS = ["caf", "africa", "afrique", "african", "africain"];

function mots(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Un match est africain si sa source l'indique (confederation "CAF")
// ou si le nom de sa compétition contient un mot africain.
export function estCompetitionAfricaine(match) {
  if (!match) return false;
  if (String(match.confederation || "").toUpperCase() === "CAF") return true;
  return mots(match.competition).some((m) => MOTS_AFRICAINS.includes(m));
}

export function estCompetitionAutorisee(match) {
  return !estCompetitionAfricaine(match);
}
