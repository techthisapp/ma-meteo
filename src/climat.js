/* Le climat de la commune : replacer la journée dans quatre-vingts ans de
   relevés au même endroit.

   La source est la réanalyse ERA5, servie par le même hôte que le reste sans
   compte ni clé. Elle ne change pas : une année écoulée est écrite une fois pour
   toutes. La lecture longue se fait donc une fois par commune et se garde
   jusqu'au changement d'année ; l'année en cours se lit à part, pour deux
   kilooctets.

   | Mesure du 10 septembre 2026, à Fain-lès-Moutiers | Valeur |
   |---|---|
   | Archive de 1950 à 2025 | 27 759 journées, 166 418 octets compressés |
   | Année en cours, 252 journées | 2003 octets compressés |
   | Réduction gardée sur l'appareil | 12 563 octets |
   | Coût de la réduction en navigateur | 68 millisecondes |

   La réduction se fait sur le fil principal. La feuille de route demandait un
   fil séparé ; la mesure dit que la réduction coûte soixante-huit millisecondes
   une seule fois, derrière une lecture réseau de cent soixante-six kilooctets
   qui dure bien davantage. Un fil séparé cacherait le plus court des deux.

   **Le percentile compare deux sources.** Le maximum annoncé vient du modèle de
   prévision, la distribution vient de la réanalyse. Mesuré sur soixante
   journées écoulées à Fain-lès-Moutiers : le maximum du modèle dépasse celui de
   la réanalyse de 0,26 degré en moyenne, 0,45 en médiane, avec un écart-type de
   0,84. Sur la distribution du 10 septembre, où quatre-vingts points de
   percentile couvrent onze degrés, cet écart déplace le percentile de trois
   points. Il n'est donc pas corrigé, et l'ordre de grandeur est écrit ici.

   Les deux services rendent la même altitude au même point, relevé sur neuf
   lieux dont Chamonix et Briançon : l'archive est descendue sur le même relief
   que la prévision, et la comparaison ne mélange pas deux altitudes.

   **La pluie ne se compare pas au jour près.** Sur les mêmes soixante journées,
   l'écart de lame quotidienne entre les deux sources a un écart-type de 5,2
   millimètres pour une moyenne de 1,6 : une averse tombe rarement sur la même
   maille. Le cumul d'une saison entière, lui, se compare, et c'est la seule
   forme sous laquelle la pluie paraît ici. */

const SERVICE = "https://archive-api.open-meteo.com/v1/archive";
export const DEBUT = 1950;
export const COLONNES = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"];

/* La fenêtre de la distribution. Le jour exact ne donne que soixante-seize
   relevés, où un percentile vaut à un point et demi près et bouge au hasard :
   mesuré, un maximum de dix-huit degrés se place au vingt-cinquième centile sur
   le jour exact et au trente-deuxième sur onze jours. Onze jours donnent huit
   cent quarante et un relevés, ce qui est la pratique climatologique ordinaire.

   La dérive de saison sur cette largeur reste petite : la médiane du maximum
   passe de 20,5 degrés au 1er septembre à 17,9 au 25, soit un dixième de degré
   par jour, un peu plus d'un demi-degré sur la demi-fenêtre. */
export const FENETRE = 5;

/* La distribution est gardée par blocs de cinq jours et non jour par jour. Deux
   jours voisins partagent déjà neuf dixièmes de leur fenêtre, et cinq jours de
   dérive valent un demi-degré. Le stockage passe de 366 jeux à 74. */
export const BLOC = 5;

/* Onze bornes, de zéro à cent par pas de dix. C'est la finesse d'une phrase qui
   dit « plus chaud que quatre journées sur cinq » ; des bornes plus serrées
   donneraient une précision que soixante-seize années ne portent pas. */
export const PAS_QUANTILE = 10;

/* La normale de référence de l'Organisation météorologique mondiale. */
export const NORMALE = [1991, 2020];

