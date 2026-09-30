/* La comparaison dans le temps, jalon 14, lot 1.

   Demandée par Jérôme le 28 septembre 2026 : comparer une période à la même
   période d'une autre année, au même lieu. Elle se range dans la feuille du
   climat et s'ouvre sur la semaine en cours, du lundi au dimanche, face aux
   mêmes dates de l'an dernier.

   La semaine en cours vient de la prévision, jours passés compris : c'est la
   source de La semaine et de l'accueil. L'autre année vient de l'archive,
   réanalyse ERA5, lue pour ces sept jours seulement, quelques centaines
   d'octets. Le jalon 8 a mesuré l'écart entre les deux sources : 0,26 degré en
   moyenne sur le maximum, ce qui laisse la température se comparer à la
   semaine ; la pluie, bien plus dispersée au jour près, ne se compare qu'en
   cumul, et la phrase ne la juge qu'au-delà de dix millimètres d'écart. */

import { SERVICE_ARCHIVE, COLONNES } from "./climat.js";

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* Les sept dates de la semaine qui contient le jour donné, du lundi au
   dimanche. */
export function semaineDe(jour) {
  const d = new Date(`${jour}T12:00`);
  const decal = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decal);
  return Array.from({ length: 7 }, (_, k) => {
    const x = new Date(d);
    x.setDate(d.getDate() + k);
    return iso(x);
  });
}

/* Les mêmes dates dans une autre année. Un 29 février sans équivalent devient
   le 28. */
