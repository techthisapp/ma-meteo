/* Les prévisions sur la carte, jalon 18, lot 3, décidé par Jérôme le 30
   septembre 2026 : trente-six villes réparties sur le pays, les plus
   importantes d'abord, avec l'icône du temps et une température pour le matin,
   l'après-midi, le soir ou le lendemain. Une seule requête pour toutes les
   villes, gardée une heure. */

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

export function adresseVilles() {
  const q = new URLSearchParams({ latitude: VILLES.map(v => v[1]).join(","), longitude: VILLES.map(v => v[2]).join(","),
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

let lu = null;
export async function lireVilles(fetcheur = fetch) {
  if (lu && Date.now() - lu.t < GARDE) return lu.l;
  const r = await fetcheur(adresseVilles());
  if (!r.ok) throw new Error(`villes ${r.status}`);
  const d = await r.json();
  const l = Array.isArray(d) ? d : [d];
  lu = { t: Date.now(), l };
  return l;
}
