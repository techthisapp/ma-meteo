/* La pluie dans l'heure.

   La question est celle qu'on se pose la main sur la poignée : est-ce que je
   pars maintenant. Une prévision horaire n'y répond pas, une averse de vingt
   minutes tenant tout entière dans son heure.

   La source devait être l'extrapolation de RainViewer, lue au pixel dans les
   tuiles du lot 4a-2. Elle ne l'est pas : le champ `nowcast` de son index était
   vide aux trois relevés des 5 et 6 septembre 2026, à deux heures puis à un jour
   d'intervalle, alors que le service l'annonce dans son offre publique. Une
   fonction ne se bâtit pas sur un champ que la source ne sert pas.

   Reste le produit « pluie dans l'heure » de Météo-France, sur le service qui
   porte déjà la vigilance et avec le même jeton public. Mesuré le 6 septembre :
   1163 octets, neuf échéances, pas de cinq minutes sur la première demi-heure
   puis de dix, produit refait toutes les cinq minutes. C'est la référence
   nationale sur cette échéance, et elle coûte moins qu'une tuile.

   Ce qu'elle rend est une intensité ordinale, non une lame d'eau. L'application
   ne l'écrit donc jamais en millimètres : les quantités restent sur la série
   horaire, qui vient d'un autre modèle et les contredirait. */

import { JETON } from "./vigilance.js";

const SERVICE = "https://webservice.meteofrance.com/v3/nowcast/rain";

/* Le repli, là où le radar de Météo-France ne couvre pas. Mesuré le 7 septembre
   2026 sur Ajaccio, Briançon et Gaillard, les trois points relevés sans
   couverture : 247 octets pour huit pas de quinze minutes, 282 pour vingt-quatre.

   La colonne vient d'un modèle et non d'un radar. Elle est donc plus grossière,
   au pas du quart d'heure au lieu de cinq minutes. Sans elle, la Corse et les
   reliefs n'ont aucun compte à rebours. */
const REPLI = "https://api.open-meteo.com/v1/forecast";
const REPLI_PAS = 5;          // cinq pas de quinze minutes couvrent l'heure
export const PAS_MF = 5;      // minutes, pas de la source de Météo-France
export const PAS_REPLI = 15;  // minutes, pas du repli

/* Les bornes d'intensité du repli, en millimètres par heure. Ce sont celles de
   la classification usuelle des pluies : faible en dessous de 2,5, modérée
   jusqu'à 7,6, forte au delà. Le seuil d'entrée est celui que l'application
   emploie déjà sur la série horaire, un dixième de millimètre. */
export const SEUILS_REPLI = { lame: 0.1, moderee: 2.5, forte: 7.6 };

/* Le produit se refait toutes les cinq minutes. Le garder trois est sans risque
   et évite qu'un aller-retour entre deux écrans redemande à chaque fois. */
export const GARDE = 3 * 60 * 1000;

/* L'échelle de la source. Zéro n'est pas du temps sec : c'est l'absence de
   valeur, et la confondre avec du sec ferait annoncer une heure au sec là où la
   source ne sait rien. */
export const INTENSITES = [
  { rang: 0, nom: "Pas de valeur", pluie: false },
  { rang: 1, nom: "Temps sec", pluie: false },
  { rang: 2, nom: "Pluie faible", pluie: true },
  { rang: 3, nom: "Pluie modérée", pluie: true },
  { rang: 4, nom: "Pluie forte", pluie: true },
];

export const estPluie = i => INTENSITES[i] ? INTENSITES[i].pluie : false;
export const nomDe = i => (INTENSITES[i] ? INTENSITES[i].nom : "Pas de valeur");

const gardes = new Map();
const cle = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

