/* Réglages, en stockage local. Commune courante, communes suivies, écriture
   retenue pour l'écran du temps. Ni compte, ni base, ni service dorsal. */

const CLE = "mameteo.reglages.v1";

// Au delà, la liste ne se lit plus d'un coup d'œil et la requête d'aperçu enfle.
export const MAX_SUIVIES = 10;

// Le lieu courant peut être une commune choisie ou la position de l'appareil.
export const CLE_POSITION = "position";

const DEFAUT = {
  commune: null,
  codePostal: null,
  lat: null,
  lon: null,
  ecriture: "ruban",   // ruban ou liste
  poste: null,         // numéro du poste de mesure retenu
  suivies: [],         // communes suivies, la courante comprise
  auto: false,         // le lieu courant suit la position de l'appareil
  position: null,      // dernier relevé : commune, codePostal, lat, lon, t
};

let etat = { ...DEFAUT };

try {
  const brut = JSON.parse(localStorage.getItem(CLE) || "null");
  if (brut && typeof brut === "object") etat = { ...DEFAUT, ...brut };
} catch { /* stockage indisponible, les valeurs par défaut suffisent */ }

/* Clé d'un lieu : ses coordonnées arrondies au dix-millième, soit une dizaine
   de mètres. Deux entrées de la même commune ne peuvent pas coexister. */
export const cleLieu = l => (l && l.lat !== null && l.lon !== null)
  ? `${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}` : null;

const nu = l => ({
  commune: l.commune, codePostal: l.codePostal ?? null,
  lat: l.lat, lon: l.lon,
});

/* Reprise des réglages écrits avant les communes suivies : la commune courante
   ouvre la liste, sinon l'application paraîtrait avoir tout oublié. */
if (!Array.isArray(etat.suivies)) etat.suivies = [];
// Les moments ont quitté l'écran du temps : un réglage ancien y menait au vide.
if (etat.ecriture !== "ruban" && etat.ecriture !== "liste") etat.ecriture = "ruban";
if (typeof etat.auto !== "boolean") etat.auto = false;
if (etat.auto && !etat.position) etat.auto = false;
/* En mode position, le lieu courant n'est pas une commune choisie : le reprendre
   dans la liste y ferait entrer une commune que personne n'a demandée. */
if (!etat.suivies.length && etat.lat !== null && !etat.auto) etat.suivies = [nu(etat)];

const ecrire = () => {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); }
  catch { /* mode privé ou quota atteint */ }
};

export const lire = () => ({ ...etat });
export const situe = () => etat.lat !== null && etat.lon !== null;

export function poser(champs) {
  etat = { ...etat, ...champs };
  ecrire();
  return lire();
}

/* ---------- Communes suivies ---------- */

export const suivies = () => etat.suivies.map(l => ({ ...l }));
export const cleCourante = () => (etat.auto ? CLE_POSITION : cleLieu(etat));
export const estSuivie = l => etat.suivies.some(x => cleLieu(x) === cleLieu(l));

/* Poser une commune la rend courante et l'ajoute à la liste si elle en manque.
   Choisir une commune vaut donc suivi : personne ne cherche une commune pour
   ne pas la garder, et rien n'oblige à la garder ensuite. */
export function poserLieu(l) {
  const c = cleLieu(l);
  if (!c) return lire();
  const reste = etat.suivies.filter(x => cleLieu(x) !== c);
  const liste = [nu(l), ...reste].slice(0, MAX_SUIVIES);
  etat = { ...etat, ...nu(l), poste: null, suivies: liste, auto: false };
  ecrire();
  return lire();
}

/* ---------- Ma position ----------

   Une entrée de plus dans la liste, épinglée en tête et jamais retirée : elle
   ne nomme pas un lieu mais l'appareil. La choisir relève la position, la
   nomme par l'interface adresse, et la prévision suit. Le dernier relevé est
   gardé pour que la liste s'ouvre sur une température plutôt que sur un vide,
   et pour que l'application reste lisible hors ligne. */

export const enPosition = () => etat.auto === true;
export const position = () => (etat.position ? { ...etat.position } : null);

/* Écart entre deux points, en mètres. Sur quelques kilomètres la projection
   plate suffit : il ne s'agit que de savoir si la prévision doit être relue. */
export function ecart(a, b) {
  if (!a || !b || a.lat === null || b.lat === null) return Infinity;
  const R = 6371000, rad = Math.PI / 180;
  const dx = (b.lon - a.lon) * rad * Math.cos((a.lat + b.lat) / 2 * rad);
  const dy = (b.lat - a.lat) * rad;
  return Math.hypot(dx, dy) * R;
}

