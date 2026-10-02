/* Le temps d'un point touché sur la carte, jalon 19, lot 4, demande de
   Jérôme du 2 octobre 2026 : « toute info complémentaire au clic sur un
   point ». Trois lectures partent ensemble, chacune bornée :
   - le temps qu'il fait au point, Open-Meteo, au centième de degré ;
   - le nom de la commune, par le service d'adresses, au millième ;
   - la restriction d'eau en vigueur au point, VigiEau, au centième.
   Une lecture qui manque laisse sa ligne vide sans empêcher les autres. */

import { chercher, chercherEn } from "./horloge.js";
import { envoi, communeDe } from "./reglages.js";
import { restrictionsDe } from "./eau.js";

const PREVISION = "https://api.open-meteo.com/v1/forecast";
const VIGIEAU = "https://api.vigieau.gouv.fr/api/zones";

export function adressePoint(lat, lon) {
  const q = new URLSearchParams({ latitude: String(envoi(lat)), longitude: String(envoi(lon)),
    current: "temperature_2m,weather_code,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day",
    timezone: "Europe/Paris" });
  return `${PREVISION}?${q}`;
}

async function tempsDu(lat, lon, fetcheur) {
  const r = await fetcheur(adressePoint(lat, lon));
  if (!r.ok) return null;
  const d = await r.json();
  const c = (Array.isArray(d) ? d[0] : d)?.current;
  if (!c) return null;
  const n = v => (Number.isFinite(v) ? v : null);
  return { t: n(c.temperature_2m), code: n(c.weather_code), jour: c.is_day !== 0, pluie: n(c.precipitation),
    vent: n(c.wind_speed_10m), rafales: n(c.wind_gusts_10m), dir: n(c.wind_direction_10m) };
}

async function eauDu(lat, lon, fetcheur) {
  const r = await fetcheur(`${VIGIEAU}?lon=${envoi(lon)}&lat=${envoi(lat)}&profil=particulier`);
  if (!r.ok) return null;
  return restrictionsDe(await r.json());
}

export async function lirePoint(lat, lon, fetcheur = chercher) {
  const [temps, lieu, eau] = await Promise.all([
    tempsDu(lat, lon, fetcheur).catch(() => null),
    communeDe(lat, lon).catch(() => null),
    eauDu(lat, lon, fetcheur === chercher ? chercherEn(8000) : fetcheur).catch(() => null),
  ]);
  return { temps, lieu, eau };
}