/* La référence des bandes de réchauffement : les trente premières années de
   l'archive. Elle est prise dans la série elle-même et non ailleurs, pour que la
   bande d'une année dise son écart à un passé du même lieu et de la même
   source. */
export const REFERENCE = 30;

/* Une saison ne se dit qu'à partir de trente journées. Le 10 septembre,
   l'automne en a dix, et une moyenne de dix journées n'est pas un climat : c'est
   alors la saison qui vient de finir qui se compare. */
export const JOURS_SAISON = 30;

export const SAISONS = [
  { cle: "hiver", nom: "Hiver", mois: [12, 1, 2] },
  { cle: "printemps", nom: "Printemps", mois: [3, 4, 5] },
  { cle: "ete", nom: "Été", mois: [6, 7, 8] },
  { cle: "automne", nom: "Automne", mois: [9, 10, 11] },
];

const CACHE = "mameteo.climat.v1";

/* La réserve garde au plus six communes. Douze kilooctets et demi par commune
   mesurés, soit soixante-quinze kilooctets au plus : la réserve locale porte
   déjà la prévision, les scénarios et le journal de justesse, et l'archive ne
   doit pas leur prendre leur place. La commune la moins récemment lue part la
   première. */
export const COMMUNES_GARDEES = 6;

export const cle = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

/* Le rang d'une date dans l'année, de zéro à trois cent soixante-cinq. Il est
   calculé sur la chaîne rendue par le service et non par un objet de date : la
   réduction en construirait vingt-huit mille. */
const JOURS_MOIS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const bissextile = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
export function rangDate(iso) {
  const a = +iso.slice(0, 4), m = +iso.slice(5, 7), j = +iso.slice(8, 10);
  return JOURS_MOIS[m - 1] + j - 1 + (m > 2 && bissextile(a) ? 1 : 0);
}

/* Le rang d'une date dans une année non bissextile, celui qui sert à ranger les
   blocs : le 29 février se range avec le 28. */
export function rangCommun(mois, jour) {
  return JOURS_MOIS[mois - 1] + Math.min(jour, mois === 2 ? 28 : 31) - 1;
}

export const rangBloc = r => Math.min(Math.floor(r / BLOC), Math.ceil(365 / BLOC) - 1);

export function adresseLongue(lat, lon, finAnnee) {
  const q = new URLSearchParams();
  q.set("latitude", lat.toFixed(4));
  q.set("longitude", lon.toFixed(4));
  q.set("start_date", `${DEBUT}-01-01`);
  q.set("end_date", `${finAnnee}-12-31`);
  q.set("daily", COLONNES.join(","));
  q.set("timezone", "auto");
  return `${SERVICE}?${q}`;
}

/* La lecture récente part du 1er décembre de l'année d'avant et non du 1er
   janvier : l'hiver traverse le changement d'année, et au 5 janvier la saison
   en cours porte déjà cinq semaines dont un mois est de l'année passée. Le
   surcoût est d'un mois de journées. */
export function adresseAnnee(lat, lon, annee, fin) {
  const q = new URLSearchParams();
  q.set("latitude", lat.toFixed(4));
  q.set("longitude", lon.toFixed(4));
  q.set("start_date", `${annee - 1}-12-01`);
  q.set("end_date", fin);
  q.set("daily", COLONNES.join(","));
  q.set("timezone", "auto");
  return `${SERVICE}?${q}`;
}

const arrondi = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

/* La réduction. Ce qui est gardé est ce que les quatre usages demandent, non la
   série : vingt-huit mille journées font sept cent soixante-quatre kilooctets,
   et six communes ne tiendraient pas dans la réserve locale. */
