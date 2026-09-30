/* L'eau de la commune, jalon 18, lot 2, décidé par Jérôme le 30 septembre 2026 :
   la restriction en vigueur, et l'état de la nappe phréatique la plus proche.

   La restriction vient de VigiEau, pour le point de la commune et le profil
   des particuliers : un niveau par ressource, eaux de surface, eaux
   souterraines, eau potable, avec l'arrêté qui la fonde.

   La nappe vient de Hub'eau, le service public des données sur l'eau. Le BRGM
   qualifie l'état des nappes par un indicateur réservé aux gestionnaires ;
   l'application le recalcule sur le même principe pour le piézomètre le plus
   proche qui mesure depuis quinze ans au moins et a une mesure de moins de
   vingt jours : le niveau moyen des trente derniers jours, comparé à celui des
   mêmes trente jours de chaque année depuis 1995. La part des années plus
   basses donne la classe, de « très basse » à « très haute ». Les mesures, un
   demi-mégaoctet, ne se gardent pas ; le résultat se garde une journée. */

import { rangDe, NOMS } from "./vigieau.js";
import { distanceKm } from "./postes.js";

const VIGIEAU = "https://api.vigieau.gouv.fr/api/zones";
const HUBEAU = "https://hubeau.eaufrance.fr/api/v1/niveaux_nappes";
const CACHE = "mameteo.eau.nappe.v1";
const GARDE_NAPPE = 24 * 3600 * 1000;

export const RESSOURCES = { SUP: "Eaux de surface", SOU: "Eaux souterraines", AEP: "Eau potable" };

/* La restriction de la commune : le niveau le plus grave, et le détail par
   ressource, chacun avec son arrêté. */
export function restrictionsDe(zones) {
  const l = (Array.isArray(zones) ? zones : []).map(z => ({ type: z.type, nom: z.nom, niveau: z.niveauGravite,
    rang: rangDe(z.niveauGravite), arrete: z.arrete?.cheminFichier || null, fin: z.arrete?.dateFinValidite?.slice(0, 10) || null }))
    .filter(z => z.rang > 0);
  const pire = l.reduce((a, z) => (z.rang > (a?.rang || 0) ? z : a), null);
  return { rang: pire?.rang || 0, niveau: pire ? NOMS[pire.niveau] : null, zones: l.sort((a, b) => b.rang - a.rang) };
}

/* Le nom d'un piézomètre, écrit en capitales par la source : « FORAGE CD21
   (LAIGNES-21) » devient « Forage CD21 (Laignes-21) ». Les codes, qui portent
   un chiffre, gardent leurs capitales. */
const PETITS_MOTS = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "en", "au", "aux", "d", "l", "à"]);
export function nomPropre(t) {
  let premier = true;
  return String(t || "").trim().replace(/\s+/g, " ").replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g, (m, i, s) => {
    const colle = /\d/.test(s[i - 1] || "") || /\d/.test(s[i + m.length] || "");
    const b = m.toLowerCase();
    const out = colle ? m : !premier && PETITS_MOTS.has(b) ? b : b.charAt(0).toUpperCase() + b.slice(1);
    premier = false;
    return out;
  });
}

/* Les sept classes de l'état d'une nappe, par la part des années plus basses. */
export const CLASSES_NAPPE = [[0.1, "très basse"], [0.2, "basse"], [0.4, "modérément basse"], [0.6, "autour de la normale"],
  [0.8, "modérément haute"], [0.9, "haute"], [1.01, "très haute"]];

/* L'état d'une nappe à partir de ses mesures, [{ date_mesure, niveau_nappe_eau }]
   triées : dix années comparables au moins, quinze mesures par fenêtre. */
export function etatNappe(mesures) {
  const m = (mesures || []).filter(x => Number.isFinite(x?.niveau_nappe_eau) && x?.date_mesure);
  if (!m.length) return null;
  const fin = m[m.length - 1].date_mesure;
  const [af, mf, jf] = fin.split("-").map(Number);
  const fenetres = new Map();
  for (const x of m) {
    const t = Date.parse(`${x.date_mesure}T12:00:00Z`);
    for (let an = 1995; an <= af; an++) {
      const f = Date.parse(`${an}-${String(mf).padStart(2, "0")}-${String(mf === 2 && jf === 29 ? 28 : jf).padStart(2, "0")}T12:00:00Z`);
      if (t > f - 30 * 86400000 && t <= f) (fenetres.get(an) || fenetres.set(an, []).get(an)).push(x.niveau_nappe_eau);
    }
  }
  const moy = new Map([...fenetres].filter(([, v]) => v.length >= 15).map(([an, v]) => [an, v.reduce((a, b) => a + b, 0) / v.length]));
  const actuel = moy.get(af);
  moy.delete(af);
  if (actuel === undefined || moy.size < 10) return null;
  const part = [...moy.values()].filter(v => v < actuel).length / moy.size;
  const classe = CLASSES_NAPPE.find(([s]) => part < s)[1];
  const derniers = m.slice(-7).map(x => x.niveau_nappe_eau), avant = m.slice(-14, -7).map(x => x.niveau_nappe_eau);
  const d = avant.length ? derniers.reduce((a, b) => a + b, 0) / derniers.length - avant.reduce((a, b) => a + b, 0) / avant.length : 0;
  return { classe, part: Math.round(part * 100) / 100, annees: moy.size, plusBasses: [...moy.values()].filter(v => v < actuel).length,
    tendance: d > 0.02 ? "en hausse" : d < -0.02 ? "en baisse" : "stable", fin };
}

