/* Les bulletins d'estimation du risque d'avalanche de Météo-France, version
   189, demande de Jérôme du 10 octobre 2026.

   Un bulletin par massif, 35 massifs des Alpes, des Pyrénées et de Corse,
   rédigé chaque jour vers 16 h de début novembre à fin mai pour le
   lendemain. Le risque s'y dit de 1 à 5, faible, limité, marqué, fort et
   très fort, avec parfois une limite d'altitude ou de versant, et une
   tendance pour le surlendemain.

   L'API du portail de Météo-France, avec la même clé que PIAF. Relevé le
   10 octobre 2026 : `liste-massifs` rend les 35 massifs en GeoJSON, 70
   kilooctets, contours compris ; `massif/BRA?id-massif=3&format=xml` rend le
   bulletin en XML, décrit dans le document de Météo-France du 26 octobre
   2023. Hors saison, le service rend à la place un court message
   « la saison est terminée sur le massif, rendez-vous début novembre ». */

import { chercherEn, lireGardee, ecrireGardee } from "./horloge.js";
import * as Reglages from "./reglages.js";

export const SERVICE = "https://public-api.meteofrance.fr/public/DPBRA/v1";
export const RISQUES = ["faible", "limité", "marqué", "fort", "très fort"];
export const nomRisque = r => RISQUES[r - 1] || null;
const TABLE = "mameteo.avalanche.v1";
const GARDE_MASSIFS = 30 * 86400000;
const GARDE_BULLETIN = 3600000;
const avecCle = (chemin, cle) => `${SERVICE}/${chemin}${chemin.includes("?") ? "&" : "?"}apikey=${encodeURIComponent(cle)}`;

/* Les massifs abrégés : code, nom, contours au centième de degré. */
export function lireMassifs(geo) {
  const r = v => Math.round(v * 100) / 100;
  return (geo?.features || []).map(f => {
    const g = f.geometry || {};
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    const anneaux = polys.map(p => (p[0] || []).map(([x, y]) => [r(x), r(y)]));
    return { code: f.properties?.code, nom: f.properties?.title, montagne: f.properties?.mountain, anneaux };
  }).filter(m => Number.isFinite(m.code) && m.nom);
}

let massifs = null;
export async function listeMassifs(fetcheur = chercherEn(20000)) {
  if (massifs) return massifs;
  const g = lireGardee(TABLE, "massifs", GARDE_MASSIFS);
  if (g && Array.isArray(g.m)) { massifs = g.m; return massifs; }
  const cle = Reglages.clePiaf();
  if (!cle) return null;
  try {
    const r = await fetcheur(avecCle("liste-massifs", cle));
    if (!r.ok) return null;
    massifs = lireMassifs(await r.json());
    if (massifs.length) ecrireGardee(TABLE, "massifs", { t: Date.now(), m: massifs }, GARDE_MASSIFS);
    return massifs.length ? massifs : null;
  } catch { return null; }
}

