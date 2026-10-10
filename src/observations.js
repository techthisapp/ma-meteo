/* Les observations des stations de Météo-France, version 187, jalon 6,
   demande de Jérôme du 10 octobre 2026 : juger les prévisions sur ce qui a
   été mesuré, et non sur ce qu'un modèle recalcule après coup.

   L'API « paquet d'observations » du portail de Météo-France, avec la même
   clé que PIAF. Relevé le 10 octobre 2026 :

   | Point | Constat |
   |---|---|
   | Liste des stations | `liste-stations`, texte de 140 kilooctets, 2151 stations ; gardée trente jours en abrégé |
   | Paquet horaire | `paquet/horaire?id-departement=21&format=json`, toutes les stations du département, les cinq derniers jours heure par heure, 72 kilooctets compressés |
   | Corse | le département se demande sous le numéro 20 |
   | Grandeurs | température en kelvins `t`, pluie de l'heure écoulée `rr1` en millimètres, heure de validité en UTC |

   La station retenue est la plus proche du lieu à moins de vingt kilomètres
   et à moins de deux cents mètres d'écart d'altitude : au delà, elle mesure
   un autre temps que celui du lieu. Sans station qui convienne, le journal
   garde le relevé d'Open-Meteo, comme avant. */

import { chercherEn, cleHeure, lireGardee, ecrireGardee } from "./horloge.js";
import * as Reglages from "./reglages.js";

export const SERVICE = "https://public-api.meteofrance.fr/public/DPPaquetObs/v2";
export const DISTANCE_MAX = 20;      // kilomètres
export const ECART_ALTITUDE = 200;   // mètres
const TABLE = "mameteo.stations-mf.v1";
const GARDE_LISTE = 30 * 86400000;

const avecCle = (chemin, cle) => `${SERVICE}/${chemin}${chemin.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(cle)}`;

/* La liste abrégée : identifiant, latitude, longitude, altitude, nom. */
export function lireListe(texte) {
  return String(texte || "").split(/\r?\n/).slice(1).map(l => l.split(";"))
    .filter(c => /^\d{8}$/.test(c[0]) && Number.isFinite(Number(c[3])) && Number.isFinite(Number(c[4])))
    .map(c => [c[0], Number(c[3]), Number(c[4]), Number(c[5]), c[2]]);
}

let liste = null;
export async function stations(fetcheur = chercherEn(20000)) {
  if (liste) return liste;
  const g = lireGardee(TABLE, "liste", GARDE_LISTE);
  if (g && Array.isArray(g.s)) { liste = g.s; return liste; }
  const cle = Reglages.clePiaf();
  if (!cle) return null;
  try {
    const r = await fetcheur(avecCle("liste-stations", cle));
    if (!r.ok) return null;
    liste = lireListe(await r.text());
    if (liste.length) ecrireGardee(TABLE, "liste", { t: Date.now(), s: liste }, GARDE_LISTE);
    return liste.length ? liste : null;
  } catch { return null; }
}

const km = (a, b, c, d) => {
  const r = Math.PI / 180, x = (d - b) * r * Math.cos(((a + c) / 2) * r), y = (c - a) * r;
  return Math.hypot(x, y) * 6371;
};

/* La station du lieu, ou rien. */
export function stationDe(liste, lat, lon, altitude = null) {
  let bon = null;
  for (const [id, la, lo, alt, nom] of liste || []) {
    const d = km(lat, lon, la, lo);
    if (d > DISTANCE_MAX) continue;
    if (Number.isFinite(altitude) && Number.isFinite(alt) && Math.abs(alt - altitude) > ECART_ALTITUDE) continue;
    if (!bon || d < bon.km) bon = { id, nom, km: Math.round(d * 10) / 10, alt };
  }
  return bon;
}

/* Le département d'une station, tel que le paquet le demande. */
export const departementDe = id => id.slice(0, 2);

/* Les mesures horaires d'une station, par heure de Paris :
   `{ "2026-10-10T21": { t: 11.0, rr1: 0.2 } }`. */
export function lirePaquet(d, id) {
  const out = {};
  for (const x of Array.isArray(d) ? d : []) {
    if (x.geo_id_insee !== id || !x.validity_time) continue;
    const h = cleHeure(new Date(x.validity_time)).slice(0, 13);
    out[h] = {
      t: Number.isFinite(x.t) ? Math.round((x.t - 273.15) * 10) / 10 : null,
      rr1: Number.isFinite(x.rr1) ? x.rr1 : null,
    };
  }
  return out;
}

const paquets = new Map();
export async function mesures(station, fetcheur = chercherEn(20000)) {
  const cle = Reglages.clePiaf();
  if (!cle || !station) return null;
  const dep = departementDe(station.id);
  const g = paquets.get(dep);
  if (g && Date.now() - g.quand < 30 * 60000) return lirePaquet(g.d, station.id);
  try {
    const r = await fetcheur(avecCle(`paquet/horaire?id-departement=${dep}&format=json`, cle));
    if (!r.ok) return null;
    const d = await r.json();
    paquets.set(dep, { d, quand: Date.now() });
    return lirePaquet(d, station.id);
  } catch { return null; }
}

/* Le tout : la station du lieu et ses mesures, ou rien. */
export async function duLieu(lat, lon, altitude, fetcheur) {
  if (!Reglages.clePiaf() || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const l = await stations(fetcheur);
  const s = stationDe(l, lat, lon, altitude);
  if (!s) return null;
  const m = await mesures(s, fetcheur);
  return m ? { station: s, mesures: m } : null;
}

/* Le nom d'une station, d'après la liste gardée. */
export function nomDe(id) {
  const l = liste || lireGardee(TABLE, "liste", GARDE_LISTE)?.s;
  const s = (l || []).find(x => x[0] === id);
  return s ? s[4] : null;
}

export function oublier() { liste = null; paquets.clear(); }
