/* La météo des neiges, jalon 16. Lot 2 : les stations proches.

   Une station est proche si elle est à une heure de route au plus de la
   commune, décidé par Jérôme le 28 septembre 2026. Les stations à moins de
   100 kilomètres à vol d'oiseau sont présélectionnées dans la liste embarquée ;
   une seule requête au service public de calcul d'itinéraire OSRM donne
   ensuite la durée en voiture vers chacune. Le serveur public d'OSRM est une
   démonstration à la charge limitée : il n'est interrogé qu'une fois par
   commune, et le résultat se garde trente jours, puisqu'une route ne change
   pas d'un jour à l'autre. S'il ne répond pas, une estimation à vol d'oiseau
   prend le relais, 55 kilomètres valant environ une heure de route, et le
   résultat le dit. La requête est celle des plages, `src/trajets.js`, depuis
   le 2 octobre 2026 ; la neige avait sa propre copie, antérieure. */

import { recaler, lireGardee, ecrireGardee, chercher, distanceKm } from "./horloge.js";
import { candidatesDe, prochesDe, gardees } from "./trajets.js";
export { adresseOsrm, RAYON_KM, MINUTES_MAX, KM_PAR_HEURE_ESTIMEE } from "./trajets.js";

const CACHE = "mameteo.neige.proches.v1";

/* La liste des stations se charge à la première demande, non au lancement.
   Audit du 1er octobre 2026, constat 5.1. */
let STATIONS = null;
export async function listeStations() {
  if (!STATIONS) STATIONS = (await import("./stations.js")).STATIONS;
  return STATIONS;
}

/* Le domaine d'une station, ou null si elle est indépendante : les stations
   se présentent regroupées sous leur domaine, décidé le 30 septembre 2026. */
const deStation = s => ({ nom: s[0], pays: s[1], lat: s[2], lon: s[3], pied: s[4], sommet: s[5], km: s[6],
  domaine: s[7] ?? null });

/* La proximité est celle des plages, dans src/trajets.js : les stations à
   moins de cent kilomètres, puis celles à une heure de route, gardées trente
   jours par commune. */
export const candidates = (g, liste = STATIONS) => candidatesDe(g, liste, deStation);
export const proches = (g, liste = STATIONS, fetcheur = chercher) => prochesDe(g, candidates(g, liste), fetcheur);
export const prochesGardees = (g, fetcheur = chercher) =>
  gardees(CACHE, g, async () => proches(g, await listeStations(), fetcheur));

/* ---------- Lot 3 : la neige des stations proches ---------- */

/* Une seule requête pour toutes les stations proches, deux points par
   station, le pied et le sommet, chacun à son altitude : la prévision se
   calcule à l'altitude donnée. Dix stations au plus, les plus proches. Trois
   jours passés pour la neige fraîche, sept à venir pour les chutes. */
export const STATIONS_MAX = 10;
const PREVISION = "https://api.open-meteo.com/v1/forecast";

export function adresseNeige(stations) {
  const pts = stations.slice(0, STATIONS_MAX).flatMap(s => [[s.lat, s.lon, s.pied], [s.lat, s.lon, s.sommet]]);
  const q = new URLSearchParams();
  q.set("latitude", pts.map(p => p[0].toFixed(4)).join(","));
  q.set("longitude", pts.map(p => p[1].toFixed(4)).join(","));
  q.set("elevation", pts.map(p => Math.round(p[2])).join(","));
  q.set("hourly", "snow_depth,snowfall,freezing_level_height");
  q.set("daily", "snowfall_sum,wind_gusts_10m_max");
  q.set("past_days", "3");
  q.set("forecast_days", "7");
  q.set("timezone", "Europe/Paris");
  return `${PREVISION}?${q}`;
}

const somme = a => a.reduce((x, v) => x + (Number.isFinite(v) ? v : 0), 0);

/* Le résumé d'un point, pied ou sommet, à l'heure donnée : la neige au sol en
   centimètres, la neige fraîche tombée en 24 et 72 heures, les chutes
   prévues jour par jour à partir d'aujourd'hui, l'isotherme zéro et les
   rafales les plus fortes du jour. */
