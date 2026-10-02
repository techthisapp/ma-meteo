/* Les prévisions sur la carte, jalon 18, lot 3, décidé par Jérôme le 30
   septembre 2026 : des villes réparties sur la carte, les plus importantes
   d'abord, avec l'icône du temps et une température pour le matin,
   l'après-midi, le soir ou le lendemain.

   Depuis la version 143, jalon 19, lot 3, demande de Jérôme : les villes se
   choisissent dans la vue, parmi les communes du fond embarqué, d'autant plus
   nombreuses et petites que le zoom est fort. Chaque prévision lue se garde
   une heure par ville : revenir sur une vue déjà vue ne redemande rien, et une
   vue nouvelle ne demande que les villes qui manquent, cinquante au plus par
   requête. Les trente-six villes de départ servent tant que le fond n'est pas
   lu. */

import { recaler, chercher } from "./horloge.js";

export const VILLES = [
  ["Paris", 48.857, 2.352], ["Lyon", 45.764, 4.836], ["Marseille", 43.296, 5.37], ["Toulouse", 43.605, 1.444],
  ["Bordeaux", 44.838, -0.579], ["Lille", 50.629, 3.057], ["Nantes", 47.218, -1.554], ["Strasbourg", 48.573, 7.752],
  ["Rennes", 48.117, -1.678], ["Nice", 43.71, 7.262], ["Montpellier", 43.611, 3.877], ["Brest", 48.39, -4.486],
  ["Dijon", 47.322, 5.041], ["Clermont-Ferrand", 45.778, 3.087], ["Limoges", 45.834, 1.262], ["Ajaccio", 41.919, 8.739],
  ["Reims", 49.258, 4.032], ["Rouen", 49.443, 1.099], ["Tours", 47.394, 0.685], ["Grenoble", 45.188, 5.724],
  ["Perpignan", 42.699, 2.895], ["Caen", 49.183, -0.371], ["Metz", 49.119, 6.176], ["Besançon", 47.238, 6.024],
  ["Poitiers", 46.58, 0.34], ["Biarritz", 43.483, -1.559], ["Orléans", 47.903, 1.909], ["Amiens", 49.894, 2.296],
  ["La Rochelle", 46.16, -1.151], ["Bourges", 47.081, 2.399], ["Pau", 43.296, -0.37], ["Le Mans", 48.006, 0.199],
  ["Bastia", 42.697, 9.451], ["Annecy", 45.899, 6.129], ["Troyes", 48.297, 4.074], ["Brive-la-Gaillarde", 45.159, 1.533],
];

export const MOMENTS = [["matin", "Matin"], ["apres", "Après-midi"], ["soir", "Soir"], ["demain", "Demain"]];
const PREVISION = "https://api.open-meteo.com/v1/forecast";
const GARDE = 3600 * 1000;

export function adresseVilles(liste = VILLES) {
  const q = new URLSearchParams({ latitude: liste.map(v => v[1]).join(","), longitude: liste.map(v => v[2]).join(","),
    hourly: "weather_code,temperature_2m,is_day", forecast_days: "2", timezone: "Europe/Paris" });
  return `${PREVISION}?${q}`;
}

/* Le moment ouvert par défaut : le matin avant midi, l'après-midi avant 18 h,
   le soir avant 23 h, le lendemain ensuite. */
export const momentDe = heure => (heure < 12 ? "matin" : heure < 18 ? "apres" : heure < 23 ? "soir" : "demain");

/* Le temps d'une ville pour un moment : le code le plus marqué de la fenêtre,
   le jour ou la nuit à son heure repère, et sa température. Le matin donne
   9 h, l'après-midi le maximum de midi à 18 h, le soir 21 h, le lendemain le
   minimum et le maximum. */
