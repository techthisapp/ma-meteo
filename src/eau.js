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
    /* En capitales, « à » perd son accent : « LA SEINE A FAIN ». Seul entre deux
       mots, « a » redevient « à ». */
    const out = colle ? m : !premier && b === "a" ? "à" : !premier && PETITS_MOTS.has(b) ? b
      : b.charAt(0).toUpperCase() + b.slice(1);
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

/* ---------- La rivière la plus proche, jalon 18, lot 2 ----------

   Hub'eau publie, pour environ trois mille stations, la hauteur d'eau et le
   débit en temps réel, et l'historique des débits moyens journaliers. La
   station retenue est la plus proche en service qui a une mesure de moins de
   vingt-quatre heures ; certaines tardent à répondre, l'attente est bornée et
   la suivante prend le relais. Les trois stations les plus proches se gardent
   trente jours par commune : une station ne déménage pas, et la liste des
   stations est l'appel le plus lent. La situation compare le
   débit des sept derniers jours aux mêmes sept jours de chaque année depuis
   1995 : l'historique, deux tiers de mégaoctet, se lit une fois par jour, et
   seul le résultat se garde. Hauteurs en millimètres et débits en litres par
   seconde dans la source. */
const HYDRO = "https://hubeau.eaufrance.fr/api/v2/hydrometrie";
const CACHE_RIVIERE = "mameteo.eau.riviere.v1";
export const CLASSES_DEBIT = [[0.1, "très bas"], [0.2, "bas"], [0.4, "modérément bas"], [0.6, "normal"],
  [0.8, "modérément haut"], [0.9, "haut"], [1.01, "très haut"]];

/* Trente secondes : Hub'eau mettait entre huit et treize secondes à répondre
   le 30 septembre 2026, et la rivière se lit après la tuile, sans rien
   retarder. */
const avecDelai = async (fetcheur, u, ms = 30000) => {
  const c = typeof AbortController === "function" ? new AbortController() : null;
  const t = c ? setTimeout(() => c.abort(), ms) : null;
  try { return await fetcheur(u, c ? { signal: c.signal } : undefined); } finally { if (t) clearTimeout(t); }
};

/* La situation d'un débit, [{ date_obs_elab, resultat_obs_elab }] triés :
   dix années comparables au moins, cinq valeurs par fenêtre de sept jours. */
export function etatDebit(valeurs) {
  const v = (valeurs || []).filter(x => Number.isFinite(x?.resultat_obs_elab) && x?.date_obs_elab);
  if (!v.length) return null;
  const fin = v[v.length - 1].date_obs_elab.slice(0, 10);
  const [af, mf, jf] = fin.split("-").map(Number);
  const par = new Map();
  for (const x of v) {
    const t = Date.parse(`${x.date_obs_elab.slice(0, 10)}T12:00:00Z`);
    for (let an = 1995; an <= af; an++) {
      const f = Date.parse(`${an}-${String(mf).padStart(2, "0")}-${String(mf === 2 && jf === 29 ? 28 : jf).padStart(2, "0")}T12:00:00Z`);
      if (t > f - 7 * 86400000 && t <= f) (par.get(an) || par.set(an, []).get(an)).push(x.resultat_obs_elab);
    }
  }
  const moy = new Map([...par].filter(([, l]) => l.length >= 5).map(([an, l]) => [an, l.reduce((a, b) => a + b, 0) / l.length]));
  const actuel = moy.get(af);
  moy.delete(af);
  if (actuel === undefined || moy.size < 10) return null;
  const autres = [...moy.values()].sort((a, b) => a - b);
  const plusBas = autres.filter(x => x < actuel).length;
  const part = plusBas / autres.length;
  const mediane = autres.length % 2 ? autres[(autres.length - 1) / 2] : (autres[autres.length / 2 - 1] + autres[autres.length / 2]) / 2;
  return { classe: CLASSES_DEBIT.find(([s]) => part < s)[1], part: Math.round(part * 100) / 100, annees: autres.length,
    plusBas, debit7: Math.round(actuel), mediane: Math.round(mediane), fin };
}

/* La tendance de la hauteur sur vingt-quatre heures, à deux centimètres près. */
export function tendanceHauteur(obs) {
  const h = (obs || []).filter(x => Number.isFinite(x?.resultat_obs));
  if (h.length < 2) return null;
  const d = h[h.length - 1].resultat_obs - h[0].resultat_obs;
  return d > 20 ? "en hausse" : d < -20 ? "en baisse" : "stable";
}