export function resumePoint(x, heure) {
  const h = x?.hourly, j = x?.daily;
  if (!h?.time || !j?.time) return null;
  let k = h.time.indexOf(heure);
  if (k < 0) k = Math.max(0, h.time.filter(t => t <= heure).length - 1);
  const jour = heure.slice(0, 10);
  const kj = Math.max(0, j.time.indexOf(jour));
  const cm = v => Math.round(v * 10) / 10;
  /* Une valeur absente reste absente : « 0 cm au sol » ou « isotherme 0 m »
     se lisaient quand la source ne disait rien. Audit, constat 1.11. */
  const connu = (v, f) => (Number.isFinite(v) ? f(v) : null);
  return {
    sol: connu(h.snow_depth[k], v => Math.round(v * 100)),
    fraiche24: cm(somme(h.snowfall.slice(Math.max(0, k - 23), k + 1))),
    fraiche72: cm(somme(h.snowfall.slice(Math.max(0, k - 71), k + 1))),
    chutes: j.time.slice(kj).map((t, i) => ({ date: t, cm: cm(j.snowfall_sum[kj + i] ?? 0) })),
    iso: connu(h.freezing_level_height[k], v => Math.round(v / 10) * 10),
    rafales: connu(j.wind_gusts_10m_max[kj], Math.round),
  };
}

/* La réponse du service, une charge par point, ramenée à chaque station :
   son pied et son sommet. */
export function reduireNeige(reponse, stations, heure) {
  const tab = Array.isArray(reponse) ? reponse : [reponse];
  return stations.slice(0, STATIONS_MAX).map((s, i) => ({
    ...s, pied: s.pied, sommet: s.sommet,
    bas: resumePoint(tab[2 * i], heure), haut: resumePoint(tab[2 * i + 1], heure),
  })).filter(s => s.bas && s.haut);
}

/* La neige lue se garde sur l'appareil pour l'heure, au lieu d'une table en
   mémoire qui grandissait d'une entrée par heure et par lieu : audit du
   1er octobre 2026, constats 5.5 et 5.14. */
const CACHE_NEIGE = "mameteo.neige.lue.v1";
export async function lireNeige(stations, heure, fetcheur = chercher) {
  const u = adresseNeige(stations);
  const cle = `${u}|${heure.slice(0, 13)}`;
  const gardee = lireGardee(CACHE_NEIGE, cle, 3600 * 1000);
  if (gardee) return gardee.res;
  const r = await fetcheur(u);
  if (!r.ok) throw new Error(`neige ${r.status}`);
  const res = reduireNeige(recaler(await r.json()), stations, heure);
  ecrireGardee(CACHE_NEIGE, cle, { t: Date.now(), res }, 3600 * 1000);
  return res;
}

const fr = v => String(v).replace(".", ",");
const jourDe = t => new Date(`${t}T12:00`).toLocaleDateString("fr-FR", { weekday: "long" });

/* Une chute notable : au moins dix centimètres attendus au sommet sur une
   journée, ou vingt sur les trois prochains jours, dans une station proche.
   Le conseil nomme la station où il en tombera le plus. */
export function chuteNotable(resumes) {
  let meilleur = null;
  for (const s of resumes) {
    const c = s.haut.chutes.slice(0, 3);
    const trois = somme(c.map(x => x.cm));
    const jourMax = Math.max(0, ...c.map(x => x.cm));
    if ((trois >= 20 || jourMax >= 10) && (!meilleur || trois > meilleur.cm)) {
      const dernier = c.reduce((a, x) => (x.cm > 0 ? x : a), c[0]);
      meilleur = { nom: s.nom, cm: Math.round(trois), jusque: dernier.date };
    }
  }
  if (!meilleur) return null;
  return { ...meilleur, phrase: `${meilleur.cm} cm de neige fraîche attendus à ${meilleur.nom}, d'ici ${jourDe(meilleur.jusque)}.` };
}

/* La phrase de la porte et de la feuille : la station la mieux enneigée au
   sommet, ou, sans neige au sol nulle part, l'isotherme zéro. */
