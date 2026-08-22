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