export function reduire(daily) {
  const t = daily?.time, mx = daily?.temperature_2m_max,
    mn = daily?.temperature_2m_min, pl = daily?.precipitation_sum;
  if (!Array.isArray(t) || !Array.isArray(mx) || t.length < 366) return null;
  const n = t.length;
  const rangs = new Int16Array(n), ans = new Int16Array(n);
  for (let i = 0; i < n; i++) { rangs[i] = rangDate(t[i]); ans[i] = +t[i].slice(0, 4); }

  /* Les distributions du maximum, par bloc de cinq jours et sur onze jours de
     fenêtre. La fenêtre boucle : le 1er janvier voit la fin de décembre. */
  const nBlocs = Math.ceil(365 / BLOC);
  const blocs = [];
  for (let b = 0; b < nBlocs; b++) {
    const centre = b * BLOC + Math.floor(BLOC / 2);
    const ech = [];
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(mx[i])) continue;
      const e = Math.abs(rangs[i] - centre);
      if (Math.min(e, 366 - e) <= FENETRE) ech.push(mx[i]);
    }
    if (!ech.length) return null;
    ech.sort((x, y) => x - y);
    const q = [];
    for (let k = 0; k <= 100; k += PAS_QUANTILE) {
      q.push(arrondi(ech[Math.round((k / 100) * (ech.length - 1))]));
    }
    blocs.push(q);
  }

  /* Les records de chaque date, à la date exacte : un record du 10 septembre est
     un fait du 10 septembre, non d'une fenêtre autour de lui. */
  const rec = new Map();
  for (let i = 0; i < n; i++) {
    const c = t[i].slice(5);
    let r = rec.get(c);
    if (!r) rec.set(c, r = [null, 0, null, 0]);
    if (Number.isFinite(mx[i]) && (r[0] === null || mx[i] > r[0])) { r[0] = arrondi(mx[i]); r[1] = ans[i]; }
    if (Number.isFinite(mn[i]) && (r[2] === null || mn[i] < r[2])) { r[2] = arrondi(mn[i]); r[3] = ans[i]; }
  }
  const records = {};
  for (const [c, r] of rec) records[c] = r;

  /* La moyenne annuelle, sur les années complètes seulement : une année amputée
     de son été serait une bande fausse. */
  const parAn = new Map();
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(mx[i]) || !Number.isFinite(mn[i])) continue;
    let a = parAn.get(ans[i]);
    if (!a) parAn.set(ans[i], a = [0, 0]);
    a[0] += (mx[i] + mn[i]) / 2; a[1]++;
  }
  const listeAns = [...parAn.keys()].filter(y => parAn.get(y)[1] >= 360).sort((a, b) => a - b);
  const annees = listeAns.map(y => arrondi(parAn.get(y)[0] / parAn.get(y)[1], 2));

  /* Les normales de saison, température moyenne et cumul de pluie, sur la
     période de référence. L'hiver porte le nom de l'année de son mois de
     janvier, comme il se compte partout. */
  const normales = {};
  for (const s of SAISONS) {
    const T = []; const P = new Map();
    for (let i = 0; i < n; i++) {
      const m = +t[i].slice(5, 7);
      if (!s.mois.includes(m)) continue;
      const y = m === 12 ? ans[i] + 1 : ans[i];
      if (y < NORMALE[0] || y > NORMALE[1]) continue;
      if (Number.isFinite(mx[i]) && Number.isFinite(mn[i])) T.push((mx[i] + mn[i]) / 2);
      P.set(y, (P.get(y) || 0) + (Number.isFinite(pl[i]) ? pl[i] : 0));
    }
    if (!T.length) continue;
    const cumuls = [...P.values()];
    normales[s.cle] = [
      arrondi(T.reduce((a, b) => a + b, 0) / T.length, 2),
      arrondi(cumuls.reduce((a, b) => a + b, 0) / cumuls.length, 0),
    ];
  }

  return { v: 1, an0: listeAns[0] ?? DEBUT, anN: listeAns[listeAns.length - 1] ?? DEBUT,
    annees, blocs, records, normales };
}