export function poserPosition(p) {
  if (!p || p.lat === null || p.lat === undefined) return lire();
  const lat = Math.round(p.lat * 10000) / 10000;
  const lon = Math.round(p.lon * 10000) / 10000;
  /* Sans nom rendu par l'interface adresse, le nom précédent n'est repris que
     si la position n'a pas bougé de plus de deux kilomètres. Au delà, il
     désignerait une autre commune. */
  const proche = ecart(etat.position, { lat, lon }) < 2000;
  const commune = p.commune ?? (proche ? etat.position?.commune ?? null : null);
  const codePostal = p.commune
    ? (p.codePostal ?? null)
    : (proche ? etat.position?.codePostal ?? null : null);
  const pos = { commune, codePostal, lat, lon, t: Date.now() };
  etat = { ...etat, auto: true, position: pos, commune, codePostal, lat, lon, poste: null };
  ecrire();
  return lire();
}

/* Relève la position et la nomme. Un nom qui manque n'empêche rien : la
   prévision se lit sur les coordonnées. */
export async function releverPosition() {
  const { lat, lon } = await geolocaliser();
  const l = await communeDe(lat, lon);
  return poserPosition(l || { lat, lon });
}

/* Une demande de position sans geste de l'utilisateur ferait surgir la demande
   d'autorisation au chargement. Le relevé silencieux ne part donc que si
   l'autorisation est déjà accordée ; sinon le dernier relevé reste servi et la
   rangée de la liste attend un appui. */
export async function positionAutorisee() {
  try {
    if (!navigator.permissions?.query) return false;
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state === "granted";
  } catch { return false; }
}

/* Retirer une commune. Si c'était la courante, la première de la liste prend sa
   place ; si la liste se vide, l'application revient à son état sans commune. */
export function retirerSuivie(cle) {
  const liste = etat.suivies.filter(x => cleLieu(x) !== cle);
  if (liste.length === etat.suivies.length) return { lire: lire(), change: false };
  const etaitCourante = !etat.auto && cleLieu(etat) === cle;
  etat = { ...etat, suivies: liste };
  if (etaitCourante) {
    /* La liste vidée, il reste toujours Ma position : la bascule y va d'elle
       même quand un relevé est connu, plutôt que de rendre l'écran vide. Le
       relevé garde son horodatage, sans quoi il passerait pour frais. */
    if (!liste.length && etat.position) {
      const p = etat.position;
      etat = { ...etat, auto: true, commune: p.commune, codePostal: p.codePostal,
        lat: p.lat, lon: p.lon, poste: null };
      ecrire();
      return { lire: lire(), change: true };
    }
    const suivante = liste[0] || { commune: null, codePostal: null, lat: null, lon: null };
    etat = { ...etat, ...nu(suivante), poste: null };
  }
  ecrire();
  return { lire: lire(), change: etaitCourante };
}

/* Deux écritures pour l'écran du temps, le ruban et la table. Les moments ont
   quitté cet écran : ils résument la journée, ce qui est l'affaire de
   l'accueil, non du détail heure par heure. */
export const ECRITURES = [["ruban", "Ruban"], ["liste", "Liste"]];

export function poserEcriture(e) {
  if (!ECRITURES.some(([c]) => c === e)) return;
  poser({ ecriture: e });
}

/* Recherche de commune par l'interface adresse de data.gouv.fr. Elle répond
   depuis le navigateur, sans clé ni compte, et sert les en-têtes qui autorisent
   la lecture d'origine croisée. */
export async function chercherCommune(q) {
  const t = String(q || "").trim();
  if (t.length < 2) return [];
  const u = "https://api-adresse.data.gouv.fr/search/?type=municipality&limit=8&q="
    + encodeURIComponent(t);
  try {
    const r = await fetch(u);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).map(f => {
      const [lon, lat] = f.geometry.coordinates;
      return {
        commune: f.properties.city || f.properties.name,
        codePostal: f.properties.postcode,
        contexte: f.properties.context,
        lat: Math.round(lat * 10000) / 10000,
        lon: Math.round(lon * 10000) / 10000,
      };
    });
  } catch { return []; }
}

/* Le chemin inverse : des coordonnées vers une commune, pour la géolocalisation.
   « Mon jardin » n'en avait pas besoin, la commune venant du jardin actif. */
export async function communeDe(lat, lon) {
  const u = `https://api-adresse.data.gouv.fr/reverse/?type=municipality&lat=${lat}&lon=${lon}`;
  try {
    const r = await fetch(u);
    if (!r.ok) return null;
    const d = await r.json();
    const f = (d.features || [])[0];
    if (!f) return null;
    return {
      commune: f.properties.city || f.properties.name,
      codePostal: f.properties.postcode,
      lat: Math.round(lat * 10000) / 10000,
      lon: Math.round(lon * 10000) / 10000,
    };
  } catch { return null; }
}

export function geolocaliser() {
  return new Promise((ok, non) => {
    if (!navigator.geolocation) { non(new Error("La géolocalisation n'est pas disponible.")); return; }
    navigator.geolocation.getCurrentPosition(
      p => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      e => non(new Error(e.code === 1
        ? "Position refusée. L'autoriser dans les réglages du navigateur."
        : "Position indisponible.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}
