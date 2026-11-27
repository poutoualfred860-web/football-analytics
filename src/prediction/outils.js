 Outils statistiques du moteur de prédiction.
 Tout est calculé à partir des matchs terminés fournis. Aucune donnée
 n'est inventée : quand les données sont insuffisantes, les fonctions
 renvoient null.

export const ELO_DEPART = 1500;
export const ELO_K = 20;
export const ELO_AVANTAGE = 65;

const PSEUDO_MATCHS = 4;  lissage : poids de la moyenne de la ligue
const DECROISSANCE = 0.9;  poids d'un match par rapport au suivant plus récent

export function normaliser(texte) {
  return String(texte || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function cleEquipe(equipe) {
  if (!equipe) return "";
  if (equipe.id !== undefined && equipe.id !== null) return "id:" + equipe.id;
  return "nom:" + normaliser(equipe.nom);
}

export function estNombre(v) {
  return typeof v === "number" && Number.isFinite(v);
}

export function scoreValide(m) {
  return (
    m &&
    m.statut === "TERMINE" &&
    estNombre(m.scoreDomicile) &&
    estNombre(m.scoreExterieur)
  );
}

export function moyenne(valeurs) {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

function plusAncienD(a, b) {
  return new Date(a.dateUTC) - new Date(b.dateUTC);
}

function plusRecentD(a, b) {
  return new Date(b.dateUTC) - new Date(a.dateUTC);
}

 ---------- Poisson ----------

export function probabilitesPoisson(lambda, max) {
  const p = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) p.push((p[k - 1] * lambda) / k);
  return p;
}

 Matrice des scores exacts : matrice[i][j] = P(domicile i, extérieur j).
export function matriceScores(lambdaDomicile, lambdaExterieur, max = 10) {
  const pd = probabilitesPoisson(lambdaDomicile, max);
  const pe = probabilitesPoisson(lambdaExterieur, max);
  const matrice = [];
  let total = 0;
  for (let i = 0; i <= max; i++) {
    matrice.push([]);
    for (let j = 0; j <= max; j++) {
      const p = pd[i] * pe[j];
      matrice[i].push(p);
      total += p;
    }
  }
  return matrice.map((ligne) => ligne.map((p) => p / total));
}

export function resultat1N2(matrice) {
  let domicile = 0;
  let nul = 0;
  let exterieur = 0;
  matrice.forEach((ligne, i) =>
    ligne.forEach((p, j) => {
      if (i > j) domicile += p;
      else if (i === j) nul += p;
      else exterieur += p;
    })
  );
  return { domicile, nul, exterieur };
}

 P(total de buts > seuil), par exemple seuil 2,5.
export function probPlusDeButs(matrice, seuil) {
  let somme = 0;
  matrice.forEach((ligne, i) =>
    ligne.forEach((p, j) => {
      if (i + j > seuil) somme += p;
    })
  );
  return somme;
}

export function probLesDeuxMarquent(matrice) {
  let somme = 0;
  matrice.forEach((ligne, i) =>
    ligne.forEach((p, j) => {
      if (i >= 1 && j >= 1) somme += p;
    })
  );
  return somme;
}

export function scoresProbables(matrice, n = 5) {
  const liste = [];
  matrice.forEach((ligne, i) =>
    ligne.forEach((p, j) => liste.push({ score: `${i}-${j}`, probabilite: p }))
  );
  return liste.sort((a, b) => b.probabilite - a.probabilite).slice(0, n);
}

 P(compteur > seuil) quand le compteur suit une loi de Poisson de moyenne lambda
 (corners, cartons).
export function probPoissonPlusDe(lambda, seuil) {
  const limite = Math.floor(seuil);
  const p = probabilitesPoisson(lambda, limite);
  const cumul = p.reduce((a, b) => a + b, 0);
  return Math.max(0, 1 - cumul);
}

 ---------- Forces offensive et défensive ----------

 vues : [{ pour, contre }], du plus récent au plus ancien.
function forceEquipe(vues, moyenneEquipe) {
  let sommePoids = 0;
  let pour = 0;
  let contre = 0;
  vues.forEach((v, i) => {
    const w = DECROISSANCE ** i;
    sommePoids += w;
    pour += w * v.pour;
    contre += w * v.contre;
  });
  const lisse = (valeur) =>
    (valeur + PSEUDO_MATCHS * moyenneEquipe) / (sommePoids + PSEUDO_MATCHS);
  return {
    attaque: lisse(pour) / moyenneEquipe,
    defense: lisse(contre) / moyenneEquipe,
    poidsEffectif: sommePoids
  };
}

 Matchs terminés avant la date du match, portant une valeur exploitable.
extraire(m) renvoie { domicile, exterieur } ou null.
function matchsExploitables(historique, match, extraire) {
  const dateLimite = new Date(match.dateUTC);
  const liste = [];
  for (const m of historique) {
    if (!scoreValide(m) || new Date(m.dateUTC) >= dateLimite) continue;
    const v = extraire(m);
    if (!v || !estNombre(v.domicile) || !estNombre(v.exterieur)) continue;
    liste.push({ m, v });
  }
  return liste;
}

Base de calcul de la ligue : la même compétition si elle a assez de matchs,
sinon toutes les compétitions.
function baseLigue(lignes, competition, minLigue) {
  const memeCompetition = lignes.filter((x) => x.m.competition === competition);
  if (memeCompetition.length >= minLigue) {
    return { base: memeCompetition, memeCompetition: true };
  }
  if (lignes.length >= minLigue) return { base: lignes, memeCompetition: false };
  return null;
}

Modèle de Poisson pour un compteur quelconque (buts, xG, corners, cartons).
Renvoie les moyennes attendues des deux équipes, ou null si les données
 sont insuffisantes.
export function modeleCompteur(historique, match, extraire, options = {}) {
  const { minLigue = 30, minEquipe = 5, maxMatchs = 20 } = options;
  const lignes = matchsExploitables(historique, match, extraire);
  const ligue = baseLigue(lignes, match.competition, minLigue);
  if (!ligue) return null;

  const moyDom = moyenne(ligue.base.map((x) => x.v.domicile));
  const moyExt = moyenne(ligue.base.map((x) => x.v.exterieur));
  const moyEquipe = (moyDom + moyExt) / 2;
  if (!(moyEquipe > 0)) return null;

  const vues = (equipe) => {
    const cle = cleEquipe(equipe);
    return lignes
      .filter(
        (x) =>
          cleEquipe(x.m.domicile) === cle || cleEquipe(x.m.exterieur) === cle
      )
      .sort((a, b) => plusRecentD(a.m, b.m))
      .slice(0, maxMatchs)
      .map((x) =>
        cleEquipe(x.m.domicile) === cle
          ? { pour: x.v.domicile, contre: x.v.exterieur }
          : { pour: x.v.exterieur, contre: x.v.domicile }
      );
  };

  const vuesDomicile = vues(match.domicile);
  const vuesExterieur = vues(match.exterieur);
  if (vuesDomicile.length < minEquipe || vuesExterieur.length < minEquipe) {
    return null;
  }

  const fd = forceEquipe(vuesDomicile, moyEquipe);
  const fe = forceEquipe(vuesExterieur, moyEquipe);

  return {
    lambdaDomicile: moyDom * fd.attaque * fe.defense,
    lambdaExterieur: moyExt * fe.attaque * fd.defense,
    moyenneLigue: { domicile: moyDom, exterieur: moyExt },
    echantillonLigue: ligue.base.length,
    memeCompetition: ligue.memeCompetition,
    matchsDomicile: vuesDomicile.length,
    matchsExterieur: vuesExterieur.length,
    forces: { domicile: fd, exterieur: fe },
    vuesDomicile,
    vuesExterieur
  };
}

 Part des buts marqués en première mi-temps (scoreMiTemps fourni par la source).
export function partPremiereMiTemps(historique, match, minLigue = 30) {
  const dateLimite = new Date(match.dateUTC);
  const lignes = [];
  for (const m of historique) {
    if (!scoreValide(m) || new Date(m.dateUTC) >= dateLimite) continue;
    const mt = m.scoreMiTemps;
    if (!mt || !estNombre(mt.domicile) || !estNombre(mt.exterieur)) continue;
    lignes.push({ m, v: mt });
  }
  const ligue = baseLigue(lignes, match.competition, minLigue);
  if (!ligue) return null;
  const butsMT = ligue.base.reduce((s, x) => s + x.v.domicile + x.v.exterieur, 0);
  const butsFin = ligue.base.reduce(
    (s, x) => s + x.m.scoreDomicile + x.m.scoreExterieur,
    0
  );
  if (!(butsFin > 0)) return null;
  return { part: butsMT / butsFin, echantillon: ligue.base.length };
}

 Part des matchs nuls dans la ligue.
export function tauxNuls(historique, match, minLigue = 30) {
  const lignes = matchsExploitables(historique, match, (m) => ({
    domicile: m.scoreDomicile,
    exterieur: m.scoreExterieur
  }));
  const ligue = baseLigue(lignes, match.competition, minLigue);
  if (!ligue) return null;
  const nuls = ligue.base.filter((x) => x.v.domicile === x.v.exterieur).length;
  const taux = nuls / ligue.base.length;
  if (!(taux > 0 && taux < 1)) return null;
  return { taux, echantillon: ligue.base.length };
}

 ---------- Elo ----------

export function calculerElo(historique, dateLimite) {
  const notes = new Map();
  const nombre = new Map();
  const joues = historique
    .filter((m) => scoreValide(m) && new Date(m.dateUTC) < dateLimite)
    .sort(plusAncienD);

  for (const m of joues) {
    const cd = cleEquipe(m.domicile);
    const ce = cleEquipe(m.exterieur);
    const rd = notes.has(cd) ? notes.get(cd) : ELO_DEPART;
    const re = notes.has(ce) ? notes.get(ce) : ELO_DEPART;
    const attendu = 1 / (1 + 10 ** (-(rd + ELO_AVANTAGE - re) / 400));
    const resultat =
      m.scoreDomicile > m.scoreExterieur
        ? 1
        : m.scoreDomicile === m.scoreExterieur
          ? 0.5
          : 0;
    const ecart = Math.abs(m.scoreDomicile - m.scoreExterieur);
    const delta = ELO_K * (Math.log(ecart + 1) + 1) * (resultat - attendu);
    notes.set(cd, rd + delta);
    notes.set(ce, re - delta);
    nombre.set(cd, (nombre.get(cd) || 0) + 1);
    nombre.set(ce, (nombre.get(ce) || 0) + 1);
  }

  return { notes, nombre };
}

Probabilités 1/N/2 d'après les notes Elo (modèle de Davidson, qui gère le nul
 à partir du taux de nuls réel de la ligue).
export function probabilitesElo(noteDomicile, noteExterieur, taux) {
  const gd = 10 ** ((noteDomicile + ELO_AVANTAGE) / 400);
  const ge = 10 ** (noteExterieur / 400);
  const nu = (2 * taux) / (1 - taux);
  const racine = Math.sqrt(gd * ge);
  const denominateur = gd + ge + nu * racine;
  return {
    domicile: gd / denominateur,
    nul: (nu * racine) / denominateur,
    exterieur: ge / denominateur
  };
}
