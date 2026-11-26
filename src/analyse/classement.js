// Classement automatique des matchs du jour : « MEILLEURES ANALYSES DU JOUR ».
//
// Ce classement mesure la FIABILITÉ STATISTIQUE de l'analyse d'un match.
// Il n'utilise jamais la hauteur d'une probabilité : un match n'est pas
// mieux classé parce qu'un résultat paraît probable. Il n'a aucun but
// commercial.
//
// Six critères, chacun noté de 0 à 100 :
//   qualité des données (25 %), quantité de statistiques (15 %),
//   régularité des équipes (15 %), cohérence des indicateurs (15 %),
//   solidité du modèle (15 %), incertitude des probabilités (15 %).
// Un critère impossible à calculer vaut 0 et apparaît comme point faible.
//
//   VERT   : score de 70 et plus, données de qualité 60 et plus, et un
//            modèle de prédiction calculé
//   ORANGE : score de 40 à 69, ou VERT impossible faute de modèle ou de données
//   ROUGE  : score inférieur à 40

import { ELO_AVANTAGE } from "../prediction/outils.js";

const FUSEAU = "Africa/Porto-Novo";
const MAX_MODELES = 3;

function cleJour(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function borne(v) {
  return Math.max(0, Math.min(100, v));
}

function direction(valeur, seuil) {
  if (valeur >= seuil) return "domicile";
  if (valeur <= -seuil) return "exterieur";
  return "equilibre";
}

function aMarche(prediction, id) {
  return !!prediction && prediction.marches.some((m) => m.id === id);
}

function critereDonnees(analyse) {
  return {
    score: borne(analyse.score),
    detail: `Qualité des données de l'analyse : ${analyse.score}/100.`
  };
}

function critereQuantite(analyse, prediction) {
  const elements = [
    {
      ok: analyse.domicile.global.matchs >= 10 && analyse.exterieur.global.matchs >= 10,
      label: "10 derniers matchs de chaque équipe"
    },
    {
      ok:
        analyse.domicile.domicile.matchs >= 5 &&
        analyse.exterieur.exterieur.matchs >= 5,
      label: "5 matchs à domicile et à l'extérieur"
    },
    { ok: analyse.confrontations.matchs >= 3, label: "confrontations directes" },
    { ok: !!(analyse.domicile.xg && analyse.exterieur.xg), label: "xG et xGA" },
    { ok: !!analyse.absences, label: "absences et blessures" },
    { ok: aMarche(prediction, "corners_plus"), label: "statistiques de corners" },
    { ok: aMarche(prediction, "cartons_plus"), label: "statistiques de cartons" },
    { ok: aMarche(prediction, "mt_1"), label: "scores à la mi-temps" }
  ];
  const disponibles = elements.filter((e) => e.ok).length;
  const manquants = elements.filter((e) => !e.ok).map((e) => e.label);
  return {
    score: (100 * disponibles) / elements.length,
    detail:
      `${disponibles} types de données disponibles sur ${elements.length}.` +
      (manquants.length > 0 ? ` Manquants : ${manquants.join(", ")}.` : "")
  };
}

function critereRegularite(analyse) {
  const d = analyse.domicile.regularite;
  const e = analyse.exterieur.regularite;
  if (d === null || e === null) {
    return {
      score: null,
      detail: "Régularité indisponible : moins de 5 matchs pour une des équipes."
    };
  }
  return {
    score: borne((d + e) / 2),
    detail: `Régularité des résultats : ${d}/100 (domicile) et ${e}/100 (extérieur).`
  };
}

function critereCoherence(analyse, prediction) {
  const indicateurs = [];

  if (analyse.ecartNiveau) {
    indicateurs.push({
      nom: "niveau récent",
      dir: analyse.ecartNiveau.avantage
    });
  }
  const pd = analyse.domicile.pointsForme;
  const pe = analyse.exterieur.pointsForme;
  if (pd !== null && pe !== null) {
    indicateurs.push({ nom: "forme récente", dir: direction((pd - pe) / 5, 0.5) });
  }
  if (prediction) {
    indicateurs.push({
      nom: "buts attendus",
      dir: direction(
        prediction.butsAttendus.domicile - prediction.butsAttendus.exterieur,
        0.3
      )
    });
    if (prediction.elo) {
      indicateurs.push({
        nom: "classement Elo",
        dir: direction(
          prediction.elo.domicile + ELO_AVANTAGE - prediction.elo.exterieur,
          40
        )
      });
    }
  }

  if (indicateurs.length < 2) {
    return {
      score: null,
      detail: "Cohérence indisponible : moins de 2 indicateurs disponibles."
    };
  }

  let paires = 0;
  let accord = 0;
  for (let i = 0; i < indicateurs.length; i++) {
    for (let j = i + 1; j < indicateurs.length; j++) {
      paires += 1;
      const a = indicateurs[i].dir;
      const b = indicateurs[j].dir;
      if (a === b) accord += 1;
      else if (a === "equilibre" || b === "equilibre") accord += 0.5;
    }
  }

  const noms = indicateurs.map((x) => x.nom).join(", ");
  return {
    score: (100 * accord) / paires,
    detail: `Accord entre ${indicateurs.length} indicateurs (${noms}).`
  };
}

function critereSolidite(prediction) {
  if (!prediction) {
    return { score: null, detail: "Aucun modèle de prédiction calculé." };
  }
  const n = prediction.modeles.length;
  return {
    score: borne(
      100 * (0.4 * (n / MAX_MODELES) + 0.6 * (prediction.qualiteDonnees.score / 100))
    ),
    detail: `${n} modèle(s) : ${prediction.modeles.join(", ")} ; qualité des données du modèle : ${prediction.qualiteDonnees.score}/100.`
  };
}

function critereIncertitude(prediction) {
  if (!prediction) {
    return { score: null, detail: "Aucun modèle de prédiction calculé." };
  }
  if (prediction.accordModeles !== null && prediction.accordModeles !== undefined) {
    const ecart = Math.round(prediction.ecartModeles * 100);
    return {
      score: borne(100 * prediction.accordModeles),
      detail: `Écart maximal entre Poisson et Elo : ${ecart} points de pourcentage.`
    };
  }
  return {
    score: 40,
    detail:
      "Un seul type de modèle disponible : l'incertitude ne peut pas être mesurée."
  };
}

const CRITERES = [
  { id: "donnees", nom: "Qualité des données", poids: 25 },
  { id: "quantite", nom: "Quantité de statistiques", poids: 15 },
  { id: "regularite", nom: "Régularité des équipes", poids: 15 },
  { id: "coherence", nom: "Cohérence des indicateurs", poids: 15 },
  { id: "solidite", nom: "Solidité du modèle", poids: 15 },
  { id: "incertitude", nom: "Incertitude des probabilités", poids: 15 }
];

export function classerMatch(match) {
  const analyse = match.analyse;
  if (!analyse) return null;
  const prediction = match.prediction || null;

  const calcules = {
    donnees: critereDonnees(analyse),
    quantite: critereQuantite(analyse, prediction),
    regularite: critereRegularite(analyse),
    coherence: critereCoherence(analyse, prediction),
    solidite: critereSolidite(prediction),
    incertitude: critereIncertitude(prediction)
  };

  const criteres = CRITERES.map((c) => {
    const r = calcules[c.id];
    return {
      id: c.id,
      nom: c.nom,
      poids: c.poids,
      score: r.score === null ? null : Math.round(r.score),
      detail: r.detail
    };
  });

  const total = Math.round(
    criteres.reduce((somme, c) => somme + (c.poids * (c.score || 0)) / 100, 0)
  );

  const donnees = calcules.donnees.score;
  let categorie = "ROUGE";
  if (total >= 70 && donnees >= 60 && prediction) categorie = "VERT";
  else if (total >= 40) categorie = "ORANGE";

  const forces = criteres
    .filter((c) => c.score !== null && c.score >= 70)
    .map((c) => `${c.nom} : ${c.detail}`);
  const faiblesses = criteres
    .filter((c) => c.score === null || c.score < 40)
    .map((c) => `${c.nom} : ${c.detail}`);
  if (!prediction) {
    faiblesses.push(
      "Pas de modèle de prédiction pour ce match (match déjà commencé ou données insuffisantes) : la catégorie VERT n'est pas possible."
    );
  }

  return { score: total, categorie, criteres, forces, faiblesses };
}

// Ajoute le champ classement aux matchs du jour déjà analysés et non terminés.
export function enrichirAvecClassement(matchs, maintenant = new Date()) {
  const aujourdhui = cleJour(maintenant);
  return matchs.map((m) => {
    if (m.statut === "TERMINE" || !m.analyse) return m;
    if (cleJour(new Date(m.dateUTC)) !== aujourdhui) return m;
    const classement = classerMatch(m);
    return classement ? { ...m, classement } : m;
  });
}

// Matchs classés, du plus fiable au moins fiable. Aucune probabilité n'entre
// dans le tri : en cas d'égalité, la meilleure qualité des données passe devant,
// puis l'heure du match.
export function matchsClasses(matchs) {
  return matchs
    .filter((m) => m.classement)
    .sort((a, b) => {
      if (b.classement.score !== a.classement.score) {
        return b.classement.score - a.classement.score;
      }
      const da = a.classement.criteres[0].score || 0;
      const db = b.classement.criteres[0].score || 0;
      if (db !== da) return db - da;
      return new Date(a.dateUTC) - new Date(b.dateUTC);
    });
}

// FIN DU FICHIER
