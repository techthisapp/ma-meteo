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
import { recaler, chercher, instantParis, heureJour } from "./horloge.js";
import { SEUIL_LAME } from "./previsions.js";

const SERVICE = "https://webservice.meteofrance.com/v3/nowcast/rain";

/* Le repli, là où le radar de Météo-France ne couvre pas. Mesuré le 7 septembre
   2026 sur Ajaccio, Briançon et Gaillard, les trois points relevés sans
   couverture : 247 octets pour huit pas de quinze minutes, 282 pour vingt-quatre.

   La colonne vient d'un modèle et non d'un radar. Elle est donc plus grossière,
   au pas du quart d'heure au lieu de cinq minutes. Sans elle, la Corse et les
   reliefs n'ont aucun compte à rebours. */
const REPLI = "https://api.open-meteo.com/v1/forecast";
const REPLI_PAS = 5;          // cinq pas de quinze minutes couvrent l'heure
/* Les trois heures, depuis la version 169, demande de Jérôme du 4 octobre
   2026. Le radar s'arrête à l'heure ; la suite vient du même modèle au quart
   d'heure, treize pas de maintenant à trois heures et quart. La colonne est
   lue en même temps que le radar, quelques centaines d'octets. */
const SUITE_PAS = 13;
export const HORIZON = 3 * 3600000;
export const PAS_MF = 5;      // minutes, pas de la source de Météo-France
export const PAS_REPLI = 15;  // minutes, pas du repli

/* Les bornes d'intensité du repli, en millimètres par heure. Ce sont celles de
   la classification usuelle des pluies : faible en dessous de 2,5, modérée
   jusqu'à 7,6, forte au delà. Le seuil d'entrée est celui que l'application
   emploie déjà sur la série horaire, un dixième de millimètre. */
export const SEUILS_REPLI = { lame: SEUIL_LAME, moderee: 2.5, forte: 7.6 };

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
    if (!Number.isFinite(mm)) return { t: instantParis(t), i: 0 };
    const taux = mm * parHeure;
    const i = mm < SEUILS_REPLI.lame ? 1
      : taux < SEUILS_REPLI.moderee ? 2
        : taux < SEUILS_REPLI.forte ? 3 : 4;
    return { t: instantParis(t), i };
  }).filter(x => Number.isFinite(x.t));
  if (pas.length < 2) return null;
  return { dispo: true, nom: null, maj: null, pas, source: "repli", pasMinutes: PAS_REPLI };
}

async function chargerModele(lat, lon, fetcheur) {
  const u = `${REPLI}?latitude=${lat}&longitude=${lon}`
    + `&timezone=${encodeURIComponent("Europe/Paris")}`
    + `&minutely_15=precipitation&forecast_minutely_15=${SUITE_PAS}`;
  try {
    const r = await fetcheur(u);
    if (!r.ok) return null;
    return lireRepli(recaler(await r.json()));
  } catch { return null; }
}

/* La fin de l'heure que couvre une lecture : sa dernière échéance, plus le
   pas qui la précède. */
export const finDe = pas => (pas.length < 2 ? null
  : pas[pas.length - 1].t + (pas[pas.length - 1].t - pas[pas.length - 2].t));

/* Le modèle se partage entre l'heure et sa suite. Sans radar, ses cinq
   premiers pas tiennent l'heure, comme avant la version 169, et le reste en
   est la suite. Avec le radar, la suite commence au pas du modèle qui couvre
   la fin de l'heure du radar. */
function suiteDe(modele, fin) {
  if (!modele || !Number.isFinite(fin)) return [];
  return modele.pas.filter(x => x.t + PAS_REPLI * 60000 > fin);
}

/* Le voisinage, depuis la version 168, demande de Jérôme du 4 octobre 2026.
   Le produit répond pour un point, et une averse qui passe à deux kilomètres
   change toute la réponse. Quatre points de plus, à trois kilomètres environ au
   nord, à l'est, au sud et à l'ouest, disent si la pluie rôde autour : mille
   deux cents octets chacun, lus en même temps que le point lui-même.

   Les quatre points se déduisent du point déjà arrondi au centième de degré et
   s'arrondissent de même : le service n'en apprend pas davantage sur le lieu. */
export const ECART_VOISIN = 0.03;   // degrés de latitude, 3,3 kilomètres
const centieme = v => Math.round(v * 100) / 100;
export function voisinsDe(lat, lon) {
  const dLon = ECART_VOISIN / Math.cos(lat * Math.PI / 180);
  return [[ECART_VOISIN, 0], [0, dLon], [-ECART_VOISIN, 0], [0, -dLon]]
    .map(([a, b]) => [centieme(lat + a), centieme(lon + b)]);
}

