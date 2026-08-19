/* Vigilance météorologique de Météo-France.

   Le portail API de Météo-France demande un compte. Le même contenu est publié
   dans le jeu « Vigilance météorologique archivée » sur data.gouv.fr, sans
   compte ni clé, dans le seau `object.files.data.gouv.fr/meteofrance`.

   Arborescence et schéma vérifiés le 19 août 2026 depuis un navigateur, en
   origine croisée. `data/vigilance/metropole/AAAA/MM/JJ/HHMMSS/` porte six
   fichiers, dont `CDP_CARTE_EXTERNE.json`, 190 ko, et
   `CDP_TEXTES_VIGILANCE.json`, 75 ko.

   Réserve importante sur la fraîcheur. Au 19 août 2026, le dernier dépôt de
   l'archive datait du 5 août, soit quatorze jours de retard, alors que le
   document de reprise de « Mon jardin » décrivait six dépôts par jour au 1er
   août. Ce jeu est une archive, non un flux temps réel, et son alimentation est
   irrégulière. Le module rend donc toujours l'âge du bulletin, et l'affichage le
   dit. */

import { enumerer } from "./horloge.js";
import { json, listerPrefixes, listerCles } from "./reseau.js";

const SEAU = "https://object.files.data.gouv.fr/meteofrance";
const RACINE = "data/vigilance/metropole";
const CACHE = "mameteo.vigilance.v2";
const TTL = 30 * 60 * 1000;

/* Jusqu'où remonter. Le document de reprise posait trois jours, ce qui suffisait
   quand l'archive suivait le jour même. Le retard constaté impose bien
   davantage : au delà de vingt et un jours, un bulletin n'apprend plus rien sur
   le temps qu'il fait et le module se tait. */
const JOURS_MAX = 21;

// Au delà de cet âge, le bulletin est annoncé comme périmé.
export const AGE_PERIME = 2;

export const ALEA = {
  1: "vent violent", 2: "pluie et inondation", 3: "orages", 4: "crues",
  5: "neige et verglas", 6: "canicule", 7: "grand froid", 8: "avalanches",
  9: "vagues et submersion",
};

export const COULEUR_NOM = { 2: "jaune", 3: "orange", 4: "rouge" };

/* Ce que chaque aléa demande, dit en une consigne. « Mon jardin » écrivait ces
   consignes pour un jardinier : tuteurer les tiges, rentrer les potées,
   protéger les souches. Elles sont ici générales. */
export const GESTE = {
  1: "Éviter les déplacements, ranger ce qui peut s'envoler.",
  2: "Ne pas s'engager sur une route inondée, s'éloigner des cours d'eau.",
  3: "Rentrer à l'abri, éviter les arbres isolés et les espaces découverts.",
  4: "S'éloigner des berges, ne pas descendre dans les sous-sols.",
  5: "Différer les déplacements, prévoir de quoi attendre en voiture.",
  6: "Boire régulièrement, rester au frais aux heures chaudes.",
  7: "Se couvrir, limiter les efforts et les sorties prolongées.",
  8: "Ne pas s'engager hors des pistes ouvertes.",
  9: "S'éloigner du littoral et des ouvrages portuaires.",
};

/* Une vigilance couvre l'alerte calculée de même nature : sans cette règle, le
   bandeau affichait « Vigilance jaune, canicule » suivi immédiatement de
   « 33 degrés demain ». */
export const COUVRE = { 1: "vent", 2: "eau", 6: "chaud", 7: "froid" };

const deux = n => String(n).padStart(2, "0");
const cleJourUTC = d => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

/* Les domaines de la carte mêlent départements et zones. Le relevé du 5 août
   portait 122 domaines, dont « FRA » pour le pays et des codes à quatre chiffres
   comme « 3010 » ou « 0610 » pour les zones. Seuls les codes à deux caractères
   désignent un département métropolitain, Corse comprise avec 2A et 2B. */
const estDepartement = d => typeof d === "string" && d.length === 2;

/* Le dernier dépôt disponible. L'arborescence descend par année, mois, jour,
   puis horodatage : le listage remonte de jour en jour et retient le dernier
   horodatage du premier jour renseigné. */
async function dernierDepot() {
  const auj = new Date();
  for (let k = 0; k <= JOURS_MAX; k++) {
    const j = new Date(auj.getTime() - k * 86400000);
    const p = `${RACINE}/${j.getFullYear()}/${deux(j.getMonth() + 1)}/${deux(j.getDate())}/`;
    let sous;
    try { sous = await listerPrefixes(SEAU, p); }
    catch { continue; }
    if (sous.length) return { chemin: sous.sort().pop(), jour: cleJourUTC(j), age: k };
  }
  return null;
}

/* Traduction de la carte vers une ligne par échéance.

   Schéma relevé : `product.periods[]`, deux entrées d'échéance « J » et « J1 »,
   chacune portant `timelaps.domain_ids[]`. Un domaine porte `domain_id`,
   `max_color_id` et `phenomenon_items[]`, chaque aléa portant `phenomenon_id`,
   sous forme de chaîne, et `phenomenon_max_color_id`. */
