import { estCompetitionAutorisee } from "../config/competitions.js";
import { enrichirAvecAnalyses } from "../analyse/moteur.js";
import { enrichirAvecClassement } from "../analyse/classement.js";
import { enrichirAvecPredictions } from "../prediction/moteur.js";
import { connecteurOpenfootball } from "./openfootball.js";

const CONNECTEURS = [connecteurOpenfootball];

const STATUTS = ["LIVE", "A_VENIR", "TERMINE"];

const DUREE_MEMOIRE = 5 * 60 * 1000;
let memoire = null;

function enrichirParCompetition(matchs) {
  const groupes = new Map();
  for (const m of matchs) {
    const cle = m.competition || "";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(m);
  }
  const resultat = [];
  for (const liste of groupes.values()) {
    const enrichis = enrichirAvecClassement(
      enrichirAvecPredictions(enrichirAvecAnalyses(liste))
    );
    for (const m of enrichis) resultat.push(m);
  }
  return resultat;
}

function memesEntrees(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function estValide(m) {
  return (
    m &&
    m.id &&
    STATUTS.includes(m.statut) &&
    !Number.isNaN(new Date(m.dateUTC).getTime()) &&
    m.domicile &&
    m.domicile.nom &&
    m.exterieur &&
    m.exterieur.nom
  );
}

export async function chargerMatchs() {
  if (CONNECTEURS.length === 0) return [];

  const resultats = await Promise.allSettled(
    CONNECTEURS.map((c) => c.charger())
  );

  if (resultats.every((r) => r.status === "rejected")) {
    throw new Error("Toutes les sources de données ont échoué.");
  }

  const entrees = resultats.map((r) =>
    r.status === "fulfilled" ? r.value : null
  );
  if (
    memoire &&
    Date.now() - memoire.le < DUREE_MEMOIRE &&
    memesEntrees(memoire.entrees, entrees)
  ) {
    return memoire.resultat;
  }

  const matchs = [];
  const dejaVus = new Set();

  for (const r of resultats) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value) {
      if (!estValide(m) || dejaVus.has(m.id)) continue;
      if (!estCompetitionAutorisee(m)) continue;
      dejaVus.add(m.id);
      matchs.push(m);
    }
  }

  const resultat = enrichirParCompetition(matchs);
  memoire = { le: Date.now(), entrees, resultat };
  return resultat;
}

export const FIN_DU_FICHIER = true;