export function memesDates(dates, annee) {
  return dates.map(t => {
    const [, m, j] = t.split("-").map(Number);
    const bissextile = (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
    const jj = m === 2 && j === 29 && !bissextile ? 28 : j;
    return `${annee}-${String(m).padStart(2, "0")}-${String(jj).padStart(2, "0")}`;
  });
}

export function adressePeriode(lat, lon, debut, fin) {
  const q = new URLSearchParams();
  q.set("latitude", lat.toFixed(4));
  q.set("longitude", lon.toFixed(4));
  q.set("start_date", debut);
  q.set("end_date", fin);
  q.set("daily", COLONNES.join(","));
  q.set("timezone", "auto");
  return `${SERVICE_ARCHIVE}?${q}`;
}

/* Les journées d'une réponse de l'archive, dans la forme de la comparaison. */
export function journeesDe(daily) {
  if (!daily?.time) return [];
  return daily.time.map((t, i) => ({
    date: t, tx: daily.temperature_2m_max[i], tn: daily.temperature_2m_min[i], mm: daily.precipitation_sum[i],
  }));
}

/* Les périodes de la comparaison, reprises le 29 septembre 2026 à la demande
   de Jérôme : le passé et l'avenir ne se mélangent jamais dans une période.
   Le passé, 7, 15 et 30 derniers jours et deux derniers mois, finit hier et se
   lit dans l'archive, réanalyse ERA5 qui répond jusqu'à la veille ; l'avenir,
   3, 7 et 15 prochains jours, commence demain et se lit dans la prévision.
   Aujourd'hui, à moitié passé et à moitié prévu, n'appartient à aucune. La
   semaine en cours, qui mêlait les deux, a disparu. */
export const PERIODES = [
  ["7p", "7 derniers jours", "passe"],
  ["15p", "15 derniers jours", "passe"],
  ["30p", "30 derniers jours", "passe"],
  ["60p", "2 derniers mois", "passe"],
  ["3f", "3 prochains jours", "avenir"],
  ["7f", "7 prochains jours", "avenir"],
  ["15f", "15 prochains jours", "avenir"],
];
export const PERIODE_DEFAUT = "7p";
const DUREES = { "7p": 7, "15p": 15, "30p": 30, "60p": 60, "3f": 3, "7f": 7, "15f": 15 };
export const estPassee = periode => (PERIODES.find(([v]) => v === periode) || [])[2] === "passe";

export function datesDe(periode, jour) {
  const n = DUREES[periode] || DUREES[PERIODE_DEFAUT];
  const passe = DUREES[periode] ? estPassee(periode) : true;
  const d = new Date(`${jour}T12:00`);
  return Array.from({ length: n }, (_, k) => {
    const x = new Date(d);
    x.setDate(d.getDate() + (passe ? -(n - k) : k + 1));
    return iso(x);
  });
}

/* Les mots de chaque période : le titre, la même période d'une autre année
   après « que » et après « à », et la période dans une phrase. */
export function motsDe(periode) {
  const m = {
    "7p": ["Ces 7 derniers jours", "7 jours", "ces 7 derniers jours"],
    "15p": ["Ces 15 derniers jours", "15 jours", "ces 15 derniers jours"],
    "30p": ["Ces 30 derniers jours", "30 jours", "ces 30 derniers jours"],
    "60p": ["Ces deux derniers mois", "deux mois", "ces deux derniers mois"],
    "3f": ["Ces 3 prochains jours", "3 jours", "ces 3 prochains jours"],
    "7f": ["Ces 7 prochains jours", "7 jours", "ces 7 prochains jours"],
    "15f": ["Ces 15 prochains jours", "15 jours", "ces 15 prochains jours"],
  }[periode] || ["Ces 7 derniers jours", "7 jours", "ces 7 derniers jours"];
  return { titre: m[0], que: `les mêmes ${m[1]}`, aux: `aux mêmes ${m[1]}`, ici: m[2] };
}

/* Le seuil de la pluie croît avec la racine de la durée : 7 millimètres sur
   trois jours, 10 sur sept, 15 sur quinze, 21 sur trente, 29 sur soixante. Les
   cumuls grandissent avec la période, et leur incertitude avec eux. */
export const seuilPluie = n => Math.round(10 * Math.sqrt(n / 7));

const lu = new Map();

/* L'autre année, lue une fois par lieu et par année pendant la séance. */
export async function lireAnnee(lat, lon, dates, annee, fetcheur = fetch) {
  const cle = `${lat.toFixed(3)},${lon.toFixed(3)}|${dates[0]}|${dates.length}|${annee}`;
  if (lu.has(cle)) return lu.get(cle);
  const d = memesDates(dates, annee);
  const r = await fetcheur(adressePeriode(lat, lon, d[0], d[d.length - 1]));
  if (!r.ok) throw new Error(`archive ${r.status}`);
  const j = journeesDe((await r.json()).daily);
  lu.set(cle, j);
  return j;
}

const moyenne = v => v.reduce((a, x) => a + x, 0) / v.length;
const fr = (v, n = 1) => String(Math.round(v * 10 ** n) / 10 ** n).replace(".", ",");

/* Le bilan des deux semaines : l'écart moyen des maximums et des minimums, les
   deux cumuls de pluie, et la phrase, coupée en titre et précision par sa
   première virgule comme les conseils de l'accueil. Une journée sans valeur
   dans l'une ou l'autre semaine sort de la moyenne. */
export function bilan(cette, autre, annee, periode = PERIODE_DEFAUT) {
  const paires = cette.map((j, k) => [j, autre[k]])
    .filter(([a, b]) => b && Number.isFinite(a.tx) && Number.isFinite(b.tx));
  if (paires.length < 4) return null;
  const dtx = moyenne(paires.map(([a, b]) => a.tx - b.tx));
  const dtn = moyenne(paires.filter(([a, b]) => Number.isFinite(a.tn) && Number.isFinite(b.tn))
    .map(([a, b]) => a.tn - b.tn));
  const p1 = cette.reduce((s, j) => s + (j.mm || 0), 0);
  const p2 = autre.reduce((s, j) => s + (j.mm || 0), 0);
  const m = motsDe(periode);
  /* Des jours ou des mois : l'accord est au masculin pluriel. */
  const sens = dtx >= 1 ? "Plus chauds" : dtx <= -1 ? "Plus frais" : "Semblables";
  const titre = sens === "Semblables"
    ? `${sens} ${m.aux} de ${annee}, à ${fr(Math.abs(dtx))}° près au plus chaud`
    : `${sens} que ${m.que} de ${annee}, de ${fr(Math.abs(dtx))}° en moyenne au plus chaud`;
  const pluie = Math.abs(p1 - p2) >= seuilPluie(cette.length)
    ? (p1 > p2 ? `plus pluvieux, ${fr(p1, 0)} mm contre ${fr(p2, 0)}` : `plus secs, ${fr(p1, 0)} mm contre ${fr(p2, 0)}`)
    : `pluie comparable, ${fr(p1, 0)} mm contre ${fr(p2, 0)}`;
  return {
    dtx: Math.round(dtx * 10) / 10, dtn: Number.isFinite(dtn) ? Math.round(dtn * 10) / 10 : null,
    pluie: [Math.round(p1 * 10) / 10, Math.round(p2 * 10) / 10],
    phrase: `${titre} ; ${pluie}.`,
  };
}

/* La comparaison entre lieux, jalon 14, lot 2 : la même semaine, deux à
   quatre lieux suivis, dans une seule requête à la prévision, un tableau par
   lieu pour qu'ils se comparent à source égale. La commune affichée y figure
   aussi, relue avec les autres plutôt que tirée de sa propre charge, qui mêle
   AROME aux premiers jours. */
const PREVISION = "https://api.open-meteo.com/v1/forecast";

export function adresseLieux(lieux, dates, service = PREVISION) {
  const q = new URLSearchParams();
  q.set("latitude", lieux.map(l => l.lat.toFixed(4)).join(","));
  q.set("longitude", lieux.map(l => l.lon.toFixed(4)).join(","));
  q.set("start_date", dates[0]);
  q.set("end_date", dates[dates.length - 1]);
  q.set("daily", COLONNES.join(","));
  q.set("timezone", "Europe/Paris");
  return `${service}?${q}`;
}

const luLieux = new Map();

/* Les lieux se lisent dans l'archive pour le passé, dans la prévision pour
   l'avenir : une même requête pour tous, une seule source par période. */
export async function lireLieux(lieux, dates, passe = false, fetcheur = fetch) {
  const cle = `${lieux.map(l => `${l.lat.toFixed(3)},${l.lon.toFixed(3)}`).join(";")}|${dates[0]}|${dates.length}|${passe}`;
  if (luLieux.has(cle)) return luLieux.get(cle);
  const r = await fetcheur(adresseLieux(lieux, dates, passe ? SERVICE_ARCHIVE : PREVISION));
  if (!r.ok) throw new Error(`prévision ${r.status}`);
  const d = await r.json();
  const tab = Array.isArray(d) ? d : [d];
  const res = lieux.map((l, k) => ({ nom: l.nom, jours: journeesDe(tab[k]?.daily) }));
  luLieux.set(cle, res);
  return res;
}

/* Le bilan des lieux : moyennes des maximums et des minimums, cumul de pluie,
   et la phrase qui nomme le plus chaud et le plus arrosé. En dessous d'un
   millimètre partout, la semaine se dit sèche. */
export function bilanLieux(series, periode = PERIODE_DEFAUT) {
  const lignes = series.map(s => {
    const j = s.jours.filter(x => Number.isFinite(x.tx));
    if (j.length < Math.min(4, s.jours.length)) return null;
    return { nom: s.nom, tx: Math.round(moyenne(j.map(x => x.tx)) * 10) / 10,
      tn: Math.round(moyenne(j.filter(x => Number.isFinite(x.tn)).map(x => x.tn)) * 10) / 10,
      mm: Math.round(s.jours.reduce((a, x) => a + (x.mm || 0), 0) * 10) / 10 };
  }).filter(Boolean);
  if (lignes.length < 2) return null;
  const chaud = lignes.reduce((a, l) => (l.tx > a.tx ? l : a));
  const arrose = lignes.reduce((a, l) => (l.mm > a.mm ? l : a));
  const pluie = arrose.mm < 1 ? "sec partout" : `${arrose.nom} le plus arrosé, ${fr(arrose.mm, 0)} mm`;
  return { lignes, chaud: chaud.nom, arrose: arrose.mm < 1 ? null : arrose.nom,
    phrase: `${chaud.nom} le plus chaud ${motsDe(periode).ici}, ${fr(chaud.tx)}° en moyenne au plus chaud ; ${pluie}.` };
}