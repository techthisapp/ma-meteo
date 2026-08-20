/* Positions du Soleil et de la Lune, calculées sur l'appareil.

   Aucune source distante ne sert d'éphéméride : Open-Meteo ne porte pas de
   donnée lunaire, et une application qui doit fonctionner hors ligne n'a pas à
   dépendre d'un service pour dire où est la Lune. Tout est calculé ici.

   Les séries sont celles de Meeus, tronquées. Ordres de grandeur des écarts,
   mesurés contre les levers et couchers du Soleil servis par Open-Meteo :
   moins d'une minute sur le Soleil, quelques minutes sur la Lune, un demi-point
   sur la part éclairée. C'est la précision d'un almanach de poche, non celle
   d'une éphéméride professionnelle.

   Repères de temps : tout est mené en temps universel à l'intérieur, les bornes
   de journée sont prises en heure locale par l'appelant. */

const RAD = Math.PI / 180;
const sin = a => Math.sin(a * RAD);
const cos = a => Math.cos(a * RAD);

// Degrés ramenés dans [0, 360[.
const tour = a => ((a % 360) + 360) % 360;
// Degrés ramenés dans [-180, 180[.
const ecart = a => { const v = tour(a); return v >= 180 ? v - 360 : v; };

export const jourJulien = d => d.getTime() / 86400000 + 2440587.5;
export const dateDe = jj => new Date(Math.round((jj - 2440587.5) * 86400000));

/* Écart entre le temps terrestre et le temps universel, en secondes.
   Les positions se calculent en temps terrestre, l'angle horaire se prend en
   temps universel : confondre les deux décale la phase d'une minute environ.
   Polynôme d'Espenak et Meeus, valable de 2005 à 2050. */
export function deltaT(jj) {
  const y = 2000 + (jj - 2451545) / 365.25;
  const t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}
const enTT = jj => jj + deltaT(jj) / 86400;

const obliquite = jj => 23.4392911 - 0.0000004 * (jj - 2451545);

/* ---------- Soleil ---------- */

export function soleil(jj) {
  const d = jj - 2451545;
  const L = tour(280.4664567 + 0.98564736 * d);
  const g = tour(357.5291092 + 0.98560028 * d);
  const lambda = tour(L + 1.914602 * sin(g) + 0.019993 * sin(2 * g) + 0.000289 * sin(3 * g));
  const eps = obliquite(jj);
  return {
    lambda,
    ascension: tour(Math.atan2(cos(eps) * sin(lambda), cos(lambda)) / RAD),
    declinaison: Math.asin(sin(eps) * sin(lambda)) / RAD,
    // Distance en kilomètres, unité astronomique de 149 597 870 km.
    distance: 149597870 * (1.000140 - 0.016708 * cos(g) - 0.000139 * cos(2 * g)),
  };
}

/* ---------- Lune ----------

   Termes principaux de la série ELP tronquée : évection, variation, équation
   annuelle et les harmoniques suivantes. Écart de l'ordre du centième de degré
   en longitude, ce qui vaut quelques minutes sur un lever. */

