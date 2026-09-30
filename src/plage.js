/* La météo des plages, jalon 15. Lot 2 : les plages proches.

   Une plage est proche si elle est à une heure de route au plus de la
   commune, décidé par Jérôme le 28 septembre 2026, comme les stations de ski.
   Les plages à moins de 100 kilomètres à vol d'oiseau sont présélectionnées,
   quatre-vingts au plus ; OSRM donne la durée en voiture vers chacune. Sans
   réponse, une estimation à vol d'oiseau, 55 kilomètres pour une heure,
   marquée comme telle et jamais gardée. Le résultat se garde trente jours par
   commune. */

import { PLAGES, SAISON_QUALITE } from "./plages.js";
import { distanceKm } from "./postes.js";
import { dureesMinutes } from "./trajets.js";
import { cardinal } from "./previsions.js";

export const RAYON_KM = 100;
export const MINUTES_MAX = 60;
export const KM_PAR_HEURE_ESTIMEE = 55;
const CANDIDATES_MAX = 80;
const CACHE = "mameteo.plage.proches.v1";
const GARDE = 30 * 24 * 3600 * 1000;

const dePlage = p => ({ nom: p[0], pays: p[1], lat: p[2], lon: p[3], commune: p[4] ?? null, departement: p[5] ?? null,
  qualite: p[6] ?? null, fiche: p[7] ?? null });

/* Le classement officiel de la qualité de l'eau, et la fiche du ministère de
   la Santé, demandés par Jérôme le 30 septembre 2026. Le drapeau de baignade,
   hissé chaque jour par les sauveteurs, n'est publié nulle part de façon
   lisible : l'application ne le donne pas. */
export const SAISON = SAISON_QUALITE;
const QUALITES = { 0: "non classée", 1: "excellente", 2: "bonne", 3: "suffisante", 4: "insuffisante" };
export const qualiteDe = q => (q === null || q === undefined ? null : QUALITES[q] ?? null);
export const ficheDe = f => {
  if (!f) return null;
  const [site, dep] = f.split(":");
  return `https://baignades.sante.gouv.fr/baignades/profil.do?idSite=${site}&codeDept=${dep}`;
};

export function candidates(g, liste = PLAGES) {
  return liste.map(dePlage)
    .map(p => ({ ...p, vol: distanceKm(g.lat, g.lon, p.lat, p.lon) }))
    .filter(p => p.vol <= RAYON_KM)
    .sort((a, b) => a.vol - b.vol)
    .slice(0, CANDIDATES_MAX);
}

export async function proches(g, liste = PLAGES, fetcheur = fetch) {
  const cands = candidates(g, liste);
  if (!cands.length) return [];
  try {
    const m = await dureesMinutes(g, cands, fetcheur);
    return cands.map((p, k) => ({ ...p, minutes: m[k], estime: false }))
      .filter(p => p.minutes !== null && p.minutes <= MINUTES_MAX)
      .sort((a, b) => a.minutes - b.minutes);
  } catch {
    return cands.filter(p => p.vol <= KM_PAR_HEURE_ESTIMEE)
      .map(p => ({ ...p, minutes: Math.round((p.vol / KM_PAR_HEURE_ESTIMEE) * 60), estime: true }));
  }
}

