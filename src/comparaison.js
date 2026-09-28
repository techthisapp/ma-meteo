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

const lu = new Map();

/* L'autre année, lue une fois par lieu et par année pendant la séance. */
export async function lireAnnee(lat, lon, dates, annee, fetcheur = fetch) {
  const cle = `${lat.toFixed(3)},${lon.toFixed(3)}|${dates[0]}|${annee}`;
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
export function bilan(cette, autre, annee) {
  const paires = cette.map((j, k) => [j, autre[k]])
    .filter(([a, b]) => b && Number.isFinite(a.tx) && Number.isFinite(b.tx));
  if (paires.length < 4) return null;
  const dtx = moyenne(paires.map(([a, b]) => a.tx - b.tx));
  const dtn = moyenne(paires.filter(([a, b]) => Number.isFinite(a.tn) && Number.isFinite(b.tn))
    .map(([a, b]) => a.tn - b.tn));
  const p1 = cette.reduce((s, j) => s + (j.mm || 0), 0);
  const p2 = autre.reduce((s, j) => s + (j.mm || 0), 0);
  const sens = dtx >= 1 ? "Plus chaude" : dtx <= -1 ? "Plus fraîche" : "Semblable";
  const titre = sens === "Semblable"
    ? `Semblable à la même semaine de ${annee}, à ${fr(Math.abs(dtx))}° près au plus chaud`
    : `${sens} que la même semaine de ${annee}, de ${fr(Math.abs(dtx))}° en moyenne au plus chaud`;
  const pluie = Math.abs(p1 - p2) >= 10
    ? (p1 > p2 ? `plus pluvieuse, ${fr(p1, 0)} mm contre ${fr(p2, 0)}` : `plus sèche, ${fr(p1, 0)} mm contre ${fr(p2, 0)}`)
    : `pluie comparable, ${fr(p1, 0)} mm contre ${fr(p2, 0)}`;
  return {
    dtx: Math.round(dtx * 10) / 10, dtn: Number.isFinite(dtn) ? Math.round(dtn * 10) / 10 : null,
    pluie: [Math.round(p1 * 10) / 10, Math.round(p2 * 10) / 10],
    phrase: `${titre} ; ${pluie}.`,
  };
}