export function lune(jj) {
  const d = jj - 2451545;
  const Lp = tour(218.3164477 + 13.17639648 * d);   // longitude moyenne
  const D = tour(297.8501921 + 12.19074912 * d);    // élongation moyenne
  const M = tour(357.5291092 + 0.98560028 * d);     // anomalie moyenne du Soleil
  const Mp = tour(134.9633964 + 13.06499295 * d);   // anomalie moyenne de la Lune
  const F = tour(93.2720950 + 13.22935024 * d);     // argument de latitude

  const lambda = tour(Lp
    + 6.288774 * sin(Mp)
    + 1.274027 * sin(2 * D - Mp)
    + 0.658314 * sin(2 * D)
    + 0.213618 * sin(2 * Mp)
    - 0.185116 * sin(M)
    - 0.114332 * sin(2 * F)
    + 0.058793 * sin(2 * D - 2 * Mp)
    + 0.057066 * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp)
    + 0.045758 * sin(2 * D - M)
    - 0.040923 * sin(M - Mp)
    - 0.034720 * sin(D)
    - 0.030383 * sin(M + Mp)
    + 0.015327 * sin(2 * D - 2 * F)
    - 0.012528 * sin(Mp + 2 * F)
    + 0.010980 * sin(Mp - 2 * F)
    + 0.010675 * sin(4 * D - Mp)
    + 0.010034 * sin(3 * Mp)
    + 0.008548 * sin(4 * D - 2 * Mp));

  const beta = 5.128122 * sin(F)
    + 0.280602 * sin(Mp + F)
    + 0.277693 * sin(Mp - F)
    + 0.173237 * sin(2 * D - F)
    + 0.055413 * sin(2 * D - Mp + F)
    + 0.046271 * sin(2 * D - Mp - F)
    + 0.032573 * sin(2 * D + F)
    + 0.017198 * sin(2 * Mp + F)
    + 0.009266 * sin(2 * D + Mp - F)
    + 0.008822 * sin(2 * Mp - F)
    + 0.008216 * sin(2 * D - M - F)
    + 0.004324 * sin(2 * D - 2 * Mp - F)
    + 0.004200 * sin(2 * D + Mp + F);

  const distance = 385000.56
    - 20905.355 * cos(Mp)
    - 3699.111 * cos(2 * D - Mp)
    - 2955.968 * cos(2 * D)
    - 569.925 * cos(2 * Mp)
    + 246.158 * cos(2 * D - 2 * Mp)
    - 204.586 * cos(2 * D - M)
    - 170.733 * cos(2 * D + Mp)
    - 152.138 * cos(2 * D - M - Mp)
    - 129.620 * cos(D)
    + 108.743 * cos(M + Mp);

  const eps = obliquite(jj);
  const ascension = tour(Math.atan2(
    sin(lambda) * cos(eps) - Math.tan(beta * RAD) * sin(eps), cos(lambda)) / RAD);
  const declinaison = Math.asin(
    sin(beta) * cos(eps) + cos(beta) * sin(eps) * sin(lambda)) / RAD;

  return { lambda, beta, distance, ascension, declinaison };
}

/* ---------- Repérage sur l'horizon ---------- */

// Temps sidéral local, en degrés.
const siderale = (jj, lon) => tour(280.46061837 + 360.98564736629 * (jj - 2451545) + lon);

export function horizon(corps, jj, lat, lon) {
  const H = siderale(jj, lon) - corps.ascension;
  const hauteur = Math.asin(
    sin(lat) * sin(corps.declinaison) + cos(lat) * cos(corps.declinaison) * cos(H)) / RAD;
  const azimut = tour(Math.atan2(
    sin(H), cos(H) * sin(lat) - Math.tan(corps.declinaison * RAD) * cos(lat)) / RAD + 180);
  return { hauteur, azimut };
}

/* Hauteur de référence d'un lever et d'un coucher.

   Le Soleil se lève quand son bord supérieur touche l'horizon, réfraction
   comprise, d'où -0,833 degré. Pour la Lune, la parallaxe l'emporte sur le
   demi-diamètre et la place légèrement au-dessus, d'où +0,125 degré. */
export const SEUIL = { soleil: -0.833, lune: 0.125 };

/* Position d'un corps pour un instant donné en temps universel. */
const positionDe = (corps, jj) =>
  (corps === "lune" ? lune(enTT(jj)) : soleil(enTT(jj)));

/* Bornes d'une journée locale, en jours juliens. La journée fait 23, 24 ou 25
   heures selon le changement d'heure : elle se prend par les dates, non par une
   durée supposée. */
function borneJour(date) {
  const debut = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const fin = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return [jourJulien(debut), jourJulien(fin)];
}

/* Lever, coucher, passage au méridien et hauteur maximale d'un corps, pour la
   journée locale qui contient `date`.

   La recherche échantillonne la hauteur toutes les dix minutes puis affine par
   dichotomie. Un jour sans lever ou sans coucher n'est pas une anomalie : la
   Lune en connaît environ un par lunaison. Les champs valent alors `null`. */