export async function prochesGardees(g, fetcheur = fetch) {
  const cle = `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
  try {
    const e = JSON.parse(localStorage.getItem(CACHE) || "{}")[cle];
    if (e && Date.now() - e.t < GARDE && !e.estime) return e.l;
  } catch { /* cache indisponible */ }
  const l = await proches(g, PLAGES, fetcheur);
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "{}");
    c[cle] = { t: Date.now(), l, estime: l.some(p => p.estime) };
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch { /* plein */ }
  return l;
}

/* ---------- Lot 3 : la mer et l'air des plages proches ---------- */

/* Les plages montrées : quatre au plus, les plus proches par la route,
   espacées d'au moins cinq kilomètres. Deux plages voisines partagent la même
   mer ; la feuille n'en répète pas les chiffres. */
export const PLAGES_MAX = 4;
export function choisir(proches, max = PLAGES_MAX) {
  const out = [];
  for (const p of proches) {
    if (out.every(q => distanceKm(p.lat, p.lon, q.lat, q.lon) >= 5)) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

const MARIN = "https://marine-api.open-meteo.com/v1/marine";
const PREVISION = "https://api.open-meteo.com/v1/forecast";
const coords = plages => ({ latitude: plages.map(p => p.lat.toFixed(4)).join(","), longitude: plages.map(p => p.lon.toFixed(4)).join(",") });

export function adresseMer(plages) {
  const q = new URLSearchParams({ ...coords(plages), timezone: "Europe/Paris", forecast_days: "2",
    hourly: "wave_height,wave_period,wave_direction,sea_surface_temperature,sea_level_height_msl" });
  return `${MARIN}?${q}`;
}
export function adresseAir(plages) {
  const q = new URLSearchParams({ ...coords(plages), timezone: "Europe/Paris", forecast_days: "2",
    hourly: "temperature_2m,wind_speed_10m,wind_direction_10m,precipitation",
    daily: "temperature_2m_max,uv_index_max,sunrise,sunset" });
  return `${PREVISION}?${q}`;
}

/* Les pleines et basses mers des prochaines 24 heures, tirées de la hauteur
   de la mer heure par heure. L'extrême tombe rarement pile sur l'heure : une
   parabole ajustée sur les trois valeurs qui l'entourent le situe entre deux
   heures, et donne sa hauteur. */
export function marees(time, niveau, depuis) {
  const k0 = Math.max(1, time.findIndex(t => t >= depuis));
  const out = [];
  for (let k = k0; k < Math.min(niveau.length - 1, k0 + 25); k++) {
    const [a, b, c] = [niveau[k - 1], niveau[k], niveau[k + 1]];
    if (![a, b, c].every(Number.isFinite)) continue;
    const haute = b > a && b >= c, basse = b < a && b <= c;
    if (!haute && !basse) continue;
    const courbe = a - 2 * b + c;
    const dx = courbe ? (a - c) / (2 * courbe) : 0;
    const h = b - ((a - c) * dx) / 4;
    const t = new Date(`${time[k]}:00`);
    t.setMinutes(t.getMinutes() + Math.round(dx * 60));
    out.push({ heure: `${String(t.getHours()).padStart(2, "0")} h ${String(t.getMinutes()).padStart(2, "0")}`,
      type: haute ? "haute" : "basse", hauteur: Math.round(h * 10) / 10 });
  }
  return out;
}

export function resumeMer(x, heure) {
  const h = x?.hourly;
  if (!h?.time) return null;
  let k = h.time.indexOf(heure);
  if (k < 0) k = Math.max(0, h.time.filter(t => t <= heure).length - 1);
  const r1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
  return { eau: r1(h.sea_surface_temperature[k]), vagues: r1(h.wave_height[k]),
    periode: Number.isFinite(h.wave_period[k]) ? Math.round(h.wave_period[k]) : null,
    marees: marees(h.time, h.sea_level_height_msl, heure) };
}

export function resumeAir(x, heure) {
  const h = x?.hourly, j = x?.daily;
  if (!h?.time || !j?.time) return null;
  let k = h.time.indexOf(heure);
  if (k < 0) k = Math.max(0, h.time.filter(t => t <= heure).length - 1);
  const kj = Math.max(0, j.time.indexOf(heure.slice(0, 10)));
  return { air: Math.round(h.temperature_2m[k]), max: Math.round(j.temperature_2m_max[kj]),
    vent: Math.round(h.wind_speed_10m[k]), direction: h.wind_direction_10m[k], uv: Math.round(j.uv_index_max[kj] ?? 0) };
}

/* La direction d'où vient le vent, au niveau de la plage, demandée par Jérôme
   le 30 septembre 2026 : sans rapport à l'orientation du rivage, que la source
   ne donne pas. */
export function ventDe(d) {
  if (!Number.isFinite(d)) return "";
  const c = cardinal(d);
  return /^(est|ouest)$/.test(c) ? `de l'${c}` : `du ${c}`;
}