/* La lecture de la réponse.

   Le drapeau `rain_product_available` fait foi. Mesuré le 6 septembre : Ajaccio,
   Briançon et Gaillard rendent neuf échéances toutes à « Temps sec » avec le
   drapeau à zéro, le radar ne couvrant pas ces reliefs. Lire ces neuf échéances
   sans regarder le drapeau ferait annoncer une heure au sec là où l'on ne sait
   rien. */
export function lire(d) {
  const p = d && d.properties;
  if (!p || !Array.isArray(p.forecast)) return null;
  const pas = p.forecast
    .map(x => ({ t: Date.parse(x.time), i: Number(x.rain_intensity) }))
    .filter(x => Number.isFinite(x.t) && Number.isFinite(x.i))
    .sort((a, b) => a.t - b.t);
  if (!pas.length) return null;
  return {
    dispo: p.rain_product_available === 1,
    nom: p.name || null,
    maj: Date.parse(d.update_time) || null,
    pas,
    source: "meteofrance",
    pasMinutes: PAS_MF,
  };
}

/* La lecture du repli. Une lame d'eau en millimètres par pas de quinze minutes
   devient le même rang ordinal que celui de Météo-France, pour que la phrase se
   lise pareil quelle que soit la source qui l'a nourrie. */
export function lireRepli(d) {
  const m = d && d.minutely_15;
  if (!m || !Array.isArray(m.time) || !Array.isArray(m.precipitation)) return null;
  const parHeure = 60 / PAS_REPLI;
  const pas = m.time.map((t, k) => {
    const mm = m.precipitation[k];
    if (!Number.isFinite(mm)) return { t: Date.parse(`${t}:00`), i: 0 };
    const taux = mm * parHeure;
    const i = mm < SEUILS_REPLI.lame ? 1
      : taux < SEUILS_REPLI.moderee ? 2
        : taux < SEUILS_REPLI.forte ? 3 : 4;
    return { t: Date.parse(`${t}:00`), i };
  }).filter(x => Number.isFinite(x.t));
  if (pas.length < 2) return null;
  return { dispo: true, nom: null, maj: null, pas, source: "repli", pasMinutes: PAS_REPLI };
}

async function chargerRepli(lat, lon, fetcheur) {
  const u = `${REPLI}?latitude=${lat}&longitude=${lon}`
    + `&timezone=${encodeURIComponent("Europe/Paris")}`
    + `&minutely_15=precipitation&forecast_minutely_15=${REPLI_PAS}`;
  try {
    const r = await fetcheur(u);
    if (!r.ok) return null;
    return lireRepli(await r.json());
  } catch { return null; }
}

/* Le produit de Météo-France d'abord, le repli ensuite. Le repli part quand le
   radar ne couvre pas le point, et quand le service reste muet. */
export async function charger(lat, lon, fetcheur = fetch) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const k = cle(lat, lon);
  const g = gardes.get(k);
  if (g && Date.now() < g.exp) return g.d;
  let d = null;
  try {
    const r = await fetcheur(`${SERVICE}?lat=${lat}&lon=${lon}&token=${JETON}`);
    if (r.ok) d = lire(await r.json());
  } catch { d = null; }
  if (!d || !d.dispo) d = await chargerRepli(lat, lon, fetcheur);
  gardes.set(k, { d, exp: Date.now() + GARDE });
  return d;
}

// Pour les contrôles : la garde se jette.
export function oublier() { gardes.clear(); }

/* Ce qu'il y a à dire, ou rien.

   Trois cas, et un seul se dit à la fois. La pluie tombe et s'arrête dans
   l'heure ; elle tombe et ne s'arrête pas dans l'heure ; elle commence dans
   l'heure. Une heure entièrement sèche ne se dit pas : un encart qui répète
   « pas de pluie » à chaque ouverture cesse d'être lu, et l'application dit déjà
   le temps qu'il fait juste au-dessous.

   La force annoncée est la plus forte de l'épisode, non celle de sa première
   échéance : une averse qui commence faible et devient forte se dit forte. */