export function evenements(corps, date, lat, lon) {
  const seuil = SEUIL[corps];
  const [jj0, jj1] = borneJour(date);
  const pas = 10 / 1440;

  const h = jj => horizon(positionDe(corps, jj), jj, lat, lon).hauteur - seuil;

  const affiner = (a, b) => {
    let ha = h(a);
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      const hm = h(m);
      if ((ha < 0) === (hm < 0)) { a = m; ha = hm; } else { b = m; }
      if (b - a < 1 / 86400) break;
    }
    return (a + b) / 2;
  };

  let lever = null, coucher = null;
  let sommetJj = jj0, sommetH = h(jj0) + seuil;
  let precJj = jj0, precH = h(jj0);

  for (let jj = jj0 + pas; jj <= jj1 + 1e-9; jj += pas) {
    const hh = h(jj);
    if (precH < 0 && hh >= 0 && lever === null) lever = affiner(precJj, jj);
    if (precH >= 0 && hh < 0 && coucher === null) coucher = affiner(precJj, jj);
    if (hh + seuil > sommetH) { sommetH = hh + seuil; sommetJj = jj; }
    precJj = jj; precH = hh;
  }

  // Le sommet ne vaut que si le corps s'est levé dans la journée.
  const auDessus = sommetH > seuil;

  return {
    lever: lever === null ? null : dateDe(lever),
    coucher: coucher === null ? null : dateDe(coucher),
    meridien: auDessus ? dateDe(sommetJj) : null,
    hauteurMax: auDessus ? sommetH : null,
    azimutLever: lever === null ? null
      : horizon(positionDe(corps, lever), lever, lat, lon).azimut,
    azimutCoucher: coucher === null ? null
      : horizon(positionDe(corps, coucher), coucher, lat, lon).azimut,
    // Durée de présence au-dessus de l'horizon, en secondes, quand elle se borne.
    duree: lever !== null && coucher !== null && coucher > lever
      ? Math.round((coucher - lever) * 86400) : null,
  };
}

/* Heures des crépuscules : civil à six degrés sous l'horizon, nautique à douze,
   astronomique à dix-huit. Rend `null` quand le Soleil ne descend pas si bas. */
export function crepuscules(date, lat, lon) {
  const [jj0, jj1] = borneJour(date);
  const pas = 10 / 1440;
  const out = {};

  for (const [nom, seuil] of [["civil", -6], ["nautique", -12], ["astronomique", -18]]) {
    const h = jj => horizon(soleil(enTT(jj)), jj, lat, lon).hauteur - seuil;
    let soir = null, matin = null;
    let precJj = jj0, precH = h(jj0);
    for (let jj = jj0 + pas; jj <= jj1 + 1e-9; jj += pas) {
      const hh = h(jj);
      if (precH >= 0 && hh < 0 && soir === null) soir = (precJj + jj) / 2;
      if (precH < 0 && hh >= 0 && matin === null) matin = (precJj + jj) / 2;
      precJj = jj; precH = hh;
    }
    out[nom] = {
      matin: matin === null ? null : dateDe(matin),
      soir: soir === null ? null : dateDe(soir),
    };
  }
  return out;
}

/* ---------- Phase de la Lune ---------- */

/* Les quatre phases exactes ne se nomment que dans une fenêtre étroite, d'un
   demi-jour de part et d'autre : appeler « premier quartier » une lune éclairée
   au tiers ne rendrait service à personne. Le reste du cycle porte les noms de
   croissant et de gibbeuse. */
const FENETRE = 6.5;
const NOMS = [
  [FENETRE, "Nouvelle lune"],
  [90 - FENETRE, "Premier croissant"],
  [90 + FENETRE, "Premier quartier"],
  [180 - FENETRE, "Gibbeuse croissante"],
  [180 + FENETRE, "Pleine lune"],
  [270 - FENETRE, "Gibbeuse décroissante"],
  [270 + FENETRE, "Dernier quartier"],
  [360 - FENETRE, "Dernier croissant"],
];

// Écart de longitude entre la Lune et le Soleil, en degrés, dans [0, 360[.
const elongationMoyenne = jj =>
  tour(lune(enTT(jj)).lambda - soleil(enTT(jj)).lambda);