/* Le massif qui contient un point, par le compte des croisements. */
const dedans = (anneau, x, y) => {
  let c = false;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i], [xj, yj] = anneau[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
export const massifDe = (liste, lat, lon) =>
  (liste || []).find(m => m.anneaux.some(a => dedans(a, lon, lat))) || null;

/* La lecture du bulletin XML. Hors saison, un message seul. */
const nombre = v => (v === null || v === undefined || v === "" ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
export function lireBulletin(texte) {
  const doc = new DOMParser().parseFromString(String(texte || ""), "application/xml");
  const racine = doc.documentElement;
  if (!racine || racine.nodeName === "parsererror") return null;
  if (racine.nodeName === "message") return { horsSaison: true, message: racine.textContent.trim() };
  if (racine.nodeName !== "BULLETINS_NEIGE_AVALANCHE") return null;
  const r = racine.querySelector("CARTOUCHERISQUE > RISQUE");
  const p = racine.querySelector("CARTOUCHERISQUE > PENTE");
  const texteDe = s => racine.querySelector(s)?.textContent.trim() || "";
  const ORIENT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return {
    horsSaison: false,
    massif: racine.getAttribute("MASSIF"),
    validite: racine.getAttribute("DATEVALIDITE"),
    risque1: nombre(r?.getAttribute("RISQUE1")), loc1: r?.getAttribute("LOC1") || "",
    risque2: nombre(r?.getAttribute("RISQUE2")), loc2: r?.getAttribute("LOC2") || "",
    altitude: nombre(r?.getAttribute("ALTITUDE")),
    maxi: nombre(r?.getAttribute("RISQUEMAXI")),
    maxiJ2: nombre(r?.getAttribute("RISQUEMAXIJ2")),
    commentaire: r?.getAttribute("COMMENTAIRE") || "",
    pentes: p ? ORIENT.filter(o => p.getAttribute(o) === "true") : [],
    resume: texteDe("CARTOUCHERISQUE > RESUME"),
    avis: texteDe("CARTOUCHERISQUE > AVIS"),
  };
}

/* Le risque dit en mots : « marqué au-dessus de 2100 m, limité plus bas ». */
const VERSANT = { E: "à l'est", O: "à l'ouest", W: "à l'ouest", N: "au nord", S: "au sud" };
export function phraseRisque(b) {
  if (!b || b.horsSaison || !b.risque1) return "";
  const n1 = nomRisque(b.risque1), n2 = nomRisque(b.risque2);
  if (!n2 || b.risque2 === b.risque1) return `Risque ${n1}, ${b.risque1} sur 5`;
  if (b.altitude) return `Risque ${n2} au-dessus de ${b.altitude} m, ${n1} plus bas`;
  return `Risque ${n2} ${VERSANT[b.loc2] || ""}, ${n1} ${VERSANT[b.loc1] || "ailleurs"}`.replace(/\s+,/, ",");
}
const NOMS_ORIENT = { N: "nord", NE: "nord-est", E: "est", SE: "sud-est", S: "sud", SW: "sud-ouest", W: "ouest", NW: "nord-ouest" };
export const phrasePentes = b => (b?.pentes?.length ? `Pentes les plus dangereuses : ${b.pentes.map(o => NOMS_ORIENT[o]).join(", ")}` : "");

const bulletins = new Map();
export async function bulletin(code, fetcheur = chercherEn(15000)) {
  const m = bulletins.get(code);
  if (m && Date.now() - m.quand < GARDE_BULLETIN) return m.b;
  const cle = Reglages.clePiaf();
  if (!cle) return null;
  try {
    const r = await fetcheur(avecCle(`massif/BRA?id-massif=${code}&format=xml`, cle));
    if (!r.ok) return null;
    const b = lireBulletin(await r.text());
    if (b) bulletins.set(code, { b, quand: Date.now() });
    return b;
  } catch { return null; }
}

/* Les massifs des stations proches et leurs bulletins, gardés en mémoire
   pour la feuille de la neige et l'accueil. */
let etat = null;
export async function charger(stations, fetcheur) {
  if (!Reglages.clePiaf() || !Array.isArray(stations) || !stations.length) return null;
  const liste = await listeMassifs(fetcheur);
  if (!liste) return null;
  const vus = new Map();
  for (const s of stations) {
    const m = massifDe(liste, s.lat, s.lon);
    if (m && !vus.has(m.code)) vus.set(m.code, m);
  }
  const out = [];
  for (const m of vus.values()) out.push({ massif: m.nom, code: m.code, b: await bulletin(m.code, fetcheur) });
  etat = { cle: stations.map(s => s.nom).join("|"), massifs: out.filter(x => x.b) };
  return etat;
}
export const etatPour = stations => (etat && Array.isArray(stations) && etat.cle === stations.map(s => s.nom).join("|") ? etat : null);

/* Le risque fort ou très fort d'un massif proche, pour l'accueil. */
export function risqueFort(e) {
  const x = (e?.massifs || []).filter(m => !m.b.horsSaison && m.b.maxi >= 4).sort((a, b) => b.b.maxi - a.b.maxi)[0];
  return x ? { massif: x.massif, maxi: x.b.maxi } : null;
}
export function oublier() { massifs = null; bulletins.clear(); etat = null; }