/* Les bons créneaux de baignade, jalon 15, lot 4. Heure par heure, de 9 h à
   19 h et entre une heure après le lever et une heure avant le coucher : air à
   20° au moins, eau à 16° au moins, vagues d'un mètre et demi au plus, vent de
   25 km/h au plus, pas de pluie. Un créneau est une suite d'au moins deux
   heures favorables ; le plus long d'aujourd'hui, à partir de l'heure en
   cours, sinon celui de demain. Sans créneau, le motif le plus fréquent parmi
   les heures écartées. */
export const SEUILS_BAIN = { air: 20, eau: 16, vagues: 1.5, vent: 25, pluie: 0.2 };

export function creneauBaignade(air, mer, heure) {
  const ha = air?.hourly, hm = mer?.hourly, j = air?.daily;
  if (!ha?.time || !hm?.time || !j?.time) return null;
  const S = SEUILS_BAIN;
  const motifs = { air: [], eau: [], vagues: [], vent: [], pluie: [] };
  const demain = new Date(`${heure.slice(0, 10)}T12:00`); demain.setDate(demain.getDate() + 1);
  const jours = [heure.slice(0, 10), demain.toLocaleDateString("sv-SE")];
  for (const [n, jour] of jours.entries()) {
    const kj = j.time.indexOf(jour);
    if (kj < 0) continue;
    const lever = Number((j.sunrise[kj] || "T07").slice(11, 13)) + 1;
    const coucher = Number((j.sunset[kj] || "T20").slice(11, 13)) - 1;
    let courant = [], meilleur = [];
    for (let h = Math.max(9, lever); h < Math.min(19, coucher); h++) {
      const t = `${jour}T${String(h).padStart(2, "0")}:00`;
      if (n === 0 && t < `${heure.slice(0, 13)}:00`) continue;
      const ka = ha.time.indexOf(t), km = hm.time.indexOf(t);
      if (ka < 0 || km < 0) continue;
      const v = { air: ha.temperature_2m[ka], eau: hm.sea_surface_temperature[km], vagues: hm.wave_height[km],
        vent: ha.wind_speed_10m[ka], pluie: ha.precipitation[ka] };
      const ecarts = [];
      if (!(v.air >= S.air)) ecarts.push(["air", v.air]);
      if (Number.isFinite(v.eau) && v.eau < S.eau) ecarts.push(["eau", v.eau]);
      if (Number.isFinite(v.vagues) && v.vagues > S.vagues) ecarts.push(["vagues", v.vagues]);
      if (v.vent > S.vent) ecarts.push(["vent", v.vent]);
      if (v.pluie >= S.pluie) ecarts.push(["pluie", v.pluie]);
      if (!ecarts.length) { courant.push(h); if (courant.length > meilleur.length) meilleur = [...courant]; }
      else { courant = []; for (const [m, x] of ecarts) motifs[m].push(x); }
    }
    if (meilleur.length >= 2) return { jour: n ? "demain" : "aujourd'hui", de: meilleur[0], a: meilleur[meilleur.length - 1] + 1 };
  }
  const [m, valeurs] = Object.entries(motifs).sort((a, b) => b[1].length - a[1].length)[0];
  if (!valeurs.length) return { motif: "trop peu d'heures de jour" };
  const r1 = x => String(Math.round(x * 10) / 10).replace(".", ",");
  const texte = { air: `air à ${Math.round(Math.max(...valeurs))}° au plus`, eau: `eau à ${r1(Math.max(...valeurs))}°`,
    vagues: `vagues de ${r1(Math.min(...valeurs))} m`, vent: `vent de ${Math.round(Math.min(...valeurs))} km/h`, pluie: "pluie" }[m];
  return { motif: texte };
}