export function phase(date) {
  const jj = jourJulien(date);
  const s = soleil(enTT(jj));
  const l = lune(enTT(jj));
  const D = tour(l.lambda - s.lambda);

  /* Élongation vraie, latitude comprise, puis angle de phase par le triangle
     Terre, Lune, Soleil. La part éclairée n'est pas une simple fonction de D. */
  const psi = Math.acos(cos(l.beta) * cos(l.lambda - s.lambda)) / RAD;
  const i = Math.atan2(s.distance * sin(psi), l.distance - s.distance * cos(psi)) / RAD;
  const eclairee = (1 + cos(i)) / 2;

  const nom = D >= 360 - FENETRE ? "Nouvelle lune"
    : (NOMS.find(([b]) => D < b) || NOMS[NOMS.length - 1])[1];
  const nouvelle = phaseCible(jj, 0, -1);

  return {
    elongation: D,
    eclairee,
    croissante: D < 180,
    nom,
    // Âge en jours depuis la nouvelle lune précédente.
    age: jj - nouvelle,
    distance: l.distance,
    // Diamètre apparent en minutes d'arc, rayon lunaire de 1737,4 km.
    diametre: 2 * Math.atan(1737.4 / l.distance) / RAD * 60,
  };
}

/* Instant où l'élongation atteint une valeur donnée : 0 pour la nouvelle lune,
   90 pour le premier quartier, 180 pour la pleine lune, 270 pour le dernier.

   Recherche par pas d'un demi-jour puis dichotomie, sur le passage du négatif au
   positif de l'écart à la cible. L'élongation avance d'environ 12,19 degrés par
   jour, un demi-jour ne peut donc pas enjamber un passage. */
function phaseCible(jjDepart, cible, sens = 1) {
  const f = jj => ecart(elongationMoyenne(jj) - cible);
  const pas = 0.5 * sens;
  let a = jjDepart, fa = f(a);
  for (let k = 0; k < 80; k++) {
    const b = a + pas, fb = f(b);
    const passe = sens > 0 ? (fa < 0 && fb >= 0) : (fa >= 0 && fb < 0);
    if (passe) {
      let g = sens > 0 ? a : b, d = sens > 0 ? b : a;
      for (let j = 0; j < 40; j++) {
        const m = (g + d) / 2;
        if (f(m) < 0) g = m; else d = m;
        if (Math.abs(d - g) < 1 / 86400) break;
      }
      return (g + d) / 2;
    }
    a = b; fa = fb;
  }
  return jjDepart;
}

/* Les quatre prochains passages de phase, dans l'ordre chronologique. */
export function prochainesPhases(date) {
  const jj = jourJulien(date);
  return [
    ["Nouvelle lune", 0],
    ["Premier quartier", 90],
    ["Pleine lune", 180],
    ["Dernier quartier", 270],
  ]
    .map(([nom, cible]) => ({ nom, date: dateDe(phaseCible(jj, cible)) }))
    .sort((a, b) => a.date - b.date);
}

/* Durée de la lunaison en cours, en jours : d'une nouvelle lune à la suivante.
   Elle varie d'environ six heures autour de 29,53 jours. */
export function lunaison(date) {
  const jj = jourJulien(date);
  const debut = phaseCible(jj, 0, -1);
  const fin = phaseCible(jj, 0, 1);
  return { debut: dateDe(debut), fin: dateDe(fin), duree: fin - debut };
}

/* ---------- Dessin de la phase ----------

   Le terminateur est une demi-ellipse dont le demi-axe vaut le rayon multiplié
   par le cosinus de l'angle de phase. Deux arcs suffisent : le bord éclairé du
   disque, puis le terminateur. */
export function dessinPhase(eclairee, croissante, r = 46) {
  const c = 2 * eclairee - 1;
  const rx = Math.abs(c) * r;
  const arcExt = croissante ? 1 : 0;
  const arcInt = (c >= 0) === croissante ? 1 : 0;
  const D = 2 * r + 8;
  return `<svg class="ln-disque" viewBox="${-D / 2} ${-D / 2} ${D} ${D}" `
    + `role="img" aria-label="Phase de la Lune">`
    + `<circle class="ln-sombre" cx="0" cy="0" r="${r}"/>`
    + `<path class="ln-claire" d="M0,${-r} A${r},${r} 0 0,${arcExt} 0,${r} `
    + `A${rx.toFixed(2)},${r} 0 0,${arcInt} 0,${-r} Z"/>`
    + `</svg>`;
}