function lignesDeLaCarte(carte, departement) {
  const p = carte?.product || carte || {};
  const periodes = p.periods || [];
  const emisLe = p.update_time || null;
  const out = [];

  for (const periode of periodes) {
    const domaines = periode?.timelaps?.domain_ids || [];
    for (const dom of domaines) {
      const id = dom.domain_id;
      if (!estDepartement(id) || id !== departement) continue;
      const phenomenes = (dom.phenomenon_items || [])
        .map(f => ({
          id: Number(f.phenomenon_id),
          couleur: Number(f.phenomenon_max_color_id ?? 1),
        }))
        .filter(f => Number.isFinite(f.id) && f.couleur > 1)
        .sort((a, b) => b.couleur - a.couleur || a.id - b.id);
      out.push({
        echeance: String(periode.echeance || "J").toUpperCase().startsWith("J1") ? "J1" : "J",
        couleur: Number(dom.max_color_id ?? 1),
        phenomenes,
        debut: periode.begin_validity_time || null,
        fin: periode.end_validity_time || null,
        texte: "",
        emis_le: emisLe,
      });
    }
  }
  return out.sort((a, b) => a.echeance.localeCompare(b.echeance));
}

/* Le bulletin départemental.

   Schéma relevé : `product.text_bloc_items[]`, un bloc par domaine, portant
   `bloc_title` et `bloc_items[]`. Chaque élément porte `text_items[]`, chacun
   `term_items[]`, chacun `subdivision_text[]` où se trouvent enfin `bold_text`
   et `text`, ce dernier étant un tableau de chaînes. */
function texteDuDepartement(textes, departement) {
  const p = textes?.product || textes || {};
  const bloc = (p.text_bloc_items || []).find(b => b.domain_id === departement);
  if (!bloc) return "";
  const morceaux = [];
  for (const item of bloc.bloc_items || []) {
    for (const ti of item.text_items || []) {
      for (const term of ti.term_items || []) {
        for (const sub of term.subdivision_text || []) {
          const titre = (sub.bold_text || "").trim();
          const corps = (sub.text || []).map(x => String(x).trim()).filter(Boolean).join(" ");
          if (corps) morceaux.push(titre ? `${titre} ${corps}` : corps);
        }
      }
    }
  }
  return morceaux.join("\n");
}

/* Charge la vigilance d'un département.

   Rend `{ etat, lignes, jour, age }`. `etat` vaut « ok », « vide » quand la
   source répond sans rien porter pour ce département, « perime » quand le
   dernier dépôt est trop ancien pour être présenté comme actuel, ou
   « indisponible » quand la source n'est pas atteignable. */
export async function charger(departement) {
  if (!departement) return { etat: "vide", lignes: [], jour: null, age: null };

  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || "null");
    if (c && c.dep === departement && Date.now() - c.t < TTL) {
      return { etat: c.etat, lignes: c.lignes, jour: c.jour, age: c.age };
    }
  } catch { /* cache indisponible */ }

  let res;
  try {
    const depot = await dernierDepot();
    if (!depot) {
      res = { etat: "vide", lignes: [], jour: null, age: null };
    } else {
      const fichiers = await listerCles(SEAU, depot.chemin);
      const nom = f => fichiers.find(x => x.endsWith(f));
      const carte = nom("CDP_CARTE_EXTERNE.json");
      if (!carte) throw new Error("carte absente du dépôt");
      const lignes = lignesDeLaCarte(await json(`${SEAU}/${carte}`), departement);

      const bulletin = nom("CDP_TEXTES_VIGILANCE.json");
      if (bulletin && lignes.length) {
        try {
          const texte = texteDuDepartement(await json(`${SEAU}/${bulletin}`), departement);
          for (const l of lignes) l.texte = texte;
        } catch { /* le bulletin est un complément, son absence n'empêche rien */ }
      }
      const etat = !lignes.length ? "vide" : depot.age > AGE_PERIME ? "perime" : "ok";
      res = { etat, lignes, jour: depot.jour, age: depot.age };
    }
  } catch {
    res = { etat: "indisponible", lignes: [], jour: null, age: null };
  }

  try { sessionStorage.setItem(CACHE, JSON.stringify({ dep: departement, t: Date.now(), ...res })); }
  catch { /* stockage indisponible */ }
  return res;
}

/* Le niveau retenu est le plus élevé des deux échéances : une vigilance orange
   annoncée pour demain compte autant qu'une vigilance en cours, et le libellé le
   précise. Le vert n'est pas une alerte et ne s'affiche pas.

   Un bulletin périmé ne remonte pas au bandeau : annoncer une canicule vieille
   de deux semaines serait pire que se taire. Il reste consultable dans sa
   feuille, daté. */
export function duJour(charge) {
  if (!charge || charge.etat !== "ok") return null;
  const lot = (charge.lignes || []).filter(v => v.couleur > 1);
  if (!lot.length) return null;
  const couleur = Math.max(...lot.map(v => v.couleur));
  const ids = [];
  for (const v of lot) {
    for (const p of v.phenomenes || []) {
      if (p.couleur === couleur && !ids.includes(p.id)) ids.push(p.id);
    }
  }
  if (!ids.length) return null;
  const demainSeul = !lot.some(v => v.echeance === "J" && v.couleur === couleur);
  return {
    couleur, ids,
    libelle: enumerer(ids.map(i => ALEA[i] || `phénomène ${i}`)) + (demainSeul ? ", demain" : ""),
    geste: ids.map(i => GESTE[i]).find(Boolean) || "",
    texte: lot.map(v => v.texte).find(Boolean) || "",
    emisLe: lot.map(v => v.emis_le).find(Boolean) || null,
  };
}