/* Le percentile d'une valeur dans la distribution d'un bloc, par interpolation
   entre deux bornes. Sous la plus basse ou au-dessus de la plus haute, la valeur
   sort de quatre-vingts ans de relevés et le percentile bute à zéro ou à cent :
   c'est exact, et le mot qui l'accompagne le dit. */
export function percentile(q, v) {
  if (!Array.isArray(q) || !q.length || !Number.isFinite(v)) return null;
  if (v <= q[0]) return 0;
  if (v >= q[q.length - 1]) return 100;
  for (let k = 0; k < q.length - 1; k++) {
    if (v >= q[k] && v <= q[k + 1]) {
      const l = q[k + 1] - q[k];
      const f = l > 0 ? (v - q[k]) / l : 0;
      return (k + f) * PAS_QUANTILE;
    }
  }
  return null;
}

/* Ce que le percentile vaut en mots. Les bornes sont celles d'une phrase qu'on
   peut dire : « une journée sur dix » se comprend, « le neuvième décile » non. */
export function motPercentile(p) {
  if (p === null || !Number.isFinite(p)) return "";
  if (p >= 100) return "plus chaud que toutes les journées relevées à cette date";
  if (p >= 90) return "plus chaud que neuf journées sur dix";
  if (p >= 75) return "plus chaud que trois journées sur quatre";
  if (p >= 60) return "un peu plus chaud que d'ordinaire";
  if (p > 40) return "dans l'ordinaire de la date";
  if (p > 25) return "un peu plus frais que d'ordinaire";
  if (p > 10) return "plus frais que trois journées sur quatre";
  if (p > 0) return "plus frais que neuf journées sur dix";
  return "plus frais que toutes les journées relevées à cette date";
}

/* Les bandes de réchauffement : l'écart de chaque année à la moyenne des trente
   premières de la série. */
export function bandes(annees, reference = REFERENCE) {
  if (!Array.isArray(annees) || annees.length < reference) return null;
  const base = annees.slice(0, reference).reduce((a, b) => a + b, 0) / reference;
  const ecarts = annees.map(v => arrondi(v - base, 2));
  let mn = Infinity, mx = -Infinity;
  for (const e of ecarts) { if (e < mn) mn = e; if (e > mx) mx = e; }
  return { base: arrondi(base, 2), ecarts, mn, mx };
}

/* La montée mesurée : la moyenne des trente premières années contre celle des
   trente dernières. Deux moyennes de trente ans se comparent ; deux années
   prises aux deux bouts ne diraient que le hasard de ces deux années-là. */
export function montee(annees, reference = REFERENCE) {
  if (!Array.isArray(annees) || annees.length < reference * 2) return null;
  const moy = l => l.reduce((a, b) => a + b, 0) / l.length;
  const a = moy(annees.slice(0, reference)), b = moy(annees.slice(-reference));
  return { debut: arrondi(a, 2), fin: arrondi(b, 2), ecart: arrondi(b - a, 2) };
}

/* La saison à comparer. La saison en cours dès qu'elle porte trente journées,
   celle qui vient de finir sinon. */
export function saisonDite(mois, jourDuMois) {
  const k = SAISONS.findIndex(s => s.mois.includes(mois));
  const rang = SAISONS[k].mois.indexOf(mois);
  const jours = rang * 30 + jourDuMois;
  if (jours >= JOURS_SAISON) return { saison: SAISONS[k], enCours: true };
  return { saison: SAISONS[(k + 3) % 4], enCours: false };
}

/* Le relevé d'une saison dans la série de l'année en cours, laquelle porte aussi
   la fin de l'année d'avant quand la saison la traverse. */