export function phraseCreneau(c) {
  if (!c) return "";
  if (c.de !== undefined) return `Baignade conseillée ${c.jour === "demain" ? "demain " : ""}de ${c.de} h à ${c.a} h.`;
  return `Pas de bon créneau de baignade aujourd'hui ni demain : ${c.motif}.`;
}

/* La commune d'une plage montrée, cherchée au moment de la montrer : la liste
   embarquée ne l'a presque jamais, le service d'adresses s'étant tu pendant sa
   construction. Le contour des communes d'abord ; un point en mer n'est dans
   aucun, et l'adresse la plus proche prend le relais. */
export async function communeDe(p, fetcheur = fetch) {
  if (p.commune || p.pays !== "FR") return p.commune;
  try {
    const r = await fetcheur(`https://geo.api.gouv.fr/communes?lat=${p.lat}&lon=${p.lon}&fields=nom`);
    const l = r.ok ? await r.json() : [];
    if (l[0]?.nom) return l[0].nom;
    const a = await fetcheur(`https://api-adresse.data.gouv.fr/reverse/?lat=${p.lat}&lon=${p.lon}&limit=1`);
    const d = a.ok ? await a.json() : null;
    return d?.features?.[0]?.properties?.city || null;
  } catch { return null; }
}

const fr = v => String(v).replace(".", ",");

/* La phrase de la porte : la plage la plus proche, l'eau et les vagues. */
export function phrasePlage(resumes) {
  const p = resumes[0];
  if (!p?.mer) return "";
  const eau = p.mer.eau !== null ? `eau à ${fr(p.mer.eau)}°` : null;
  const vagues = p.mer.vagues !== null ? (p.mer.vagues < 0.3 ? "mer calme" : `vagues de ${fr(p.mer.vagues)} m`) : null;
  return `${p.nom}, ${[eau, vagues].filter(Boolean).join(", ")}.`;
}

/* La saison de la porte, décidée le 30 septembre 2026 : de juin à septembre,
   et au-delà tant que l'eau de la plage la plus proche dépasse 20°. */
export function enSaisonPlage(date, resumes = []) {
  const m = Number(date.slice(5, 7));
  if (m >= 6 && m <= 9) return true;
  return (resumes[0]?.mer?.eau ?? 0) >= 20;
}

/* L'état de la plage pour la commune affichée. */
let etat = null;
const cleDeLieu = g => `${g.lat.toFixed(3)},${g.lon.toFixed(3)}`;
export const etatPlage = g => (etat && Number.isFinite(g?.lat) && etat.cle === cleDeLieu(g) ? etat : null);
export const poserPlage = e => { etat = e; };

export async function chargerPlage(g, heure, fetcheur = fetch) {
  if (!Number.isFinite(g?.lat)) return null;
  const cle = cleDeLieu(g);
  const proches = await prochesGardees(g, fetcheur);
  let resumes = [];
  if (proches.length) {
    const vues = choisir(proches);
    try {
      const [rm, ra] = await Promise.all([fetcheur(adresseMer(vues)), fetcheur(adresseAir(vues))]);
      const mer = rm.ok ? await rm.json() : [], air = ra.ok ? await ra.json() : [];
      const tm = Array.isArray(mer) ? mer : [mer], ta = Array.isArray(air) ? air : [air];
      const communes = await Promise.all(vues.map(p => communeDe(p, fetcheur)));
      resumes = vues.map((p, i) => ({ ...p, commune: communes[i], mer: resumeMer(tm[i], heure), air: resumeAir(ta[i], heure),
        creneau: creneauBaignade(ta[i], tm[i], heure) }))
        .filter(p => p.mer);
    } catch { resumes = etat?.cle === cle ? etat.resumes : []; }
  }
  etat = { cle, proches, resumes, heure };
  return etat;
}