async function lireProduit(lat, lon, fetcheur) {
  try {
    const r = await fetcheur(`${SERVICE}?lat=${lat}&lon=${lon}&token=${JETON}`);
    return r.ok ? lire(await r.json()) : null;
  } catch { return null; }
}

/* Le produit de Météo-France d'abord, le repli ensuite. Le repli part quand le
   radar ne couvre pas le point, et quand le service reste muet. Les voisins se
   lisent en même temps que le point, pour ne rien ajouter à l'attente ; le
   repli n'en tient pas compte, sa maille de modèle étant déjà plus large
   qu'eux. */
export async function charger(lat, lon, fetcheur = chercher) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const k = cle(lat, lon);
  const g = gardes.get(k);
  if (g && Date.now() < g.exp) return g.d;
  const [modele, centre, ...autour] = await Promise.all([
    chargerModele(lat, lon, fetcheur),
    ...[[lat, lon], ...voisinsDe(lat, lon)].map(([a, b]) => lireProduit(a, b, fetcheur)),
  ]);
  let d = centre;
  if (d && d.dispo) {
    d.voisins = autour.filter(v => v && v.dispo);
    d.suite = suiteDe(modele, finDe(d.pas));
  } else if (modele) {
    d = { ...modele, pas: modele.pas.slice(0, REPLI_PAS) };
    d.suite = suiteDe(modele, finDe(d.pas));
    if (d.pas.length < 2) d = null;
  } else d = null;
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

/* La pluie autour, échéance par échéance : le rang le plus fort que portent les
   voisins au même instant que le point. Zéro quand aucun voisin ne sait. */
export function alentour(l, pas) {
  const v = (l && l.voisins) || [];
  return pas.map(x => {
    let m = 0;
    for (const w of v) {
      const y = w.pas.find(z => Math.abs(z.t - x.t) < 60000);
      if (y && y.i > m) m = y.i;
    }
    return m;
  });
}

/* La pluie qui passe tout près sans être prévue sur le point. Elle ne se dit
   que si le point lui-même est connu au sec maintenant : un point muet ne
   permet de rien conclure. L'heure retenue est la plus proche des voisins, la
   force la plus forte. */
export function proximite(l, maintenant = Date.now()) {
  if (!l || !l.dispo || !l.voisins || !l.voisins.length) return null;
  if (evenement(l, maintenant)) return null;
  const marge = (l.pasMinutes || PAS_MF) * 60000;
  const ici = l.pas.filter(x => x.t >= maintenant - marge);
  if (!ici.length || ici[0].i !== 1) return null;
  const autour = l.voisins.map(v => evenement(v, maintenant)).filter(Boolean);
  if (!autour.length) return null;
  const t = Math.min(...autour.map(e => (e.genre === "debut" ? e.t : maintenant)));
  return { genre: "proche", force: Math.max(...autour.map(e => e.force)), t, fin: null };
}

/* La pluie plus tard, version 169 : rien dans l'heure, ni sur le point ni
   autour, mais le modèle en voit dans les deux heures qui suivent. Elle ne se
   dit que si toute l'heure est connue au sec : une échéance muette arrête la
   lecture, comme dans l'heure. */
export function plusTard(l, maintenant = Date.now()) {
  if (!l || !l.dispo || !l.suite || !l.suite.length) return null;
  const marge = (l.pasMinutes || PAS_MF) * 60000;
  const ici = l.pas.filter(x => x.t >= maintenant - marge);
  if (ici.length < 2 || ici.some(x => x.i !== 1)) return null;
  const fin = finDe(l.pas);
  const borne = maintenant + HORIZON;
  const s = l.suite.filter(x => x.t < borne);
  const k = s.findIndex(x => estPluie(x.i));
  if (k < 0) return null;
  let apres = s.findIndex((x, j) => j > k && !estPluie(x.i));
  const bout = apres < 0 ? s.length : apres;
  return { genre: "debut", force: Math.max(...s.slice(k, bout).map(x => x.i)),
    t: Math.max(s[k].t, fin), fin: apres < 0 ? null : s[apres].t, modele: true };
}

/* Ce que l'encart annonce : la pluie sur le point dans l'heure, sinon la pluie
   autour, sinon la pluie que le modèle voit plus tard. */
export const annonce = (l, maintenant = Date.now()) =>
  evenement(l, maintenant) || proximite(l, maintenant) || plusTard(l, maintenant);

/* Un délai, « 20 min » ou « 2 h 15 ». */
export const delaiCourt = m => (m < 60 ? `${m} min`
  : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);

/* Le titre de l'encart, son délai et sa ligne de suite, depuis la version 168.
   Le titre dit l'heure, que l'on compare à sa montre ; le délai se lit à
   droite, en plus petit. Les heures et les minutes s'arrondissent au pas de la
   source, comme la phrase. */