export function releveSaison(daily, saison, annee) {
  const t = daily?.time, mx = daily?.temperature_2m_max,
    mn = daily?.temperature_2m_min, pl = daily?.precipitation_sum;
  if (!Array.isArray(t)) return null;
  const T = []; let P = 0, jours = 0;
  for (let i = 0; i < t.length; i++) {
    const y = +t[i].slice(0, 4), m = +t[i].slice(5, 7);
    if (!saison.mois.includes(m)) continue;
    if ((m === 12 ? y + 1 : y) !== annee) continue;
    if (Number.isFinite(mx[i]) && Number.isFinite(mn[i])) { T.push((mx[i] + mn[i]) / 2); jours++; }
    if (Number.isFinite(pl[i])) P += pl[i];
  }
  if (!T.length) return null;
  return { temp: arrondi(T.reduce((a, b) => a + b, 0) / T.length, 2), pluie: arrondi(P, 0), jours };
}

/* ---------- La réserve locale ---------- */

const lireReserve = () => {
  try { return JSON.parse(localStorage.getItem(CACHE) || "null") || {}; }
  catch { return {}; }
};

export function garde(c) {
  const r = lireReserve();
  const e = r[c];
  return e && e.v === 1 ? e : null;
}

export function poser(c, d, annee) {
  const r = lireReserve();
  r[c] = { ...d, annee, lu: Date.now() };
  /* La commune la moins récemment lue part quand la réserve déborde. */
  const cles = Object.keys(r).sort((a, b) => (r[b].lu || 0) - (r[a].lu || 0));
  for (const k of cles.slice(COMMUNES_GARDEES)) delete r[k];
  try { localStorage.setItem(CACHE, JSON.stringify(r)); }
  catch { /* réserve pleine : la lecture repartira du réseau */ }
  return r[c];
}

export function oublier() {
  try { localStorage.removeItem(CACHE); } catch { /* rien à faire */ }
}

/* La lecture complète. Deux appels : l'archive longue, gardée jusqu'au
   changement d'année, et l'année en cours, qui ne pèse que deux kilooctets. */
export async function charger(lat, lon, aujourdhui, fetcheur = fetch) {
  const annee = +aujourdhui.slice(0, 4);
  const c = cle(lat, lon);
  let base = garde(c);
  if (!base || base.annee !== annee - 1) {
    const r = await fetcheur(adresseLongue(lat, lon, annee - 1));
    if (!r.ok) return null;
    const d = reduire((await r.json()).daily);
    if (!d) return null;
    base = poser(c, d, annee - 1);
  }
  const r2 = await fetcheur(adresseAnnee(lat, lon, annee, aujourdhui));
  const enCours = r2.ok ? (await r2.json()).daily : null;
  return { base, enCours, annee };
}

/* Ce que la feuille écrit, calculé à part de son écriture. `max` est le maximum
   annoncé pour aujourd'hui, qui vient de la prévision. */
export function bilan(d, aujourdhui, max) {
  if (!d || !d.base) return null;
  const mois = +aujourdhui.slice(5, 7), jour = +aujourdhui.slice(8, 10);
  const q = d.base.blocs[rangBloc(rangDate(aujourdhui))] || null;
  const p = Number.isFinite(max) ? percentile(q, max) : null;
  const rec = d.base.records[aujourdhui.slice(5)] || null;
  const b = bandes(d.base.annees);
  const m = montee(d.base.annees);
  const sd = saisonDite(mois, jour);
  const rel = d.enCours ? releveSaison(d.enCours, sd.saison, d.annee) : null;
  const norm = d.base.normales[sd.saison.cle] || null;
  return {
    quantiles: q, percentile: p, mot: motPercentile(p),
    mediane: q ? q[Math.floor(q.length / 2)] : null,
    records: rec, bandes: b, montee: m,
    saison: sd.saison, saisonEnCours: sd.enCours, releve: rel, normale: norm,
    an0: d.base.an0, anN: d.base.anN,
  };
}

/* Les températures s'écrivent au degré rond partout dans l'application, et un
   record ne fait pas exception : deux écrans qui arrondissent différemment
   finissent par se contredire. */
export const degre = v => (Number.isFinite(v) ? `${Math.round(v)}°` : "");