export function phraseNeige(resumes) {
  if (!resumes.length) return "";
  const mieux = resumes.reduce((a, s) => (s.haut.sol > a.haut.sol ? s : a));
  if (mieux.haut.sol > 0) {
    const fraiche = mieux.haut.fraiche72 >= 1 ? `, dont ${Math.round(mieux.haut.fraiche72)} cm de fraîche` : "";
    return `${mieux.nom}, ${mieux.haut.sol} cm au sommet${fraiche}.`;
  }
  const isos = resumes.map(s => s.haut.iso).filter(Number.isFinite);
  if (!isos.length) return "Pas encore de neige au sol.";
  const iso = Math.round(somme(isos) / isos.length / 100) * 100;
  return `Pas encore de neige au sol ; isotherme zéro vers ${fr(iso.toLocaleString("fr-FR"))} m.`;
}

/* La saison de la porte, décidée le 28 septembre 2026 : de novembre à avril,
   et au-delà tant que la neige tient au sommet d'une station proche. */
export function enSaison(date, resumes = []) {
  const m = Number(date.slice(5, 7));
  if (m >= 11 || m <= 4) return true;
  return resumes.some(s => s.haut.sol > 0);
}

/* L'état de la neige pour la commune affichée : ses stations proches et leur
   résumé, lus une fois après la prévision, sans la retarder. */
let etat = null;
const cleDeLieu = g => `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
export const etatNeige = g => (etat && Number.isFinite(g?.lat) && etat.cle === cleDeLieu(g) ? etat : null);
export const poserNeige = e => { etat = e; };

export async function chargerNeige(g, heure, fetcheur = chercher) {
  if (!Number.isFinite(g?.lat)) return null;
  const cle = cleDeLieu(g);
  const proches = await prochesGardees(g, fetcheur);
  let resumes = [];
  if (proches.length) {
    try { resumes = await lireNeige(proches, heure, fetcheur); } catch { resumes = etat?.cle === cle ? etat.resumes : []; }
  }
  etat = { cle, proches, resumes, heure };
  return etat;
}

/* ---------- La neige sur la carte, jalon 18, lot 3 ----------

   Les grands domaines, quarante kilomètres de pistes au moins, les plus grands
   d'abord, espacés de vingt-cinq kilomètres, et pour chacun la neige au sol à
   son sommet, à l'heure. Une requête pour tous, gardée une heure. */
let domaines = null;
export function domainesCarte(liste = STATIONS, ecart = 25) {
  if (domaines && liste === STATIONS) return domaines;
  const out = [];
  for (const s of liste.map(deStation).filter(s => s.km >= 40 && !s.domaine).sort((a, b) => b.km - a.km)) {
    if (out.every(q => distanceKm(s.lat, s.lon, q.lat, q.lon) >= ecart)) out.push(s);
  }
  if (liste === STATIONS) domaines = out;
  return out;
}

let neigeCarte = null;
export async function lireNeigeCarte(heure, fetcheur = chercher) {
  if (neigeCarte && Date.now() - neigeCarte.t < 3600 * 1000 && neigeCarte.h === heure.slice(0, 13)) return neigeCarte.l;
  const pts = domainesCarte(await listeStations());
  const q = new URLSearchParams({ latitude: pts.map(s => s.lat.toFixed(4)).join(","), longitude: pts.map(s => s.lon.toFixed(4)).join(","),
    elevation: pts.map(s => Math.round(s.sommet)).join(","), hourly: "snow_depth", forecast_days: "1", timezone: "Europe/Paris" });
  const r = await fetcheur(`${PREVISION}?${q}`);
  if (!r.ok) throw new Error(`neige ${r.status}`);
  const d = recaler(await r.json());
  const t = Array.isArray(d) ? d : [d];
  const l = pts.map((s, i) => {
    const h = t[i]?.hourly;
    const k = h?.time ? Math.max(0, h.time.indexOf(heure)) : -1;
    const v = k >= 0 ? h.snow_depth[k] : null;
    return Number.isFinite(v) ? { nom: s.nom, lat: s.lat, lon: s.lon, sol: Math.round(v * 100) } : null;
  }).filter(Boolean);
  neigeCarte = { t: Date.now(), h: heure.slice(0, 13), l };
  return l;
}
