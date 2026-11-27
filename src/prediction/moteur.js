 Moteur de prédiction statistique.

 Modèles : Poisson (buts, et xG quand disponible), Elo (modèle de Davidson
 pour le nul), avantage du terrain (moyennes domicile / extérieur de la
 ligue), forme récente (les matchs récents pèsent plus), forces offensive
 et défensive de chaque équipe.

 Toutes les probabilités viennent des matchs terminés fournis. Si les
 données sont insuffisantes, le marché est déclaré indisponible : aucun
 pourcentage n'est inventé. Une prédiction n'est jamais une certitude :
 les probabilités affichées sont bornées entre 1 % et 99 %.

 Les pondérations (60 % Poisson / 40 % Elo, 50 % buts / 50 % xG) sont des
 choix standards, non calibrés sur ces données : l'historique des
 prédictions servira à les vérifier.

import {
  ELO_AVANTAGE,
  calculerElo,
  cleEquipe,
  matriceScores,
  modeleCompteur,
  partPremiereMiTemps,
  probLesDeuxMarquent,
  probPlusDeButs,
  probPoissonPlusDe,
  probabilitesElo,
  resultat1N2,
  scoreValide,
  scoresProbables,
  tauxNuls
} from "./outils.js";

const FUSEAU = "Africa/Porto-Novo";
const POIDS_POISSON = 0.6;
const POIDS_ELO = 0.4;
const POIDS_XG = 0.5;
const MIN_MATCHS_ELO = 8;

export const AVERTISSEMENT =
  "Estimation statistique : une probabilité n'est jamais une certitude.";

const FORMAT_JOUR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function cleJour(date) {
  return FORMAT_JOUR.format(date);
}

function fr(nombre, decimales = 2) {
  return nombre.toFixed(decimales).replace(".", ",");
}

function pct(p) {
  return Math.min(99, Math.max(1, Math.round(p * 100)));
}

function niveauConfiance(score) {
  if (score >= 80) return "Élevée";
  if (score >= 50) return "Moyenne";
  return "Faible";
}

function niveauQualite(score) {
  if (score >= 75) return "Bonne";
  if (score >= 50) return "Moyenne";
  return "Faible";
}

function entree(id, groupe, marche, proba, facteur, qualite, raisons) {
  const score = Math.round(qualite * facteur);
  return {
    id,
    groupe,
    marche,
    probabilite: pct(proba),
    confiance: { niveau: niveauConfiance(score), score },
    qualiteDonnees: niveauQualite(qualite),
    raisons
  };
}

function formeRecente(historique, equipe, dateLimite) {
  const cle = cleEquipe(equipe);
  return historique
    .filter(
      (m) =>
        scoreValide(m) &&
        new Date(m.dateUTC) < dateLimite &&
        (cleEquipe(m.domicile) === cle || cleEquipe(m.exterieur) === cle)
    )
    .sort((a, b) => new Date(b.dateUTC) - new Date(a.dateUTC))
    .slice(0, 5)
    .map((m) => {
      const dom = cleEquipe(m.domicile) === cle;
      const pour = dom ? m.scoreDomicile : m.scoreExterieur;
      const contre = dom ? m.scoreExterieur : m.scoreDomicile;
      return pour > contre ? "V" : pour === contre ? "N" : "D";
    });
}

function nombreConfrontations(historique, match) {
  const a = cleEquipe(match.domicile);
  const b = cleEquipe(match.exterieur);
  const limite = new Date(match.dateUTC);
  return historique.filter((m) => {
    if (!scoreValide(m) || new Date(m.dateUTC) >= limite) return false;
    const d = cleEquipe(m.domicile);
    const e = cleEquipe(m.exterieur);
    return (d === a && e === b) || (d === b && e === a);
  }).length;
}

function compterTotal(vues, seuil, plus) {
  const liste = vues.slice(0, 10);
  const c = liste.filter((v) =>
    plus ? v.pour + v.contre > seuil : v.pour + v.contre < seuil
  ).length;
  return { c, n: liste.length };
}