export function evenement(l, maintenant = Date.now()) {
  if (!l || !l.dispo) return null;
  /* La tolérance vers le passé vaut un pas de la source. Un pas de quinze
     minutes déjà entamé porte encore l'état du moment présent. */
  const marge = (l.pasMinutes || PAS_MF) * 60000;
  const pas = l.pas.filter(x => x.t >= maintenant - marge);
  if (pas.length < 2) return null;

  /* Trois états et non deux. Le rang zéro n'est pas du temps sec : c'est
     l'absence de valeur, et une échéance sans valeur arrête la lecture au lieu
     de la conclure. Une averse suivie de deux échéances muettes ne s'arrête pas
     dans dix minutes : on ne sait pas quand elle s'arrête, et le dire serait
     inventer une fin que la source ne donne pas. */
  const eau = x => (x.i === 0 ? null : estPluie(x.i));
  const etat = pas.map(eau);
  if (etat[0] === null) return null;

  if (etat[0] === true) {
    let fin = -1, coupe = pas.length;
    for (let k = 1; k < pas.length; k++) {
      if (etat[k] === null) { coupe = k; break; }
      if (etat[k] === false) { fin = k; break; }
    }
    const jusqua = fin < 0 ? coupe : fin;
    const force = Math.max(...pas.slice(0, jusqua).map(x => x.i));
    if (fin < 0) return { genre: "encore", force, t: null, fin: null };
    return { genre: "fin", force, t: pas[fin].t, fin: pas[fin].t };
  }

  let debut = -1;
  for (let k = 0; k < pas.length; k++) {
    if (etat[k] === null) break;
    if (etat[k] === true) { debut = k; break; }
  }
  if (debut < 0) return null;
  let apres = -1, coupe = pas.length;
  for (let k = debut + 1; k < pas.length; k++) {
    if (etat[k] === null) { coupe = k; break; }
    if (etat[k] === false) { apres = k; break; }
  }
  const bout = apres < 0 ? coupe : apres;
  const force = Math.max(...pas.slice(debut, bout).map(x => x.i));
  return { genre: "debut", force, t: pas[debut].t, fin: apres < 0 ? null : pas[apres].t };
}

/* Les minutes qui restent, arrondies au pas de la source. Le radar de
   Météo-France travaille au pas de cinq minutes, le repli au pas de quinze.
   Écrire « dans 23 minutes » donnerait à l'un comme à l'autre une précision de
   chronomètre. */
export const minutesJusqua = (t, maintenant = Date.now(), pas = PAS_MF) =>
  Math.max(0, Math.round((t - maintenant) / 60000 / pas) * pas);

export function delaiTxt(min) {
  if (min <= 0) return "à l'instant";
  if (min < 60) return `dans ${min} minutes`;
  return "dans une heure";
}

/* La phrase. Elle dit ce qui change, et l'heure de fin ne s'ajoute que lorsque
   la source la connaît : une averse qui déborde l'heure n'a pas de fin connue,
   et en inventer une serait mentir sur ce qu'on sait. */
export function phrase(ev, maintenant = Date.now(), pas = PAS_MF) {
  if (!ev) return null;
  const nom = nomDe(ev.force);
  if (ev.genre === "encore") return `${nom}, sans accalmie dans l'heure.`;
  if (ev.genre === "fin") {
    const m = minutesJusqua(ev.t, maintenant, pas);
    return m <= 0 ? `${nom}, qui s'arrête à l'instant.`
      : `${nom}, qui s'arrête ${delaiTxt(m)}.`;
  }
  const m = minutesJusqua(ev.t, maintenant, pas);
  const debut = m <= 0 ? `${nom} à l'instant` : `${nom} ${delaiTxt(m)}`;
  if (ev.fin === null) return `${debut}.`;
  const duree = Math.max(pas, Math.round((ev.fin - ev.t) / 60000 / pas) * pas);
  return `${debut}, pendant ${duree} minutes environ.`;
}
