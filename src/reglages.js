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
  sorties: null,       // heures de sortie, deux fenêtres au pas de la demi-heure
  jetonsPris: [],      // jetons de parapluie déjà pris, par date et fenêtre
};

let etat = { ...DEFAUT };

try {
  const brut = JSON.parse(localStorage.getItem(CLE) || "null");
  if (brut && typeof brut === "object") etat = { ...DEFAUT, ...brut };
} catch { /* stockage indisponible, les valeurs par défaut suffisent */ }

/* Deux fenêtres de sortie, chacune une paire d'heures croissantes dans la
   journée, au pas de la demi-heure. Une forme abîmée retombe sur la valeur par
   défaut plutôt que de faire paraître un jeton à une heure absurde. */
const estDemie = h => Number.isFinite(h) && h * 2 === Math.round(h * 2);
function estSorties(v) {
  return Array.isArray(v) && v.length === 2 && v.every(f =>
    Array.isArray(f) && f.length === 2 && estDemie(f[0]) && estDemie(f[1])
    && f[0] >= 0 && f[0] < f[1] && f[1] <= 24);
}

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

/* Les heures de sortie et les jetons pris viennent avec le rappel de parapluie :
   un réglage écrit avant lui ne les porte pas. */
if (!Array.isArray(etat.jetonsPris)) etat.jetonsPris = [];
if (!estSorties(etat.sorties)) etat.sorties = null;

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
/* Nouvel ordre des lieux suivis, donné par la suite de leurs clés. Les clés
   inconnues sont ignorées et les lieux oubliés sont replacés à la fin : un
   ordre partiel ne doit pas faire disparaître un lieu. */
export function reordonnerSuivies(cles) {
  const par = new Map(etat.suivies.map(l => [cleLieu(l), l]));
  const out = [];
  for (const c of cles || []) {
    const l = par.get(c);
    if (l && !out.includes(l)) out.push(l);
  }
  for (const l of etat.suivies) if (!out.includes(l)) out.push(l);
  if (out.length !== etat.suivies.length) return lire();
  if (out.every((l, k) => l === etat.suivies[k])) return lire();
  etat = { ...etat, suivies: out };
  ecrire();
  return lire();
}

/* Déplace un lieu d'un rang, pour le clavier : le glissement long ne se fait
   qu'au doigt, et un lieu doit pouvoir changer de place sans lui. */
export function deplacerSuivie(cle, pas) {
  const i = etat.suivies.findIndex(l => cleLieu(l) === cle);
  const j = i + pas;
  if (i < 0 || j < 0 || j >= etat.suivies.length) return { lire: lire(), change: false };
  const out = [...etat.suivies];
  [out[i], out[j]] = [out[j], out[i]];
  etat = { ...etat, suivies: out };
  ecrire();
  return { lire: lire(), change: true };
}

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

/* Les heures de sortie. `null` rend la valeur par défaut du module du parapluie,
   qui la porte avec les seuils : les nombres du rappel vivent au même endroit. */
export const sorties = defaut => (estSorties(etat.sorties) ? etat.sorties : defaut);
export function poserSorties(v) {
  if (!estSorties(v)) return;
  poser({ sorties: v.map(f => [f[0], f[1]]) });
}

/* Les jetons pris. La liste s'oublie d'elle-même : un jeton porte sa date, et
   ceux d'avant-hier ne peuvent plus reparaître. Sans cet oubli la liste
   grandirait d'une entrée par journée pluvieuse, pour toujours. */
const JETONS_GARDES = 3;
export const jetonPris = cle => etat.jetonsPris.includes(cle);
export function prendreJeton(cle) {
  if (!cle || etat.jetonsPris.includes(cle)) return;
  const limite = new Date();
  limite.setDate(limite.getDate() - JETONS_GARDES);
  const seuil = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, "0")}`
    + `-${String(limite.getDate()).padStart(2, "0")}`;
  const gardes = etat.jetonsPris.filter(x => String(x).slice(0, 10) >= seuil);
  poser({ jetonsPris: [...gardes, cle] });
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
/* Nom de la commune à des coordonnées. La recherche par commune ne rend rien
   quand le point tombe hors d'un territoire communal, au large ou en limite de
   côte : une adresse ordinaire est alors demandée, et sa commune sert. Sans ce
   repli, une position en bord de mer restait anonyme. */
export async function communeDe(lat, lon) {
  const base = `https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}`;
  for (const u of [`${base}&type=municipality`, base]) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const d = await r.json();
      const f = (d.features || [])[0];
      const nom = f && (f.properties.city || f.properties.municipality
        || (f.properties.type === "municipality" ? f.properties.name : null));
      if (!nom) continue;
      return {
        commune: nom,
        codePostal: f.properties.postcode ?? null,
        lat: Math.round(lat * 10000) / 10000,
        lon: Math.round(lon * 10000) / 10000,
      };
    } catch { /* réseau muet : le repli suivant, sinon rien */ }
  }
  return null;
}

/* Nomme la position courante sans la relever à nouveau. Le relevé peut avoir
   abouti alors que l'interface adresse était muette : la prévision est juste,
   mais rien ne dit sur quelle commune. L'horodatage ne bouge pas, un nom n'est
   pas un nouveau relevé. */
export function nommerPosition(l) {
  if (!etat.auto || !etat.position || !l || !l.commune) return lire();
  if (ecart(etat.position, l) > 2000) return lire();
  const pos = { ...etat.position, commune: l.commune, codePostal: l.codePostal ?? null };
  etat = { ...etat, position: pos, commune: pos.commune, codePostal: pos.codePostal };
  ecrire();
  return lire();
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