const CACHE_STATIONS = "mameteo.eau.stations.v1";
export async function lireRiviere(g, maintenant = new Date(), fetcheur = fetch) {
  let stations = [];
  const cleS = `${g.lat.toFixed(2)},${g.lon.toFixed(2)}`;
  try {
    const e = JSON.parse(localStorage.getItem(CACHE_STATIONS) || "{}")[cleS];
    if (e && Date.now() - e.t < 30 * 24 * 3600 * 1000) stations = e.l;
  } catch { /* cache indisponible */ }
  for (const [dlo, dla] of stations.length ? [] : [[0.4, 0.3], [0.8, 0.6]]) {
    const bb = `${(g.lon - dlo).toFixed(3)},${(g.lat - dla).toFixed(3)},${(g.lon + dlo).toFixed(3)},${(g.lat + dla).toFixed(3)}`;
    const r = await avecDelai(fetcheur, `${HYDRO}/referentiel/stations?bbox=${bb}&en_service=true&format=json&size=200`
      + `&fields=code_station,libelle_station,libelle_cours_eau,longitude_station,latitude_station`);
    if (!r.ok) throw new Error(`hydrometrie ${r.status}`);
    stations = ((await r.json()).data || []).filter(s => Number.isFinite(s.latitude_station))
      .map(s => ({ ...s, km: distanceKm(g.lat, g.lon, s.latitude_station, s.longitude_station) })).sort((a, b) => a.km - b.km);
    if (stations.length) {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_STATIONS) || "{}");
        c[cleS] = { t: Date.now(), l: stations.slice(0, 3) };
        localStorage.setItem(CACHE_STATIONS, JSON.stringify(c));
      } catch { /* plein */ }
      break;
    }
  }
  const depuis = new Date(maintenant.getTime() - 25 * 3600 * 1000).toISOString().slice(0, 19) + "Z";
  /* Parmi les trois plus proches, la première qui mesure aussi le débit ; à
     défaut, la première qui mesure la hauteur. À Paris, la plus proche était
     une échelle de secours sans débit, donc sans situation. */
  let repli = null;
  for (const s of stations.slice(0, 3)) {
    let obs;
    try {
      const r = await avecDelai(fetcheur, `${HYDRO}/observations_tr?code_entite=${s.code_station}&date_debut_obs=${depuis}`
        + `&size=1000&sort=asc&fields=date_obs,resultat_obs,grandeur_hydro`);
      if (!r.ok) continue;
      obs = (await r.json()).data || [];
    } catch { continue; }
    const H = obs.filter(o => o.grandeur_hydro === "H"), Q = obs.filter(o => o.grandeur_hydro === "Q");
    const der = H[H.length - 1];
    if (!der) continue;
    if (!Q.length && !repli) {
      repli = { cours: nomPropre(s.libelle_cours_eau || ""), station: nomPropre(s.libelle_station || s.code_station),
        code: s.code_station, km: Math.round(s.km), hauteur: der.resultat_obs, date: der.date_obs, debit: null,
        tendance: tendanceHauteur(H), situation: null };
      continue;
    }
    if (!Q.length) continue;
    const riviere = { cours: nomPropre(s.libelle_cours_eau || ""), station: nomPropre(s.libelle_station || s.code_station),
      code: s.code_station, km: Math.round(s.km), hauteur: der.resultat_obs, date: der.date_obs,
      debit: Q.length ? Q[Q.length - 1].resultat_obs : null, tendance: tendanceHauteur(H), situation: null };
    /* La situation se garde une journée par station. */
    try {
      const e = JSON.parse(localStorage.getItem(CACHE_RIVIERE) || "{}")[s.code_station];
      if (e && Date.now() - e.t < GARDE_NAPPE) { riviere.situation = e.s; return riviere; }
    } catch { /* cache indisponible */ }
    try {
      const r = await avecDelai(fetcheur, `${HYDRO}/obs_elab?code_entite=${s.code_station}&grandeur_hydro_elab=QmnJ`
        + `&date_debut_obs_elab=1995-01-01&size=20000&fields=date_obs_elab,resultat_obs_elab`, 40000);
      if (r.ok) riviere.situation = etatDebit((await r.json()).data);
      const c = JSON.parse(localStorage.getItem(CACHE_RIVIERE) || "{}");
      c[s.code_station] = { t: Date.now(), s: riviere.situation };
      localStorage.setItem(CACHE_RIVIERE, JSON.stringify(c));
    } catch { /* la situation manque, le temps réel reste */ }
    return riviere;
  }
  return repli;
}

/* ---------- L'étiage d'été et la température de l'eau, jalon 18 ----------

   Le réseau ONDE observe à l'œil, de mai à septembre, l'écoulement des petits
   cours d'eau : visible, faible, interrompu ou à sec. La dernière campagne dans
   un rayon d'environ trente-cinq kilomètres se résume en un décompte, avec le
   point observé le plus proche. La température des rivières se mesure par
   campagnes, rarement en continu : elle ne se dit que si une mesure a moins
   d'une semaine, autour de Montbard la plus récente datait de 2013. */
const ONDE = "https://hubeau.eaufrance.fr/api/v1/ecoulement/observations";
const TEMP = "https://hubeau.eaufrance.fr/api/v1/temperature/chronique";
export const ECOULEMENTS = { sec: "à sec", interrompu: "écoulement interrompu", faible: "écoulement faible", visible: "écoulement visible" };
export function sorteEcoulement(l) {
  const t = String(l || "").toLowerCase();
  return /assec/.test(t) ? "sec" : /non visible/.test(t) ? "interrompu" : /faible/.test(t) ? "faible" : /visible/.test(t) ? "visible" : null;
}