export function tempsMoment(x, moment, aujourdhui) {
  const h = x?.hourly;
  if (!h?.time) return null;
  const d = new Date(`${aujourdhui}T12:00`); d.setDate(d.getDate() + 1);
  const demain = d.toLocaleDateString("sv-SE");
  const [jour, de, a, repere] = { matin: [aujourdhui, 6, 12, 9], apres: [aujourdhui, 12, 18, 15],
    soir: [aujourdhui, 18, 24, 21], demain: [demain, 0, 24, 12] }[moment];
  const ks = h.time.map((t, k) => [t, k]).filter(([t]) => t.startsWith(jour) && +t.slice(11, 13) >= de && +t.slice(11, 13) < a).map(([, k]) => k);
  if (!ks.length) return null;
  const codes = ks.map(k => h.weather_code[k]).filter(Number.isFinite);
  const temps = ks.map(k => h.temperature_2m[k]).filter(Number.isFinite);
  const kr = ks.find(k => +h.time[k].slice(11, 13) === repere) ?? ks[0];
  const valeur = moment === "apres" ? Math.max(...temps) : h.temperature_2m[kr];
  return { code: codes.length ? Math.max(...codes) : null, jour: h.is_day?.[kr] !== 0,
    t: Number.isFinite(valeur) ? Math.round(valeur) : null,
    min: moment === "demain" ? Math.round(Math.min(...temps)) : null, max: moment === "demain" ? Math.round(Math.max(...temps)) : null };
}

/* La population minimale d'une ville qui porte une prévision, selon le zoom :
   une étiquette prend plus de place qu'un nom. */
export function popMinPrev(z) {
  if (z < 5.6) return 50000;
  if (z < 6.4) return 40000;
  if (z < 7.2) return 15000;
  if (z < 8) return 6000;
  if (z < 9) return 3000;
  return 2000;
}
export const MAX_ETIQUETTES = 30;
const ETIQUETTE = { w: 66, h: 36 };

/* Le choix des villes d'une vue : les plus peuplées d'abord, dans le cadre,
   chacune à distance des autres et des places déjà prises. `ecran` donne la
   place d'une ville à l'écran ; `pris` les rectangles occupés. */
export function choisirVilles(villes, ecran, l, h, z, pris = []) {
  const min = popMinPrev(z);
  const pose = [];
  const occupe = pris.map(p => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 }));
  for (const v of villes) {
    if (v.pop < min) break;
    const p = ecran(v);
    if (p.x < ETIQUETTE.w / 2 || p.x > l - ETIQUETTE.w / 2 || p.y < ETIQUETTE.h / 2 || p.y > h - ETIQUETTE.h / 2) continue;
    const b = { x0: p.x - ETIQUETTE.w / 2, x1: p.x + ETIQUETTE.w / 2, y0: p.y - ETIQUETTE.h / 2, y1: p.y + ETIQUETTE.h / 2 };
    if (occupe.some(q => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0)) continue;
    occupe.push(b);
    pose.push(v);
    if (pose.length >= MAX_ETIQUETTES) break;
  }
  return pose;
}

/* La lecture des villes d'une liste, `[nom, lat, lon]`, rendue dans l'ordre de
   la liste. Seules les villes sans prévision gardée partent, par paquets de
   cinquante. */
const garde = new Map();
const cleV = v => `${v[1]},${v[2]}`;
export const PAQUET = 50;
export async function lireVillesDe(liste, fetcheur = chercher) {
  const maintenant = Date.now();
  const manque = liste.filter(v => { const g = garde.get(cleV(v)); return !g || maintenant - g.t >= GARDE; });
  for (let k = 0; k < manque.length; k += PAQUET) {
    const paquet = manque.slice(k, k + PAQUET);
    const r = await fetcheur(adresseVilles(paquet));
    if (!r.ok) throw new Error(`villes ${r.status}`);
    const d = recaler(await r.json());
    const l = Array.isArray(d) ? d : [d];
    paquet.forEach((v, i) => garde.set(cleV(v), { t: Date.now(), x: l[i] }));
  }
  return liste.map(v => garde.get(cleV(v))?.x ?? null);
}
