Moteur d'analyse automatique des matchs.

 Il travaille uniquement à partir des matchs déjà chargés : les matchs
terminés servent d'historique, les matchs du jour sont analysés.
 Aucune donnée n'est inventée : quand une donnée manque, elle vaut null
et elle est listée dans donneesManquantes.

 Le score (0 à 100) mesure la QUALITÉ STATISTIQUE de l'analyse
(quantité et fiabilité des données disponibles), pas une prédiction.
VERT : 70 et plus | ORANGE : 40 à 69 | ROUGE : moins de 40

const FUSEAU = "Africa/Porto-Novo";
const MAX_MATCHS = 10;
const MIN_MATCHS = 5;

const FORMAT_JOUR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function cleJour(date) {
  return FORMAT_JOUR.format(date);
}
function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleEquipe(equipe) {
  if (!equipe) return "";
  if (equipe.id !== undefined && equipe.id !== null) return "id:" + equipe.id;
  return "nom:" + normaliser(equipe.nom);
}

function estNombre(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function scoreValide(m) {
  return (
    m &&
    m.statut === "TERMINE" &&
    estNombre(m.scoreDomicile) &&
    estNombre(m.scoreExterieur)
  );
}

function moyenne(valeurs) {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function arrondir(v, decimales = 2) {
  if (v === null || v === undefined) return null;
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

function ecartType(valeurs) {
  const m = moyenne(valeurs);
  if (m === null) return null;
  return Math.sqrt(moyenne(valeurs.map((v) => (v - m) ** 2)));
}

function plusRecentD(a, b) {
  return new Date(b.dateUTC) - new Date(a.dateUTC);
}

Un match vu du côté d'une équipe.
function vueEquipe(m, cle) {
  const domicile = cleEquipe(m.domicile) === cle;
  const pour = domicile ? m.scoreDomicile : m.scoreExterieur;
  const contre = domicile ? m.scoreExterieur : m.scoreDomicile;
  const points = pour > contre ? 3 : pour === contre ? 1 : 0;
  const xg = m.stats && m.stats.xg;
  const xgDispo = xg && estNombre(xg.domicile) && estNombre(xg.exterieur);
  return {
    domicile,
    pour,
    contre,
    points,
    resultat: points === 3 ? "V" : points === 1 ? "N" : "D",
    xgPour: xgDispo ? (domicile ? xg.domicile : xg.exterieur) : null,
    xgContre: xgDispo ? (domicile ? xg.exterieur : xg.domicile) : null
  };
}

function resumer(vues) {
  if (vues.length === 0) {
    return {
      matchs: 0,
      victoires: 0,
      nuls: 0,
      defaites: 0,
      pointsParMatch: null,
      butsMarques: null,
      butsEncaisses: null,
      differenceButs: null
    };
  }
  const marques = moyenne(vues.map((v) => v.pour));
  const encaisses = moyenne(vues.map((v) => v.contre));
  return {
    matchs: vues.length,
    victoires: vues.filter((v) => v.points === 3).length,
    nuls: vues.filter((v) => v.points === 1).length,
    defaites: vues.filter((v) => v.points === 0).length,
    pointsParMatch: arrondir(moyenne(vues.map((v) => v.points))),
    butsMarques: arrondir(marques),
    butsEncaisses: arrondir(encaisses),
    differenceButs: arrondir(marques - encaisses)
  };
}

function analyserEquipe(equipe, historique, dateLimite) {
  const cle = cleEquipe(equipe);
  const joues = historique
    .filter(
      (m) =>
        scoreValide(m) &&
        new Date(m.dateUTC) < dateLimite &&
        (cleEquipe(m.domicile) === cle || cleEquipe(m.exterieur) === cle)
    )
    .sort(plusRecentD)
    .map((m) => vueEquipe(m, cle));

  const recents = joues.slice(0, MAX_MATCHS);
  const aDomicile = joues.filter((v) => v.domicile).slice(0, MAX_MATCHS);
  const aExterieur = joues.filter((v) => !v.domicile).slice(0, MAX_MATCHS);
  const cinq = recents.slice(0, 5);

  const avecXg = recents.filter((v) => v.xgPour !== null);

  return {
    global: resumer(recents),
    domicile: resumer(aDomicile),
    exterieur: resumer(aExterieur),
    forme: cinq.map((v) => v.resultat),
    pointsForme: cinq.length > 0 ? cinq.reduce((s, v) => s + v.points, 0) : null,
    regularite:
      recents.length >= MIN_MATCHS
        ? Math.max(
            0,
            Math.round(100 - ecartType(recents.map((v) => v.points)) * (100 / 1.5))
          )
        : null,
    xg:
      avecXg.length > 0
        ? {
            matchs: avecXg.length,
            xgMarque: arrondir(moyenne(avecXg.map((v) => v.xgPour))),
            xgEncaisse: arrondir(moyenne(avecXg.map((v) => v.xgContre)))
          }
        : null
  };
}

function confrontations(match, historique) {
  const a = cleEquipe(match.domicile);
  const b = cleEquipe(match.exterieur);
  const liste = historique
    .filter((m) => {
      if (!scoreValide(m) || new Date(m.dateUTC) >= new Date(match.dateUTC)) {
        return false;
      }
      const d = cleEquipe(m.domicile);
      const e = cleEquipe(m.exterieur);
      return (d === a && e === b) || (d === b && e === a);
    })
    .sort(plusRecentD)
    .slice(0, MAX_MATCHS);

  let victoiresDomicile = 0;
  let victoiresExterieur = 0;
  let nuls = 0;
  liste.forEach((m) => {
    if (m.scoreDomicile === m.scoreExterieur) nuls += 1;
    else {
      const gagnant =
        m.scoreDomicile > m.scoreExterieur
          ? cleEquipe(m.domicile)
          : cleEquipe(m.exterieur);
      if (gagnant === a) victoiresDomicile += 1;
      else victoiresExterieur += 1;
    }
  });

  return {
    matchs: liste.length,
    victoires: { domicile: victoiresDomicile, exterieur: victoiresExterieur },
    nuls,
    butsParMatch:
      liste.length > 0
        ? arrondir(moyenne(liste.map((m) => m.scoreDomicile + m.scoreExterieur)))
        : null
  };
}

function qualite(dom, ext, h2h, match) {
  let score = 0;
  score += (20 * Math.min(dom.global.matchs, MAX_MATCHS)) / MAX_MATCHS;
  score += (20 * Math.min(ext.global.matchs, MAX_MATCHS)) / MAX_MATCHS;
  score += (10 * Math.min(dom.domicile.matchs, 5)) / 5;
  score += (10 * Math.min(ext.exterieur.matchs, 5)) / 5;
  score += (15 * Math.min(h2h.matchs, 5)) / 5;
  score += dom.xg ? (7.5 * Math.min(dom.xg.matchs, 5)) / 5 : 0;
  score += ext.xg ? (7.5 * Math.min(ext.xg.matchs, 5)) / 5 : 0;
  const abs = match.absences;
  if (abs && Array.isArray(abs.domicile) && Array.isArray(abs.exterieur)) {
    score += 10;
  }
  return Math.round(score);
}

function niveauDepuisScore(score) {
  if (score >= 70) return "VERT";
  if (score >= 40) return "ORANGE";
  return "ROUGE";
}

export function analyserMatch(match, historique) {
  const dateLimite = new Date(match.dateUTC);
  const dom = analyserEquipe(match.domicile, historique, dateLimite);
  const ext = analyserEquipe(match.exterieur, historique, dateLimite);
  const h2h = confrontations(match, historique);

  const manquantes = [];
  if (dom.global.matchs < MIN_MATCHS) {
    manquantes.push(`Historique insuffisant : ${match.domicile.nom}`);
  }
  if (ext.global.matchs < MIN_MATCHS) {
    manquantes.push(`Historique insuffisant : ${match.exterieur.nom}`);
  }
  if (h2h.matchs === 0) manquantes.push("Confrontations directes");
  if (!dom.xg || !ext.xg) manquantes.push("xG et xGA");
  const abs = match.absences;
  const absencesDispo =
    abs && Array.isArray(abs.domicile) && Array.isArray(abs.exterieur);
  if (!absencesDispo) manquantes.push("Absences et blessures");

  let ecartNiveau = null;
  const pd = dom.global.pointsParMatch;
  const pe = ext.global.pointsParMatch;
  if (pd !== null && pe !== null) {
    const ecart = arrondir(pd - pe);
    ecartNiveau = {
      points: ecart,
      differenceButs: arrondir(
        dom.global.differenceButs - ext.global.differenceButs
      ),
      avantage:
        ecart >= 0.5 ? "domicile" : ecart <= -0.5 ? "exterieur" : "equilibre"
    };
  }

  const score = qualite(dom, ext, h2h, match);

  return {
    score,
    niveau: niveauDepuisScore(score),
    domicile: dom,
    exterieur: ext,
    confrontations: h2h,
    ecartNiveau,
    absences: absencesDispo ? abs : null,
    donneesManquantes: manquantes,
    calculeLe: new Date().toISOString()
  };
}

Ajoute le champ analyse aux matchs du jour qui ont assez de données.
 Les autres matchs et les matchs sans aucun historique restent inchangés.
export function enrichirAvecAnalyses(matchs, maintenant = new Date()) {
  const aujourdhui = cleJour(maintenant);
  return matchs.map((m) => {
    if (cleJour(new Date(m.dateUTC)) !== aujourdhui) return m;
    const analyse = analyserMatch(m, matchs);
    return analyse.score > 0 ? { ...m, analyse } : m;
  });
}