export function lignes(ev, maintenant = Date.now(), pas = PAS_MF) {
  if (!ev) return null;
  const nom = nomDe(ev.force);
  const quand = t => heureJour(new Date(t));
  if (ev.genre === "proche") {
    return { titre: `${nom} à quelques kilomètres`, delai: "",
      sous: "Rien de prévu ici dans l'heure, une averse passe tout près." };
  }
  if (ev.genre === "encore") {
    return { titre: `${nom}, sans accalmie dans l'heure`, delai: "", sous: "" };
  }
  if (ev.modele) pas = PAS_REPLI;
  const m = minutesJusqua(ev.t, maintenant, pas);
  if (ev.genre === "fin") {
    return m <= 0 ? { titre: `${nom}, qui s'arrête à l'instant`, delai: "", sous: "" }
      : { titre: `${nom} jusque vers ${quand(ev.t)}`, delai: `encore ${delaiCourt(m)}`, sous: "" };
  }
  const duree = ev.fin === null ? null
    : Math.max(pas, Math.round((ev.fin - ev.t) / 60000 / pas) * pas);
  /* Une pluie lue sur le modèle le dit : elle est moins sûre que le radar. */
  const methode = ev.confirme ? " Heure confirmée par le déplacement des averses."
    : ev.nonVue ? " Aucune averse observée en approche."
      : ev.plage ? " Heure incertaine selon le déplacement des averses." : "";
  const sous = (ev.modele
    ? (duree ? `Pendant ${duree} minutes environ, d'après le modèle.` : "D'après le modèle.")
    : (duree ? `Pendant ${duree} minutes environ.` : "")) + methode;
  if (ev.plage) {
    const [a, b] = ev.plage.map(x => minutesJusqua(x, maintenant, pas));
    const delai = b < 60 ? `dans ${a} à ${b} min` : `dans ${delaiCourt(a)} à ${delaiCourt(b)}`;
    return { titre: `${nom} entre ${quand(ev.plage[0])} et ${quand(ev.plage[1])}`, delai, sous: sous.trim() };
  }
  return m <= 0 ? { titre: `${nom} à l'instant`, delai: "", sous: sous.trim() }
    : { titre: `${nom} vers ${quand(ev.t)}`, delai: `dans ${delaiCourt(m)}`, sous: sous.trim() };
}

/* Jusqu'à quand le point est connu au sec, pour accorder le rappel de
   parapluie au radar. `null` quand le point n'est pas sec maintenant ou que la
   source ne sait rien : le rappel garde alors sa propre heure. Le sec court
   jusqu'à la première échéance mouillée ou muette, sinon jusqu'au bout de
   l'heure couverte. Seul le radar de Météo-France compte : le repli est un
   modèle, et il ne vaut pas mieux que la série horaire qu'il viendrait
   corriger. */
export function secJusqua(l, maintenant = Date.now()) {
  if (!l || !l.dispo || l.source !== "meteofrance") return null;
  const marge = (l.pasMinutes || PAS_MF) * 60000;
  const pas = l.pas.filter(x => x.t >= maintenant - marge);
  if (pas.length < 2 || pas[0].i !== 1) return null;
  for (const x of pas) if (x.i !== 1) return x.t;
  const n = pas.length;
  return pas[n - 1].t + (pas[n - 1].t - pas[n - 2].t);
}

/* La seconde méthode, version 170, demande de Jérôme du 4 octobre 2026. La
   dernière image radar, poussée du déplacement mesuré, donne une heure
   d'arrivée indépendante de celle de Météo-France. Elle ne s'affiche pas
   seule : elle confirme l'heure du produit quand les deux s'accordent à
   `ACCORD` près, la change en plage quand elles s'écartent, et signale une
   pluie que les averses observées ne montrent pas en approche. Elle ne porte
   que sur une pluie qui commence dans l'heure du radar. */
export const ACCORD = 10 * 60000;
/* Au delà d'une demi-heure d'écart, une plage serait trop large pour servir :
   la pluie annoncée n'est alors pas celle que les averses observées
   apportent, et elle se signale comme telle. */
export const ECART_MAX = 30 * 60000;
export function croiser(ev, approche, maintenant = Date.now()) {
  if (!ev || ev.genre !== "debut" || ev.modele || !approche) return ev;
  if (approche.t === null) {
    /* Le bord de la tuile atteint avant l'heure : on ne sait rien. */
    return approche.jusqua >= ev.t + ACCORD ? { ...ev, nonVue: true } : ev;
  }
  const t = Math.max(maintenant, Math.round(approche.t / 300000) * 300000);
  const ecart = Math.abs(t - ev.t);
  if (ecart <= ACCORD) return { ...ev, confirme: true };
  if (ecart > ECART_MAX) return { ...ev, nonVue: true };
  return { ...ev, plage: [Math.min(t, ev.t), Math.max(t, ev.t)] };
}