function compterMarque(vues) {
  const liste = vues.slice(0, 10);
  return {
    marque: liste.filter((v) => v.pour > 0).length,
    encaisse: liste.filter((v) => v.contre > 0).length,
    n: liste.length
  };
}

 Marchés « compteur » (corners, cartons) : seulement si les données suffisent.
function marcheCompteur(historique, match, extraire) {
  const modele = modeleCompteur(historique, match, extraire, {
    minLigue: 30,
    minEquipe: 5
  });
  if (!modele) return null;
  const total = modele.lambdaDomicile + modele.lambdaExterieur;
  const moyLigue = modele.moyenneLigue.domicile + modele.moyenneLigue.exterieur;
  const ligne = Math.floor(moyLigue) + 0.5;
  const qualite = Math.round(
    60 *
      Math.min(1, Math.min(modele.matchsDomicile, modele.matchsExterieur) / 10) +
      40 * Math.min(1, modele.echantillonLigue / 100)
  );
  return { modele, total, moyLigue, ligne, plus: probPoissonPlusDe(total, ligne), qualite };
}

export function predireMatch(match, historique) {
  const nomD = match.domicile.nom;
  const nomE = match.exterieur.nom;
  const dateLimite = new Date(match.dateUTC);

   1. Modèle de Poisson sur les buts
  const modeleButs = modeleCompteur(
    historique,
    match,
    (m) => ({ domicile: m.scoreDomicile, exterieur: m.scoreExterieur }),
    { minLigue: 30, minEquipe: 5 }
  );
  if (!modeleButs) return null;

  const modeles = ["Poisson (buts)"];
  let lD = modeleButs.lambdaDomicile;
  let lE = modeleButs.lambdaExterieur;

   2. Modèle complémentaire : Poisson sur les xG, si les données le permettent
  const modeleXg = modeleCompteur(
    historique,
    match,
    (m) => m.stats && m.stats.xg,
    { minLigue: 30, minEquipe: 5 }
  );
  if (modeleXg) {
    lD = (1 - POIDS_XG) * lD + POIDS_XG * modeleXg.lambdaDomicile;
    lE = (1 - POIDS_XG) * lE + POIDS_XG * modeleXg.lambdaExterieur;
    modeles.push("Poisson (xG)");
  }

   Tous les scores possibles, de 0-0 à 10-10, avec leur probabilité exacte
   (équivaut à un nombre infini de simulations).
  const matrice = matriceScores(lD, lE);
  const pPoisson = resultat1N2(matrice);

   3. Elo
  const nuls = tauxNuls(historique, match);
  const elo = calculerElo(historique, dateLimite);
  const cd = cleEquipe(match.domicile);
  const ce = cleEquipe(match.exterieur);
  const eloDispo =
    nuls &&
    (elo.nombre.get(cd) || 0) >= MIN_MATCHS_ELO &&
    (elo.nombre.get(ce) || 0) >= MIN_MATCHS_ELO;

  let finale = pPoisson;
  let pElo = null;
  let accord = 0.5;
  let ecartMax = null;
  let notes = null;
  if (eloDispo) {
    notes = { domicile: elo.notes.get(cd), exterieur: elo.notes.get(ce) };
    pElo = probabilitesElo(notes.domicile, notes.exterieur, nuls.taux);
    finale = {
      domicile: POIDS_POISSON * pPoisson.domicile + POIDS_ELO * pElo.domicile,
      nul: POIDS_POISSON * pPoisson.nul + POIDS_ELO * pElo.nul,
      exterieur: POIDS_POISSON * pPoisson.exterieur + POIDS_ELO * pElo.exterieur
    };
    ecartMax = Math.max(
      Math.abs(pPoisson.domicile - pElo.domicile),
      Math.abs(pPoisson.nul - pElo.nul),
      Math.abs(pPoisson.exterieur - pElo.exterieur)
    );
    accord = 1 - Math.min(1, ecartMax / 0.15);
    modeles.push("Elo");
  }
  const facteur1N2 = eloDispo ? 0.7 + 0.3 * accord : 0.85;

   Qualité des données (0 à 100)
  const h2h = nombreConfrontations(historique, match);
  const qualite = Math.round(
    40 *
      Math.min(1, Math.min(modeleButs.matchsDomicile, modeleButs.matchsExterieur) / 10) +
      20 * Math.min(1, modeleButs.echantillonLigue / 100) +
      (eloDispo ? 20 : 0) +
      10 * Math.min(1, h2h / 3) +
      (modeleXg ? 10 : 0)
  );

  const formeD = formeRecente(historique, match.domicile, dateLimite);
  const formeE = formeRecente(historique, match.exterieur, dateLimite);
  const moy = modeleButs.moyenneLigue;

   Raisons communes
  const raisonsBase = [
    `Buts attendus : ${nomD} ${fr(lD)} – ${nomE} ${fr(lE)} (${modeles.join(" + ")}).`
  ];

  function raisonsResultat(cle, libelle) {
    const r = [
      `Probabilité selon Poisson : ${pct(pPoisson[cle])} %` +
        (pElo ? ` ; selon Elo : ${pct(pElo[cle])} %.` : ". Elo indisponible (historique insuffisant)."),
      ...raisonsBase
    ];
    if (notes) {
      r.push(
        `Classement Elo : ${nomD} ${Math.round(notes.domicile)} contre ${nomE} ${Math.round(notes.exterieur)} (avantage du terrain de ${ELO_AVANTAGE} points inclus).`
      );
    }
    r.push(
      `Forme récente (5 derniers matchs, du plus récent au plus ancien) : ${nomD} ${formeD.join(" ")} ; ${nomE} ${formeE.join(" ")}.`
    );
    if (cle === "nul" && nuls) {
      r.push(
        `Taux de matchs nuls de la ligue : ${pct(nuls.taux)} % (sur ${nuls.echantillon} matchs).`
      );
    } else {
      r.push(
        `Avantage du terrain : la ligue marque en moyenne ${fr(moy.domicile)} buts à domicile contre ${fr(moy.exterieur)} à l'extérieur. ${libelle}`
      );
    }
    return r;
  }

  const marches = [];

   A. Résultat
  marches.push(
    entree("1", "Résultat", "Victoire domicile", finale.domicile, facteur1N2, qualite,
      raisonsResultat("domicile", `Force offensive de ${nomD} : ${fr(modeleButs.forces.domicile.attaque)} (1,00 = moyenne).`)),
    entree("N", "Résultat", "Match nul", finale.nul, facteur1N2, qualite,
      raisonsResultat("nul", "")),
    entree("2", "Résultat", "Victoire extérieur", finale.exterieur, facteur1N2, qualite,
      raisonsResultat("exterieur", `Force offensive de ${nomE} : ${fr(modeleButs.forces.exterieur.attaque)} (1,00 = moyenne).`))
  );

   B. Double chance
  marches.push(
    entree("1X", "Double chance", "Double chance 1X (domicile ou nul)",
      finale.domicile + finale.nul, facteur1N2, qualite,
      [`Somme de la victoire domicile (${pct(finale.domicile)} %) et du nul (${pct(finale.nul)} %).`, ...raisonsBase]),
    entree("X2", "Double chance", "Double chance X2 (nul ou extérieur)",
      finale.nul + finale.exterieur, facteur1N2, qualite,
      [`Somme du nul (${pct(finale.nul)} %) et de la victoire extérieur (${pct(finale.exterieur)} %).`, ...raisonsBase])
  );

   C. Buts
  function marcheButs(id, seuil, plus) {
    const pPlus = probPlusDeButs(matrice, seuil);
    const a = compterTotal(modeleButs.vuesDomicile, seuil, plus);
    const b = compterTotal(modeleButs.vuesExterieur, seuil, plus);
    const mot = plus ? "Plus" : "Moins";
    const unite = seuil < 2 ? "but" : "buts";
    return entree(
      id,
      "Buts",
      `${mot} de ${fr(seuil, 1)} ${unite}`,
      plus ? pPlus : 1 - pPlus,
      0.85,
      qualite,
      [
        `Total de buts attendu : ${fr(lD + lE)} (${nomD} ${fr(lD)} + ${nomE} ${fr(lE)}).`,
        `${mot} de ${fr(seuil, 1)} ${unite} dans ${a.c} des ${a.n} derniers matchs de ${nomD} et ${b.c} des ${b.n} derniers matchs de ${nomE}.`
      ]
    );
  }
  marches.push(
    marcheButs("plus05", 0.5, true),
    marcheButs("plus15", 1.5, true),
    marcheButs("plus25", 2.5, true),
    marcheButs("plus35", 3.5, true),
    marcheButs("moins25", 2.5, false),
    marcheButs("moins35", 3.5, false)
  );

   D. Autres marchés
  const pBtts = probLesDeuxMarquent(matrice);
  const cD = compterMarque(modeleButs.vuesDomicile);
  const cE = compterMarque(modeleButs.vuesExterieur);
  const raisonsBtts = [
    `Probabilité que chaque équipe marque, d'après les buts attendus : ${nomD} ${fr(lD)}, ${nomE} ${fr(lE)}.`,
    `${nomD} a marqué dans ${cD.marque}/${cD.n} de ses derniers matchs et encaissé dans ${cD.encaisse}/${cD.n}.`,
    `${nomE} a marqué dans ${cE.marque}/${cE.n} de ses derniers matchs et encaissé dans ${cE.encaisse}/${cE.n}.`
  ];
  marches.push(
    entree("btts_oui", "Autres marchés", "Les deux équipes marquent", pBtts, 0.85, qualite, raisonsBtts),
    entree("btts_non", "Autres marchés", "Les deux équipes ne marquent pas", 1 - pBtts, 0.85, qualite, raisonsBtts)
  );

  const top = scoresProbables(matrice, 5);
  marches.push(
    entree("score_exact", "Autres marchés", `Score exact le plus probable : ${top[0].score}`,
      top[0].probabilite, 0.4, qualite, [
        "Calculé sur tous les scores de 0-0 à 10-10 (modèle de Poisson).",
        `Scores suivants : ${top.slice(1, 4).map((s) => `${s.score} (${pct(s.probabilite)} %)`).join(", ")}.`,
                "Le score exact est le marché le plus incertain : sa probabilité reste toujours faible."
      ])
  );

  const indisponibles = [];

  const mt = partPremiereMiTemps(historique, match);
  if (mt) {
    const mMT = matriceScores(lD * mt.part, lE * mt.part, 6);
    const rMT = resultat1N2(mMT);
    const raisonsMT = [
      `Part des buts marqués en 1re mi-temps dans la ligue : ${pct(mt.part)} % (sur ${mt.echantillon} matchs).`,
      `Buts attendus en 1re mi-temps : ${nomD} ${fr(lD * mt.part)} – ${nomE} ${fr(lE * mt.part)}.`
    ];
    marches.push(
      entree("mt_1", "Autres marchés", "Mi-temps : victoire domicile", rMT.domicile, 0.75, qualite, raisonsMT),
      entree("mt_N", "Autres marchés", "Mi-temps : match nul", rMT.nul, 0.75, qualite, raisonsMT),
      entree("mt_2", "Autres marchés", "Mi-temps : victoire extérieur", rMT.exterieur, 0.75, qualite, raisonsMT),
      entree("mt_plus05", "Autres marchés", "Plus de 0,5 but en 1re mi-temps", 1 - mMT[0][0], 0.75, qualite, raisonsMT)
    );
  } else {
    indisponibles.push(
      { marche: "Résultat à la mi-temps", raison: "Donnée indisponible : la source ne fournit pas assez de scores à la mi-temps." },
      { marche: "Plus de 0,5 but en 1re mi-temps", raison: "Donnée indisponible : la source ne fournit pas assez de scores à la mi-temps." }
    );
  }

  const corners = marcheCompteur(historique, match, (m) => m.stats && m.stats.corners);
  if (corners) {
    const raisons = [
      `Corners attendus : ${fr(corners.total, 1)} au total (${nomD} ${fr(corners.modele.lambdaDomicile, 1)} + ${nomE} ${fr(corners.modele.lambdaExterieur, 1)}).`,
      `Moyenne de la ligue : ${fr(corners.moyLigue, 1)} par match ; ligne retenue : ${fr(corners.ligne, 1)}.`,
      `Calculé sur ${corners.modele.echantillonLigue} matchs avec cette statistique (loi de Poisson, approximation).`
    ];
    marches.push(
      entree("corners_plus", "Autres marchés", `Plus de ${fr(corners.ligne, 1)} corners`, corners.plus, 0.85, corners.qualite, raisons),
      entree("corners_moins", "Autres marchés", `Moins de ${fr(corners.ligne, 1)} corners`, 1 - corners.plus, 0.85, corners.qualite, raisons)
    );
  } else {
    indisponibles.push({ marche: "Corners", raison: "Donnée indisponible : pas assez de statistiques de corners fournies par la source." });
  }

  const cartons = marcheCompteur(historique, match, (m) => {
    const j = m.stats && m.stats.cartonsJaunes;
    const r = m.stats && m.stats.cartonsRouges;
    if (!j || !r) return null;
    return { domicile: j.domicile + r.domicile, exterieur: j.exterieur + r.exterieur };
  });
  if (cartons) {
    const raisons = [
      `Cartons attendus (jaunes + rouges) : ${fr(cartons.total, 1)} au total (${nomD} ${fr(cartons.modele.lambdaDomicile, 1)} + ${nomE} ${fr(cartons.modele.lambdaExterieur, 1)}).`,
      `Moyenne de la ligue : ${fr(cartons.moyLigue, 1)} par match ; ligne retenue : ${fr(cartons.ligne, 1)}.`,
      `Calculé sur ${cartons.modele.echantillonLigue} matchs avec cette statistique (loi de Poisson, approximation).`
    ];
    marches.push(
      entree("cartons_plus", "Autres marchés", `Plus de ${fr(cartons.ligne, 1)} cartons`, cartons.plus, 0.85, cartons.qualite, raisons),
      entree("cartons_moins", "Autres marchés", `Moins de ${fr(cartons.ligne, 1)} cartons`, 1 - cartons.plus, 0.85, cartons.qualite, raisons)
    );
  } else {
    indisponibles.push({ marche: "Cartons", raison: "Donnée indisponible : pas assez de statistiques de cartons fournies par la source." });
  }

  return {
    avertissement: AVERTISSEMENT,
    modeles,
    accordModeles: eloDispo ? Number(accord.toFixed(2)) : null,
    ecartModeles: eloDispo ? Number(ecartMax.toFixed(3)) : null,
    butsAttendus: { domicile: Number(fr(lD).replace(",", ".")), exterieur: Number(fr(lE).replace(",", ".")) },
    elo: notes
      ? { domicile: Math.round(notes.domicile), exterieur: Math.round(notes.exterieur) }
      : null,
    qualiteDonnees: {
      score: qualite,
      niveau: niveauQualite(qualite),
      details: [
        `${nomD} : ${modeleButs.matchsDomicile} matchs analysés ; ${nomE} : ${modeleButs.matchsExterieur} matchs analysés.`,
        `Ligue : ${modeleButs.echantillonLigue} matchs (${modeleButs.memeCompetition ? "même compétition" : "toutes compétitions confondues"}).`,
        `Elo : ${eloDispo ? "disponible" : "indisponible (historique insuffisant)"}.`,
        `xG : ${modeleXg ? "disponible" : "indisponible"}.`,
        `Confrontations directes : ${h2h}.`
      ]
    },
    scoresProbables: top.map((s) => ({ score: s.score, probabilite: pct(s.probabilite) })),
    marches,
    indisponibles,
    calculeLe: new Date().toISOString()
  };
}

 Ajoute le champ prediction aux matchs à venir d'aujourd'hui et de demain
 qui ont assez de données. Les autres matchs restent inchangés.
export function enrichirAvecPredictions(matchs, maintenant = new Date()) {
  const aujourdhui = cleJour(maintenant);
  const demain = cleJour(new Date(maintenant.getTime() + 24 * 60 * 60 * 1000));
  return matchs.map((m) => {
    if (m.statut !== "A_VENIR") return m;
    const jour = cleJour(new Date(m.dateUTC));
    if (jour !== aujourdhui && jour !== demain) return m;
    const prediction = predireMatch(m, matchs);
    return prediction ? { ...m, prediction } : m;
  });
}