/* Le piézomètre le plus proche : quinze ans de mesures au moins, une mesure
   de moins de vingt jours. Un cadre de cinquante kilomètres, puis de cent. */
export function choisirPiezo(stations, g, aujourdhui) {
  const d0 = new Date(`${aujourdhui}T12:00`);
  const limite = new Date(d0); limite.setFullYear(d0.getFullYear() - 15);
  const recent = new Date(d0); recent.setDate(d0.getDate() - 20);
  const iso = x => x.toISOString().slice(0, 10);
  return (stations || []).filter(s => (s.date_debut_mesure || "9999") <= iso(limite) && (s.date_fin_mesure || "") >= iso(recent)
    && Number.isFinite(s.x) && Number.isFinite(s.y))
    .map(s => ({ ...s, km: distanceKm(g.lat, g.lon, s.y, s.x) }))
    .sort((a, b) => a.km - b.km)[0] || null;
}

export async function lireNappe(g, aujourdhui, fetcheur = fetch) {
  const cle = `${g.lat.toFixed(2)},${g.lon.toFixed(2)}`;
  try {
    const e = JSON.parse(localStorage.getItem(CACHE) || "{}")[cle];
    if (e && Date.now() - e.t < GARDE_NAPPE) return e.n;
  } catch { /* cache indisponible */ }
  let station = null;
  for (const [dlo, dla] of [[0.65, 0.45], [1.3, 0.9]]) {
    const bb = `${(g.lon - dlo).toFixed(3)},${(g.lat - dla).toFixed(3)},${(g.lon + dlo).toFixed(3)},${(g.lat + dla).toFixed(3)}`;
    const r = await fetcheur(`${HUBEAU}/stations?bbox=${bb}&format=json&size=200&fields=code_bss,libelle_pe,nom_commune,x,y,date_debut_mesure,date_fin_mesure`);
    if (!r.ok) throw new Error(`hubeau ${r.status}`);
    station = choisirPiezo((await r.json()).data, g, aujourdhui);
    if (station) break;
  }
  let n = null;
  if (station) {
    const r = await fetcheur(`${HUBEAU}/chroniques?code_bss=${encodeURIComponent(station.code_bss)}&date_debut_mesure=1995-01-01`
      + `&fields=date_mesure,niveau_nappe_eau&size=20000&sort=asc`);
    if (!r.ok) throw new Error(`hubeau ${r.status}`);
    const e = etatNappe((await r.json()).data);
    if (e) n = { ...e, station: nomPropre(station.libelle_pe || station.code_bss), commune: station.nom_commune || null, km: Math.round(station.km) };
  }
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    c[cle] = { t: Date.now(), n };
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch { /* plein */ }
  return n;
}

/* L'état de l'eau pour la commune affichée. */
let etat = null;
const cleDeLieu = g => `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
export const etatEau = g => (etat && Number.isFinite(g?.lat) && etat.cle === cleDeLieu(g) ? etat : null);
export const poserEau = e => { etat = e; };

export async function chargerEau(g, aujourdhui, fetcheur = fetch) {
  if (!Number.isFinite(g?.lat)) return null;
  const [rz, nappe] = await Promise.all([
    fetcheur(`${VIGIEAU}?lon=${g.lon}&lat=${g.lat}&profil=particulier`).then(r => (r.ok ? r.json() : [])).catch(() => null),
    lireNappe(g, aujourdhui, fetcheur).catch(() => null)]);
  etat = { cle: cleDeLieu(g), restriction: rz ? restrictionsDe(rz) : null, nappe };
  return etat;
}

/* Les mots de la tuile : la restriction en grand, la nappe dessous. */
export function tuileEau(e) {
  if (!e) return null;
  const r = e.restriction;
  const valeur = !r ? "—" : r.rang ? r.niveau : "Aucune";
  const sous = e.nappe ? `nappe ${e.nappe.classe}` : r && !r.rang ? "restriction" : "restriction d'eau";
  const classe = !r ? "" : r.rang >= 4 ? "v-brulant" : r.rang === 3 ? "v-chaud" : r.rang === 2 ? "v-attention" : "";
  return { valeur, sous, classe };
}
