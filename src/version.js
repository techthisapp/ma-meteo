/* La version de l'application et la recherche d'une version plus récente.

   Le numéro est celui de la coque hors ligne, porté par `sw.js` sous la forme
   « ma-meteo-v77 ». Il est écrit ici une seconde fois, parce que le service
   worker ne peut pas importer un module ; une garde vérifie que les deux
   disent la même chose, ce qui rattrape un oubli au moment de monter la
   version.

   Une version plus récente se reconnaît au numéro que porte le `sw.js` publié.
   L'application charge sa coque par le réseau d'abord : un simple
   rechargement suffit donc à prendre la dernière version. Ce qui manquait,
   c'est de savoir qu'elle existe pendant que l'application reste ouverte en
   arrière-plan, parfois des jours sur iPhone. Demandé le 23 septembre 2026. */

export const VERSION = "ma-meteo-v78";

export const numeroDe = v => {
  const m = /-v(\d+)$/.exec(v || "");
  return m ? Number(m[1]) : null;
};
export const numero = () => numeroDe(VERSION);

/* Le numéro publié, lu dans `sw.js` sans passer par aucun cache : l'adresse
   porte un paramètre qui change à chaque lecture. Rend null quand la lecture
   échoue, hors ligne notamment : on ne propose rien sur un doute. */
export async function publiee(fetcheur = fetch) {
  try {
    const r = await fetcheur(`./sw.js?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const m = /const VERSION = "([^"]+)"/.exec(await r.text());
    return m ? numeroDe(m[1]) : null;
  } catch {
    return null;
  }
}

/* Une version plus récente, ou null. Seule une version supérieure compte : un
   déploiement en cours peut servir un instant l'ancien fichier, et proposer de
   « mettre à jour » vers une version plus ancienne serait faux. */
export async function plusRecente(fetcheur = fetch) {
  const p = await publiee(fetcheur);
  const n = numero();
  return p !== null && n !== null && p > n ? p : null;
}
