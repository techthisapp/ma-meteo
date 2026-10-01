/* Horloge et écriture des nombres.

   La clé du jour se compose ici et nulle part ailleurs. Dans « Mon jardin », le
   quotidien la lisait en temps universel quand l'horaire la lisait en heure
   locale : entre minuit et deux heures l'été, les deux séries ne désignaient pas
   le même jour, et toute la journée reculait d'un cran. Une seule fonction, un
   seul fuseau. */

const deux = n => String(n).padStart(2, "0");

// Clé d'un jour, en heure locale.
export const cleJour = d => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

// Clé de l'heure en cours, telle qu'elle paraît dans la série horaire.
export const cleHeure = (d = new Date()) => `${cleJour(d)}T${deux(d.getHours())}:00`;

/* L'heure de la charge en mémoire. Le cache autorisait une relecture toutes les
   heures, rien ne la déclenchait : cette clé est ce que le retour au premier
   plan compare. */
export const heureCle = () => cleHeure().slice(0, 13);

// Les nombres s'écrivent avec la virgule, et sans décimale au delà de dix.
export const nombreFr = v =>
  Math.abs(v) >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(".", ",");

// Une durée en secondes, écrite en heures et minutes.
export const hhmm = s => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return `${h} h ${deux(m)}`;
};

export const jourCourt = t =>
  new Date(`${t}T12:00`).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

export const jourLong = t =>
  new Date(`${t}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export const heureTxt = h => `${deux(h)} h`;

/* Les caches indexés par lieu gardaient chaque position visitée, sans limite :
   un historique de déplacements sur l'appareil, et un stockage qui finissait
   plein. Une entrée périmée est retirée, et seules les vingt plus récentes
   restent. Audit du 1er octobre 2026, constat 2.3. */
export const ENTREES_MAX = 20;
export function elaguer(c, garde, maintenant = Date.now()) {
  const gardees = Object.entries(c).filter(([, e]) => Number.isFinite(e?.t) && maintenant - e.t < garde)
    .sort((a, b) => b[1].t - a[1].t).slice(0, ENTREES_MAX);
  for (const k of Object.keys(c)) delete c[k];
  for (const [k, e] of gardees) c[k] = e;
  return c;
}

/* Les heures d'Open-Meteo, recalées sur l'heure de Paris. Le service écrit
   toute une réponse avec un seul décalage, celui du moment de la requête, et
   vingt-quatre heures par jour : vérifié le 1er octobre 2026 sur l'archive
   autour du 26 octobre 2025 et sur la prévision de Sydney autour du 4 octobre
   2026. Une prévision lue avant le passage à l'heure d'hiver écrivait donc les
   heures suivantes en heure d'été, et l'écran les montrait en retard d'une
   heure. Chaque heure est convertie en instant par le décalage annoncé, puis
   récrite à l'heure de Paris. Le jour de l'heure d'hiver, la seconde heure de
   deux heures du matin est retirée de toutes les colonnes ; le jour de l'heure
   d'été, deux heures du matin manque, comme à l'horloge. */
const PARIS = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const aParis = ms => PARIS.format(ms).replace(" ", "T");

export const enHeureDeParis = (t, decalage) => {
  const [a, m, j, h, mn] = t.split(/[-T:]/).map(Number);
  return aParis(Date.UTC(a, m - 1, j, h || 0, mn || 0) - decalage * 1000);
};

function recalerSerie(b, decalage) {
  const n = b.time.length;
  if (!n) return;
  const temps = b.time.map(t => enHeureDeParis(t, decalage));
  if (temps.every((t, i) => t === b.time[i])) return;
  const vus = new Set(), garder = [];
  temps.forEach((t, i) => { if (!vus.has(t)) { vus.add(t); garder.push(i); } });
  for (const [c, v] of Object.entries(b)) {
    if (Array.isArray(v) && v.length === n) b[c] = garder.map(i => (c === "time" ? temps[i] : v[i]));
  }
}

export function recaler(d) {
  if (Array.isArray(d)) return d.map(recaler);
  const decalage = d?.utc_offset_seconds;
  if (!Number.isFinite(decalage)) return d;
  for (const nom of ["hourly", "minutely_15"]) if (Array.isArray(d[nom]?.time)) recalerSerie(d[nom], decalage);
  for (const c of ["sunrise", "sunset"]) {
    if (Array.isArray(d.daily?.[c])) d.daily[c] = d.daily[c].map(t => (typeof t === "string" && t.includes("T") ? enHeureDeParis(t, decalage) : t));
  }
  if (typeof d.current?.time === "string") d.current.time = enHeureDeParis(d.current.time, decalage);
  return d;
}

/* Les heures qui existent à Paris un jour donné : vingt-trois le jour de
   l'heure d'été, deux heures du matin manquant. */
export function heuresDeParis(date) {
  const [a, m, j] = date.split("-").map(Number);
  const out = new Set();
  for (let k = -3; k < 27; k++) {
    const t = aParis(Date.UTC(a, m - 1, j, k));
    if (t.startsWith(date)) out.add(Number(t.slice(11, 13)));
  }
  return out;
}

/* Un instant, dit comme on le dirait : « 14 h » quand l'heure est ronde,
   « 14:30 » sinon, et le jour devant quand ce n'est pas aujourd'hui. Sans le
   jour, « jusqu'à 06 h » se lirait comme dans une heure. */
export const heureJour = d => {
  const h = d.getMinutes() ? `${deux(d.getHours())}:${deux(d.getMinutes())}`
    : `${deux(d.getHours())} h`;
  const n = new Date();
  const jours = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate())
    - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  if (jours === 0) return h;
  if (jours === 1) return `demain ${h}`;
  if (jours === -1) return `hier ${h}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "long" })} ${h}`;
};

/* Département d'un code postal. Outre-mer sur trois chiffres. La Corse a deux
   départements, 2A et 2B, que le code postal ne distingue pas : les codes 200 à
   201 sont en Corse-du-Sud, les codes 202 à 206 en Haute-Corse. « Mon jardin »
   rendait « 20 » pour les deux, et la vigilance n'y arrivait jamais. */
export const departementDe = cp => {
  const v = String(cp || "").trim();
  if (v.length < 2) return null;
  if (v.startsWith("97") || v.startsWith("98")) return v.slice(0, 3);
  if (v.startsWith("20")) {
    const n = Number(v.slice(0, 5));
    if (!Number.isFinite(n)) return null;
    return n < 20200 ? "2A" : "2B";
  }
  return v.slice(0, 2);
};

export const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Énumération française : a, b et c.
export const enumerer = l => {
  const t = l.filter(Boolean);
  if (!t.length) return "";
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(", ")} et ${t[t.length - 1]}`;
};
