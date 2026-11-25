// Format normalisé d'un match :
// {
//   id: "identifiant-unique",
//   competition: "Nom de la compétition",
//   dateUTC: "2026-11-25T19:00:00Z",
//   statut: "LIVE" | "A_VENIR" | "TERMINE",
//   minute: 63,                       (facultatif, pour LIVE)
//   domicile: { nom: "Équipe A", logo: "https://..." ou null },
//   exterieur: { nom: "Équipe B", logo: "https://..." ou null },
//   scoreDomicile: 1 ou null,
//   scoreExterieur: 0 ou null
// }
//
// Chaque source de données est un "connecteur" :
// un objet { nom, charger } où charger() renvoie une liste de matchs
// au format ci-dessus. Aucune donnée n'est inventée.

const CONNECTEURS = [];

const STATUTS = ["LIVE", "A_VENIR", "TERMINE"];

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

  const matchs = [];
  const dejaVus = new Set();

  for (const r of resultats) {
    if (r.status !== "fulfilled") continue;
    for (const m of r.value) {
      if (!estValide(m) || dejaVus.has(m.id)) continue;
      dejaVus.add(m.id);
      matchs.push(m);
    }
  }

  return matchs;
}
