const BASE = [
  "https:",
  "",
  "raw.githubusercontent.com",
  "openfootball",
  "football.json",
  "master"
].join("/");

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
const DUREE_STOCKAGE = 24 * 60 * 60 * 1000;
const CLE_STOCKAGE = "fa-openfootball-v1";

let cache = null;
let cacheLe = 0;
let rafraichissement = null;

function lireStockage() {
  try {
    const texte = window.localStorage.getItem(CLE_STOCKAGE);
    if (!texte) return null;
    const objet = JSON.parse(texte);
    return objet && Array.isArray(objet.matchs) ? objet : null;
  } catch (e) {
    return null;
  }
}

function ecrireStockage(matchs) {
  try {
    window.localStorage.setItem(
      CLE_STOCKAGE,
      JSON.stringify({ le: Date.now(), matchs })
    );
  } catch (e) {
  }
}

function nettoyer(matchs) {
  const maintenant = Date.now();
  return matchs.filter(
    (m) => m.statut === "TERMINE" || new Date(m.dateUTC).getTime() >= maintenant
  );
}

function identifiant(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const FORMATEURS = new Map();
const DECALAGES = new Map();

function formateur(fuseau) {
  if (!FORMATEURS.has(fuseau)) {
    FORMATEURS.set(
      fuseau,
      new Intl.DateTimeFormat("en-US", {
        timeZone: fuseau,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    );
  }
  return FORMATEURS.get(fuseau);
}

function versUTC(date, heure, fuseau) {
  const [a, m, j] = date.split("-").map(Number);
  const [h, min] = (heure || "12:00").split(":").map(Number);
  const devine = Date.UTC(a, m - 1, j, h, min);
  const cle = fuseau + "|" + date + "|" + (heure || "");
  let decalage = DECALAGES.get(cle);
  if (decalage === undefined) {
    const parties = formateur(fuseau).formatToParts(new Date(devine));
    const lire = (type) => Number(parties.find((p) => p.type === type).value);
    const local = Date.UTC(
      lire("year"),
      lire("month") - 1,
      lire("day"),
      lire("hour"),
      lire("minute")
    );
    decalage = local - devine;
    DECALAGES.set(cle, decalage);
  }
  return new Date(devine - decalage);
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

async function rafraichir() {
  if (rafraichissement) return rafraichissement;

  rafraichissement = (async () => {
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
    ecrireStockage(matchs);
    return matchs;
  })();

  try {
    return await rafraichissement;
  } finally {
    rafraichissement = null;
  }
}

export const connecteurOpenfootball = {
  nom: "openfootball",
  async charger() {
    const maintenant = Date.now();
    if (cache && maintenant - cacheLe < DUREE_CACHE) return cache;

    if (!cache) {
      const stockage = lireStockage();
      if (stockage && maintenant - stockage.le < DUREE_STOCKAGE) {
        cache = nettoyer(stockage.matchs);
        cacheLe = stockage.le;
      }
    }

    if (cache) {
      rafraichir().catch(() => {});
      return cache;
    }

    return rafraichir();
  }
};

export const FIN_DU_FICHIER = true;
