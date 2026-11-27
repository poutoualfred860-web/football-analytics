 Connecteur openfootball (données du domaine public, sans clé).
 Fournit : calendrier, scores finaux et scores à la mi-temps.
 Ne fournit pas : direct, logos, statistiques détaillées.
 Les heures du fichier n'ont pas de fuseau : on suppose celui du pays
de la ligue (hypothèse). Aucune donnée n'est inventée.

const BASE =
  "https://raw.githubusercontent.com/openfootball/football.json/master";

const LIGUES = [
  { code: "en.1", nom: "Premier League", fuseau: "Europe/London" },
  { code: "de.1", nom: "Bundesliga", fuseau: "Europe/Berlin" },
  { code: "es.1", nom: "LaLiga", fuseau: "Europe/Madrid" },
  { code: "it.1", nom: "Serie A", fuseau: "Europe/Rome" },
  { code: "fr.1", nom: "Ligue 1", fuseau: "Europe/Paris" },
  { code: "nl.1", nom: "Eredivisie", fuseau: "Europe/Amsterdam" },
  { code: "pt.1", nom: "Primeira Liga", fuseau: "Europe/Lisbon" }
];

const SAISONS = ["2025-26", "2026-27"];
const DUREE_CACHE = 30 * 60 * 1000;

let cache = null;
let cacheLe = 0;

function identifiant(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Heure locale du pays -> date UTC.
function versUTC(date, heure, fuseau) {
  const [a, m, j] = date.split("-").map(Number);
  const [h, min] = (heure || "12:00").split(":").map(Number);
  const devine = Date.UTC(a, m - 1, j, h, min);
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: fuseau,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(new Date(devine));
  const lire = (type) => Number(parties.find((p) => p.type === type).value);
  const local = Date.UTC(
    lire("year"),
    lire("month") - 1,
    lire("day"),
    lire("hour"),
    lire("minute")
  );
  return new Date(devine - (local - devine));
}

function paire(valeur) {
  return Array.isArray(valeur) &&
    valeur.length >= 2 &&
    Number.isFinite(valeur[0]) &&
    Number.isFinite(valeur[1])
    ? valeur
    : null;
}

function listeMatchs(json) {
  if (Array.isArray(json.matches)) return json.matches;
  if (Array.isArray(json.rounds)) {
    return json.rounds.flatMap((r) =>
      (r.matches || []).map((m) => ({ round: r.name, ...m }))
    );
  }
  return [];
}

function convertir(m, ligue, saison, maintenant) {
  if (!m.date || !m.team1 || !m.team2) return null;
  const quand = versUTC(m.date, m.time, ligue.fuseau);
  const ft = paire(m.score && m.score.ft);
  const ht = paire(m.score && m.score.ht);
  const idD = identifiant(m.team1);
  const idE = identifiant(m.team2);

  Match sans score dont l'heure est passée : résultat inconnu, on l'ignore.
  if (!ft && quand < maintenant) return null;

  return {
    id: `of-${ligue.code}-${saison}-${m.date}-${idD}-${idE}`,
    source: "openfootball",
    competition: ligue.nom,
    confederation: "UEFA",
    dateUTC: quand.toISOString(),
    heureIndiquee: !!m.time,
    statut: ft ? "TERMINE" : "A_VENIR",
    domicile: { id: idD, nom: m.team1, logo: null },
    exterieur: { id: idE, nom: m.team2, logo: null },
    scoreDomicile: ft ? ft[0] : null,
    scoreExterieur: ft ? ft[1] : null,
    scoreMiTemps: ft && ht ? { domicile: ht[0], exterieur: ht[1] } : undefined
  };
}

async function chargerFichier(ligue, saison) {
  const reponse = await fetch(`${BASE}/${saison}/${ligue.code}.json`);
  if (!reponse.ok) throw new Error(`Fichier indisponible : ${ligue.code} ${saison}`);
  const json = await reponse.json();
  const maintenant = new Date();
  return listeMatchs(json)
    .map((m) => convertir(m, ligue, saison, maintenant))
    .filter(Boolean);
}

export const connecteurOpenfootball = {
  nom: "openfootball",
  async charger() {
    if (cache && Date.now() - cacheLe < DUREE_CACHE) return cache;

    const demandes = [];
    for (const ligue of LIGUES) {
      for (const saison of SAISONS) demandes.push(chargerFichier(ligue, saison));
    }
    const resultats = await Promise.allSettled(demandes);
    const matchs = resultats
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    if (matchs.length === 0) {
      throw new Error("Aucune donnée openfootball n'a pu être chargée.");
    }
    cache = matchs;
    cacheLe = Date.now();
    return matchs;
  }
};

