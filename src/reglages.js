/* Réglages, en stockage local. Commune courante, communes suivies, écriture
   retenue pour l'écran du temps. Ni compte, ni base, ni service dorsal. */

const CLE = "mameteo.reglages.v1";

// Au delà, la liste ne se lit plus d'un coup d'œil et la requête d'aperçu enfle.
export const MAX_SUIVIES = 10;

const DEFAUT = {
  commune: null,
  codePostal: null,
  lat: null,
  lon: null,
  ecriture: "ruban",   // ruban, liste ou moments
  poste: null,         // numéro du poste de mesure retenu
  suivies: [],         // communes suivies, la courante comprise
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
if (!etat.suivies.length && etat.lat !== null) etat.suivies = [nu(etat)];

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
export const cleCourante = () => cleLieu(etat);
export const estSuivie = l => etat.suivies.some(x => cleLieu(x) === cleLieu(l));

/* Poser une commune la rend courante et l'ajoute à la liste si elle en manque.
   Choisir une commune vaut donc suivi : personne ne cherche une commune pour
   ne pas la garder, et rien n'oblige à la garder ensuite. */
export function poserLieu(l) {
  const c = cleLieu(l);
  if (!c) return lire();
  const reste = etat.suivies.filter(x => cleLieu(x) !== c);
  const liste = [nu(l), ...reste].slice(0, MAX_SUIVIES);
  etat = { ...etat, ...nu(l), poste: null, suivies: liste };
  ecrire();
  return lire();
}

/* Retirer une commune. Si c'était la courante, la première de la liste prend sa
   place ; si la liste se vide, l'application revient à son état sans commune. */
export function retirerSuivie(cle) {
  const liste = etat.suivies.filter(x => cleLieu(x) !== cle);
  if (liste.length === etat.suivies.length) return { lire: lire(), change: false };
  const etaitCourante = cleLieu(etat) === cle;
  etat = { ...etat, suivies: liste };
  if (etaitCourante) {
    const suivante = liste[0] || { commune: null, codePostal: null, lat: null, lon: null };
    etat = { ...etat, ...nu(suivante), poste: null };
  }
  ecrire();
  return { lire: lire(), change: etaitCourante };
}

export const ECRITURES = [["ruban", "Ruban"], ["liste", "Liste"], ["moments", "Moments"]];

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
