/* Réglages, en stockage local. Commune, coordonnées, écriture retenue pour la
   feuille du temps. Ni compte, ni base, ni service dorsal. */

const CLE = "mameteo.reglages.v1";

const DEFAUT = {
  commune: null,
  codePostal: null,
  lat: null,
  lon: null,
  ecriture: "ruban",   // ruban, liste ou moments
  poste: null,         // numéro du poste de mesure retenu
};

let etat = { ...DEFAUT };

try {
  const brut = JSON.parse(localStorage.getItem(CLE) || "null");
  if (brut && typeof brut === "object") etat = { ...DEFAUT, ...brut };
} catch { /* stockage indisponible, les valeurs par défaut suffisent */ }

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