/* Le bilan de la dernière campagne : la dernière observation de chaque point,
   seules celles de la date la plus récente comptent. */
export function bilanEtiage(obs, g) {
  const der = new Map();
  for (const o of obs || []) {
    const s = sorteEcoulement(o.libelle_ecoulement);
    if (!s || !o.date_observation) continue;
    const e = der.get(o.code_station);
    if (!e || o.date_observation > e.date_observation) der.set(o.code_station, { ...o, sorte: s });
  }
  const l = [...der.values()];
  if (!l.length) return null;
  const date = l.reduce((a, o) => (o.date_observation > a ? o.date_observation : a), "");
  const campagne = l.filter(o => o.date_observation === date);
  const compte = { sec: 0, interrompu: 0, faible: 0, visible: 0 };
  for (const o of campagne) compte[o.sorte]++;
  const proche = campagne.filter(o => Number.isFinite(o.latitude))
    .map(o => ({ ...o, km: distanceKm(g.lat, g.lon, o.latitude, o.longitude) })).sort((a, b) => a.km - b.km)[0];
  return { date: date.slice(0, 10), total: campagne.length, ...compte,
    proche: proche ? { station: nomPropre(proche.libelle_station), ecoulement: ECOULEMENTS[proche.sorte], km: Math.round(proche.km) } : null };
}

const cadre = (g, dlo = 0.45, dla = 0.3) => `${(g.lon - dlo).toFixed(3)},${(g.lat - dla).toFixed(3)},${(g.lon + dlo).toFixed(3)},${(g.lat + dla).toFixed(3)}`;
const ilYa = (jour, n) => { const d = new Date(`${jour}T12:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export async function lireEtiage(g, aujourdhui, fetcheur = fetch) {
  const r = await avecDelai(fetcheur, `${ONDE}?bbox=${cadre(g)}&date_observation_min=${ilYa(aujourdhui, 45)}&size=500`
    + `&fields=code_station,libelle_station,libelle_ecoulement,latitude,longitude,date_observation`);
  if (!r.ok) throw new Error(`onde ${r.status}`);
  return bilanEtiage((await r.json()).data, g);
}

export async function lireTemperature(g, aujourdhui, fetcheur = fetch) {
  const r = await avecDelai(fetcheur, `${TEMP}?bbox=${cadre(g)}&date_debut_mesure=${ilYa(aujourdhui, 7)}&size=200&sort=desc`
    + `&fields=libelle_station,resultat,date_mesure_temp,heure_mesure_temp,latitude,longitude`);
  if (!r.ok) throw new Error(`temperature ${r.status}`);
  const m = ((await r.json()).data || []).filter(x => Number.isFinite(x.resultat) && Number.isFinite(x.latitude))
    .map(x => ({ ...x, km: distanceKm(g.lat, g.lon, x.latitude, x.longitude) })).sort((a, b) => a.km - b.km)[0];
  return m ? { station: nomPropre(m.libelle_station), valeur: Math.round(m.resultat * 10) / 10, date: m.date_mesure_temp,
    heure: (m.heure_mesure_temp || "").slice(0, 5), km: Math.round(m.km) } : null;
}

/* L'état de l'eau pour la commune affichée. */
let etat = null;
const cleDeLieu = g => `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
export const etatEau = g => (etat && Number.isFinite(g?.lat) && etat.cle === cleDeLieu(g) ? etat : null);
export const poserEau = e => { etat = e; };

/* La restriction et la nappe d'abord ; la rivière, plus lente, ensuite, sans
   retarder la tuile : `surRiviere` redessine quand elle arrive. */
export async function chargerEau(g, aujourdhui, fetcheur = fetch, surRiviere = null) {
  if (!Number.isFinite(g?.lat)) return null;
  const [rz, nappe] = await Promise.all([
    fetcheur(`${VIGIEAU}?lon=${g.lon}&lat=${g.lat}&profil=particulier`).then(r => (r.ok ? r.json() : [])).catch(() => null),
    lireNappe(g, aujourdhui, fetcheur).catch(() => null)]);
  const e = { cle: cleDeLieu(g), restriction: rz ? restrictionsDe(rz) : null, nappe, riviere: undefined, etiage: undefined, temperature: undefined };
  etat = e;
  /* La rivière, l'étiage et la température de l'eau, plus lents, arrivent
     chacun à son tour. */
  const apres = (p, cle) => p.catch(() => null).then(v => { e[cle] = v; if (etat === e && surRiviere) surRiviere(); });
  apres(lireRiviere(g, new Date(), fetcheur), "riviere");
  apres(lireEtiage(g, aujourdhui, fetcheur), "etiage");
  apres(lireTemperature(g, aujourdhui, fetcheur), "temperature");
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
