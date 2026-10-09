/* Les faux services des contrôles et de l'outil de captures : les charges
   d'essai, la date figée, la commune d'essai, les routes qui répondent à la
   place des vraies sources, et le filet qui refuse toute requête vers le
   réseau réel. Sortis de essais/controle.mjs le 2 octobre 2026, pour que
   essais/vue-ecran.mjs serve les mêmes données sans toucher le vrai réseau,
   docs/plan-chantiers-facultatifs.md.

   L'état que les contrôles font varier, profils servis et relevés des appels,
   vit dans un objet rendu par `nouvelEtat`, que chaque contexte reçoit avec
   ses routes. */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const METEO = JSON.parse(fs.readFileSync(path.join(ICI, "meteo.json"), "utf8"));

// Horloge figée au 18 août 2026, 9 h, heure de Paris.
export const FIGE = new Date("2026-08-18T09:00:00+02:00").getTime();

/* La charge d'ensemble, bâtie sur la charge d'essai. Quarante membres écartés
   régulièrement autour de la valeur servie, d'une demi-largeur qui s'ouvre avec
   l'échéance : c'est la forme du vrai, où la dispersion vaut un demi-degré à
   l'heure en cours et plusieurs degrés à sept jours.

   Elle ne porte pas les journées écoulées, la source d'ensemble n'en rendant
   pas : le tracé doit savoir s'arrêter là où elle s'arrête.

   La demi-largeur est écrite ici pour que les contrôles puissent la prédire :
   à l'heure `L` après maintenant, elle vaut `0,5 + L / 20`, plafonnée à six. */
export const MEMBRES = 40;
export const demiLargeur = L => Math.min(6, 0.5 + Math.max(0, L) / 20);
export const ensembleDe = (mult = 1) => {
  const h = METEO.hourly;
  const i0 = h.time.indexOf("2026-08-18T00:00");
  const t0 = new Date(FIGE).getTime();
  const out = { time: h.time.slice(i0) };
  const col = (nom, base, echelle) => {
    out[nom] = out.time.map((t, k) => Math.round(base[i0 + k] * 10) / 10);
    for (let m = 1; m < MEMBRES; m++) {
      /* Les membres s'écartent en éventail, pairs au-dessus, impairs en
         dessous, du centre vers les bords. Le membre le plus extrême porte la
         demi-largeur entière. */
      const f = (m % 2 ? -1 : 1) * Math.ceil(m / 2) / Math.floor(MEMBRES / 2);
      out[`${nom}_member${String(m).padStart(2, "0")}`] = out.time.map((t, k) => {
        const L = (Date.parse(`${t}:00`) - t0) / 3600000;
        const v = base[i0 + k] + f * demiLargeur(L) * mult * echelle;
        return Math.round(Math.max(nom === "precipitation" ? 0 : -60, v) * 10) / 10;
      });
    }
  };
  col("temperature_2m", h.temperature_2m, 1);
  col("precipitation", h.precipitation, 0.2);
  col("wind_speed_10m", h.wind_speed_10m, 2);
  col("wind_gusts_10m", h.wind_gusts_10m, 3);
  return { hourly: out };
};
export const ENSEMBLE = ensembleDe();
/* Les scénarios quotidiens des deux modèles, jalon 13 : quinze jours depuis le
   jour figé, ICON sur ses sept premiers, ECMWF sur tous, dans la forme du
   service, une colonne par membre suffixée par son modèle. */
export const ENSEMBLE_QUOTIDIEN = (() => {
  const time = Array.from({ length: 15 }, (_, k) => new Date(Date.UTC(2026, 7, 18 + k)).toISOString().slice(0, 10));
  const daily = { time };
  const colonnes = (suffixe, n, jours) => {
    for (let m = 0; m <= n; m++) {
      const cle = m ? `temperature_2m_max_member${String(m).padStart(2, "0")}_${suffixe}` : `temperature_2m_max_${suffixe}`;
      /* Une dispersion qui grandit avec l'échéance, comme celle du vrai
         service : fiable jusqu'au quatrième jour, moins sûre ensuite. */
      daily[cle] = time.map((_, k) => (k < jours ? 24 + ((m * 7) % 11) / 10 * (1 + k * 1.1) - k * 0.2 : null));
    }
  };
  colonnes("icon_seamless_eps", 39, 7);
  colonnes("ecmwf_ifs025_ensemble", 50, 15);
  return { daily };
})();
/* La tendance de GFS, jalon 17 : trente-cinq jours, 31 membres, colonnes sans
   suffixe puisqu'un seul modèle est demandé. Un membre sur trois est pluvieux. */
export const ENSEMBLE_TENDANCE = (() => {
  const time = Array.from({ length: 35 }, (_, k) => new Date(Date.UTC(2026, 7, 18 + k)).toISOString().slice(0, 10));
  const daily = { time };
  for (let m = 0; m <= 30; m++) {
    const suf = m ? `_member${String(m).padStart(2, "0")}` : "";
    daily[`temperature_2m_max${suf}`] = time.map((_, k) => 20 + ((m * 5) % 9) / 2 - k * 0.1);
    daily[`temperature_2m_min${suf}`] = time.map((_, k) => 10 + ((m * 5) % 9) / 3 - k * 0.1);
    daily[`precipitation_sum${suf}`] = time.map(() => (m % 3 === 0 ? 2 : 0));
  }
  return { daily };
})();
export const charpenteEnsemble = url => (/models=gfs_seamless/.test(url) ? ENSEMBLE_TENDANCE
  : /[?&]daily=/.test(url) ? ENSEMBLE_QUOTIDIEN : ENSEMBLE);
// Six fois plus large : les scénarios y sont partagés au sens de `ACCORDS`.
export const ENSEMBLE_LARGE = ensembleDe(6);

export const FAIN = {
  commune: "Fain-lès-Moutiers", codePostal: "21500", lat: 47.5, lon: 4.3,
  ecriture: "ruban", poste: null,
};

/* La charge de « Où est le beau temps » : deux journées par point, un élément
   par point, comme la source les rend pour plusieurs couples de coordonnées.

   Elle est bâtie pour séparer le classement de ses deux voisins évidents. Le
   soleil monte vers le nord aujourd'hui et vers le sud demain, la température
   fait exactement l'inverse : un classement trié sur la température seule
   sortirait à l'envers. La rangée la plus au nord reçoit douze millimètres de
   pluie : elle est la plus ensoleillée des deux journées et ne doit pas être en
   tête, faute de quoi le classement suivrait l'ensoleillement seul. */
export const JOUR_S = Math.round(13.5 * 3600);
export const journeesDe = (lat, lon) => {
  const u = Math.max(0, Math.min(1, (lat - 46.6) / 1.8));
  const journee = j => {
    const p = j === 0 ? u : 1 - u;
    // La longitude départage les points d'une même rangée : sans elle, les cinq
    // premiers du classement seraient cinq ex æquo.
    const soleil = 2 + 8 * p + 0.3 * (j === 0 ? lon - 4.3 : 4.3 - lon);
    const mouille = j === 0 ? lat > 48.2 : lat < 46.8;
    return { soleil, tmax: 28 - 6 * p, pluie: mouille ? 12 : 0 };
  };
  const d = [journee(0), journee(1)];
  return { daily: {
    time: ["2026-08-18", "2026-08-19"],
    weather_code: d.map(x => (x.pluie ? 61 : x.soleil > 7 ? 0 : 3)),
    temperature_2m_max: d.map(x => Math.round(x.tmax * 10) / 10),
    precipitation_sum: d.map(x => x.pluie),
    sunshine_duration: d.map(x => Math.round(x.soleil * 3600)),
    daylight_duration: [JOUR_S, JOUR_S],
  } };
};

/* La charge de l'air : quatre-vingt-seize heures à partir de minuit du 18 août,
   la portée que le module demande. Trois profils, un par règle à éprouver.

   L'indice monte l'après-midi, comme l'ozone dans la réalité. Les graminées
   sont en saison sans être au pic, ce qui fait paraître une rangée dans la
   feuille sans rien ajouter aux faits marquants ; les autres pollens sont sous
   leur seuil de saison et ne doivent donc rien écrire du tout. */
export const AIR_PROFILS = {
  base: { aqi: h => (h >= 12 && h <= 17 ? 26 : 14), pollens: {} },
  // Un après-midi dégradé : la ligne des faits marquants, et les heures que
  // l'aération doit refuser.
  degrade: { aqi: h => (h >= 12 && h <= 20 ? 55 : 14), pollens: {} },
  // Un pic d'ambroisie à quinze heures, le reste de la journée en saison.
  ambroisie: { aqi: h => 14, pollens: { ragweed_pollen: h => (h === 15 ? 71 : 6) } },
  // Un matin dégradé et une après-midi propre : l'aération doit attendre.
  matin: { aqi: h => (h >= 9 && h <= 11 ? 55 : 14), pollens: {} },
};

export const airDe = (profil = "base") => {
  const p = AIR_PROFILS[profil] || AIR_PROFILS.base;
  const cols = ["pm2_5", "pm10", "ozone", "nitrogen_dioxide", "alder_pollen",
    "birch_pollen", "grass_pollen", "mugwort_pollen", "olive_pollen", "ragweed_pollen"];
  const fixes = { pm2_5: 5.1, pm10: 8.2, ozone: 57, nitrogen_dioxide: 3.3,
    alder_pollen: 0, birch_pollen: 0, grass_pollen: 12, mugwort_pollen: 0.4,
    olive_pollen: 0, ragweed_pollen: 0.5 };
  const h = { time: [], european_aqi: [] };
  for (const c of cols) h[c] = [];
  for (let j = 18; j < 22; j++) {
    for (let x = 0; x < 24; x++) {
      h.time.push(`2026-08-${j}T${String(x).padStart(2, "0")}:00`);
      h.european_aqi.push(p.aqi(x));
      for (const c of cols) h[c].push(p.pollens[c] ? p.pollens[c](x) : fixes[c]);
    }
  }
  return { hourly: h };
};

export const servirBeauTemps = (u, route) => {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(lats.map((la, k) => journeesDe(la, lons[k]))) });
};

/* ---------- La charge du radar ----------

   L'index du service, tel qu'il le rend : treize images observées au pas de dix
   minutes sur les deux dernières heures, puis les images extrapolées quand il en
   publie. Le champ était vide aux deux relevés du 5 septembre 2026 ; les deux
   cas se servent, le contrôle éprouvant l'un et l'autre.

   Les tuiles servies sont unies, d'une teinte tirée du chemin de l'image : la
   toile lue au pixel dit alors quelle image est montrée, ce qu'une vraie tuile
   de pluie ne permettrait pas. */
export const RADAR_PAS = 600;
export const radarIndex = etat => {
  const t0 = Math.floor(FIGE / 1000 / RADAR_PAS) * RADAR_PAS;
  const past = [];
  for (let k = 12; k >= 0; k--) {
    const t = t0 - k * RADAR_PAS;
    past.push({ time: t, path: `/v2/radar/obs${12 - k}` });
  }
  const nowcast = [];
  for (let k = 1; k <= etat.radarFutur; k++) {
    nowcast.push({ time: t0 + k * RADAR_PAS, path: `/v2/radar/nc${k}` });
  }
  return { version: "2.0", generated: t0, host: "https://tilecache.rainviewer.com",
           radar: { past, nowcast }, satellite: { infrared: [] } };
};

/* Une tuile PNG unie de deux cent cinquante-six points. Les canaux rouge et vert
   portent le rang de l'image, le bleu la distingue d'un fond de carte. */
export const pngUni = (r, g, b, a, n = 64) => {
  const brut = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    const o = y * (n * 4 + 1);
    for (let x = 0; x < n; x++) {
      const p = o + 1 + x * 4;
      brut[p] = r; brut[p + 1] = g; brut[p + 2] = b; brut[p + 3] = a;
    }
  }
  return enPng(brut, n);
};

/* Une tuile d'imagerie infrarouge, opaque comme le service la rend : moitié
   gauche sombre, le ciel dégagé, moitié droite claire, le sommet d'un nuage.
   La mise en transparence doit effacer la première et garder la seconde. */
export const pngDamier = (n = 64) => {
  const brut = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    const o = y * (n * 4 + 1);
    for (let x = 0; x < n; x++) {
      const p = o + 1 + x * 4;
      const v = x < n / 2 ? 30 : 230;
      brut[p] = v; brut[p + 1] = v; brut[p + 2] = v; brut[p + 3] = 255;
    }
  }
  return enPng(brut, n);
};

/* L'enveloppe PNG, partagée par la tuile unie et la tuile à motif. */
export function enPng(brut, n) {
  const bloc = (type, data) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])) >>> 0, 0);
    return Buffer.concat([l, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc("IHDR", ihdr),
    bloc("IDAT", zlib.deflateSync(brut)),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}
/* La tuile de la mesure de déplacement, celle qui contient la commune au zoom
   cinq. Elle porte un fond de la teinte de son rang, comme les autres, et des
   taches qui se déplacent d'une image à l'autre : deux points vers l'est et un
   vers le nord par pas de dix minutes, ce qui fait, sur les trois pas que la
   mesure compare, un déplacement de 243 degrés de provenance à environ
   quarante kilomètres par heure. C'est le cas réel relevé le 8 septembre 2026.

   Sans structure qui se déplace, une tuile unie ne porte aucune forme à suivre
   et la corrélation ne dirait rien. */
export const TACHES = [[40, 60], [150, 90], [90, 180], [200, 200], [60, 120], [180, 40]];
export const DEP_PAS = { dx: 2, dy: -1 };

export const pngMotif = (r, g, b, a, rang, n = 256, fond = 0) => {
  const brut = Buffer.alloc(n * (n * 4 + 1));
  const dx = DEP_PAS.dx * rang, dy = DEP_PAS.dy * rang;
  for (let y = 0; y < n; y++) {
    const o = y * (n * 4 + 1);
    for (let x = 0; x < n; x++) {
      const p = o + 1 + x * 4;
      let tache = false;
      for (const [tx, ty] of TACHES) {
        if (Math.hypot(x - (tx + dx), y - (ty + dy)) < 26) { tache = true; break; }
      }
      /* Le fond est transparent depuis la version 170, comme sur les vraies
         images où le temps sec ne se peint pas : l'approche lit la pluie à
         l'opacité, et un fond opaque mouillerait toute la tuile. Les
         contrôles de la carte qui veulent une pluie couvrant toute la vue
         le demandent par `radarFondPlein`. */
      brut[p] = tache ? 250 : r;
      brut[p + 1] = tache ? 40 : g;
      brut[p + 2] = tache ? 30 : b;
      brut[p + 3] = tache ? a : fond;
    }
  }
  return enPng(brut, n);
};

/* La teinte d'une image : son rang, lisible au pixel sur la toile.

   Les observations sont pâles, entre 200 et 248 de rouge. Ce n'est pas un
   caprice : une averse faible est peinte pâle par le service, et c'est le cas
   qui met les traits en danger, une limite de département gris clair valant
   presque la même clarté. Une nappe sombre ne l'éprouverait pas. */
export const teinteRadar = chemin => {
  const m = /\/(obs|nc)(\d+)$/.exec(chemin || "");
  if (!m) return null;
  const k = Number(m[2]);
  return m[1] === "obs"
    ? { r: 200 + k * 4, g: 202, b: 120, rang: k }
    : { r: 250, g: 60 + k * 10, b: 40, rang: k };
};

/* La foudre d'EUMETSAT : les capacités de la couche disent le dernier pas
   publié, douze minutes avant l'heure figée arrondies au pas de cinq, comme le
   service le fait ; les tuiles sont transparentes, sauf sur demande d'un
   contrôle qui lit la toile au pixel, où le dernier pas est rouge et les
   autres jaunes. Le pas le plus ancien de la fenêtre rend un XML d'exception
   en HTTP 200, comme le service le fait pour un pas qu'il ne sert pas. */
/* Les feux du système européen d'information sur les feux de forêt. Le service
   rend une image vide quand la date manque, sa valeur par défaut étant le
   1er janvier 2020 : la charge le reproduit, sans quoi l'oubli de la date
   passerait inaperçu. */
export const FEUX_JOUR = new Date(FIGE).toISOString().slice(0, 10);
export const NUAGES_PAS = 10 * 60 * 1000;
export const NUAGES_DERNIER = Math.floor((FIGE - 15 * 60 * 1000) / NUAGES_PAS) * NUAGES_PAS;
export const ATMO_MOTS = { 1: "Bon", 2: "Moyen", 3: "Dégradé", 4: "Mauvais",
  5: "Très mauvais", 6: "Extrêmement mauvais" };
export const atmoJour = new Date(FIGE).toISOString().slice(0, 10);
export const FOUDRE_PAS = 5 * 60 * 1000;
export const FOUDRE_DERNIER = Math.floor((FIGE - 12 * 60 * 1000) / FOUDRE_PAS) * FOUDRE_PAS;
export const FOUDRE_XML = FOUDRE_DERNIER - 5 * FOUDRE_PAS;
export const heureService = t => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

/* ---------- La charge de la pluie dans l'heure ----------

   Le produit de Météo-France, tel qu'il le rend : neuf échéances, pas de cinq
   minutes sur la première demi-heure puis de dix, relevé le 6 septembre 2026.
   Les profils font varier ce qu'il y a à dire, l'intensité étant ordinale de
   zéro à quatre et zéro voulant dire « pas de valeur ». */
export const PLUIE_PAS = [5, 10, 15, 20, 25, 30, 40, 50, 60];
export const PLUIE_PROFILS = {
  sec:      { dispo: 1, i: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  debut:    { dispo: 1, i: [1, 1, 1, 2, 3, 3, 1, 1, 1] },
  encours:  { dispo: 1, i: [2, 2, 1, 1, 1, 1, 1, 1, 1] },
  sansfin:  { dispo: 1, i: [2, 2, 3, 3, 3, 2, 2, 2, 2] },
  indispo:  { dispo: 0, i: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  /* Le drapeau à zéro et de la pluie sur toute l'heure : le cas de Pignan,
     relevé le 4 octobre 2026 à 21 h. */
  indispluie: { dispo: 0, i: [2, 2, 2, 2, 2, 2, 2, 2, 3] },
  // Une averse suivie d'échéances muettes : la fin n'est pas connue.
  muet:     { dispo: 1, i: [2, 2, 0, 0, 0, 0, 0, 0, 0] },
  /* Un trou entre le sec et la pluie : la source ne dit rien de ce qui se passe
     entre les deux, et ce qu'il y a derrière le trou ne s'annonce donc pas. */
  secmuet:  { dispo: 1, i: [1, 1, 0, 0, 2, 3, 1, 1, 1] },
  /* Une pluie modérée à 9 h 40, l'heure où la tache d'essai la plus proche,
     poussée de son déplacement, atteint la commune : les deux méthodes
     s'accordent. */
  accord:   { dispo: 1, i: [1, 1, 1, 1, 1, 1, 3, 3, 1] },
};
/* Le repli, servi par Open-Meteo là où le radar de Météo-France ne couvre pas.
   Les valeurs sont des lames d'eau en millimètres par quart d'heure. */
export const REPLI_PROFILS = {
  sec:     [0, 0, 0, 0, 0],
  debut:   [0, 0, 0.9, 1.4, 0],
  encours: [0.5, 0, 0, 0, 0],
  // Rien dans l'heure, de la pluie faible de 11 h à 11 h 30 : la suite du modèle.
  tard:    [0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.4, 0, 0, 0],
};
/* La vigilance de tout le pays. Trois teintes et un vert, plus un massif et une
   zone côtière que la carte ne dessine pas. */
export const PAYS_NIVEAUX = { "29": 2, "44": 3, "33": 4, "21": 1 };
/* Les heures s'écrivent dans le fuseau de Paris, celui du navigateur d'essai.
   Les construire dans le fuseau du conteneur les décalerait de deux heures, et
   les cinq pas tomberaient tous dans le passé. */
export const heureParis = t => {
  const f = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
};
/* Le nombre de pas rendus suit celui qui est demandé, comme le fait la source.
   Une charge qui rendrait toujours cinq pas masquerait une demande trop large. */
/* Depuis la version 183, la source rend une colonne par modèle demandé,
   `precipitation_<modèle>`, comme Open-Meteo. `accord` dit combien des
   modèles portent le profil, les autres restant au sec : un accord partiel
   se fabrique ainsi sans profil nouveau. */
export const repliCorps = (profil, base, u, accord = Infinity) => {
  const v = REPLI_PROFILS[profil] || REPLI_PROFILS.sec;
  const q = new URL(u).searchParams;
  const n = Number(q.get("forecast_minutely_15")) || v.length;
  const t0 = Math.floor(base / 900000) * 900000;
  const suite = Array.from({ length: n }, (_, k) => (k < v.length ? v[k] : 0));
  const modeles = (q.get("models") || "").split(",").filter(Boolean);
  const colonnes = modeles.length
    ? Object.fromEntries(modeles.map((m, j) => [`precipitation_${m}`, j < accord ? suite : suite.map(() => 0)]))
    : { precipitation: suite };
  return { minutely_15: { time: suite.map((_, k) => heureParis(t0 + k * 900000)), ...colonnes } };
};

export const pluieCorps = (profil, base) => {
  const p = PLUIE_PROFILS[profil] || PLUIE_PROFILS.sec;
  return {
    update_time: new Date(base - 5 * 60000).toISOString(),
    type: "Feature",
    geometry: { type: "Point", coordinates: [4.31, 47.51] },
    properties: {
      altitude: 251, name: "Millery", french_department: "21",
      rain_product_available: p.dispo, timezone: "Europe/Paris", confidence: 0,
      forecast: PLUIE_PAS.map((m, k) => ({
        time: new Date(base + m * 60000).toISOString(),
        rain_intensity: p.i[k],
        rain_intensity_description: ["Pas de valeur", "Temps sec", "Pluie faible",
          "Pluie modérée", "Pluie forte"][p.i[k]],
      })),
    },
  };
};

/* Même amorce, à un autre instant : les cas d'astres ne se rencontrent pas tous
   à neuf heures du matin. */
export const amorceA = (reglages, quand) => `{
  const ecart = ${new Date(quand).getTime()} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
}`;

/* La même amorce, qui ne récrit pas les réglages déjà posés. Les amorces
   ci-dessus remettent l'état à neuf à chaque page, ce qui est ce qu'il faut
   presque partout ; les contrôles qui éprouvent ce que l'application garde d'un
   rechargement à l'autre ont besoin du contraire. */
export const amorceGardee = (reglages, quand) => `{
  const ecart = ${new Date(quand).getTime()} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  if (!localStorage.getItem("mameteo.reglages.v1")) {
    localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
  }
}`;

export const amorce = reglages => `{
  const ecart = ${FIGE} - Date.now();
  const D = Date;
  globalThis.Date = class extends D {
    constructor(...a){ super(...(a.length ? a : [D.now() + ecart])); }
    static now(){ return D.now() + ecart; }
  };
  Object.setPrototypeOf(globalThis.Date, D);
  localStorage.setItem("mameteo.reglages.v1", ${JSON.stringify(JSON.stringify(reglages))});
}`;

/* Les trois appels Open-Meteo sont détournés, les sources data.gouv sont muettes,
   la recherche de commune rend Grenoble sauf sur « Zzzz », qui ne rend rien et
   éprouve l'erreur sous le champ. Les mêmes routes servent aux contextes qui
   éprouvent le suivi de position. */
/* Chaque appel au service de vigilance, pour compter ce que coûte à la source
   un écran qui se recharge. Les contextes qui suivent le premier ne s'ouvrent
   qu'après la section Vigilance : le relevé y est encore celui du seul contexte
   principal. */

/* Le profil d'air servi. Les contextes s'ouvrent l'un après l'autre : celui qui
   veut un autre air le pose avant d'ouvrir sa page et le remet ensuite. */

/* La grille des nappes de la carte : 380 points, quatre colonnes. La température
   descend du sud au nord et monte vers l'est, ce qui donne une nappe dont
   l'ordre se vérifie ; le vent et l'indice ultraviolet suivent le même
   principe. */
/* L'archive des zones d'alerte de VigiEau, jalon 19, lot 6 : une seule tuile
   au zoom 8, celle de Fain, avec deux zones carrées. À l'ouest, une zone en
   crise sur les eaux de surface, « Zone d'essai Armançon », qui couvre Fain ;
   à l'est, une zone en vigilance sur l'eau potable, « Zone d'essai Ouche ».
   L'archive suit le format PMTiles 3, la tuile le format Mapbox Vector Tile,
   l'une et l'autre écrits ici à la main. */
export const ZONES_TUILE = (() => {
  const z = 8, n = 2 ** z, la = 47.5, lo = 4.3;
  const x = Math.floor((lo + 180) / 360 * n);
  const r = la * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return { z, x, y };
})();
export function zonesArchive() {
  const v = n => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; o.push(b); } while (n); return o; };
  const cle = (f, t) => v(f * 8 + t);
  const chaine = (f, txt) => { const b = [...Buffer.from(txt, "utf8")]; return [...cle(f, 2), ...v(b.length), ...b]; };
  const bloc = (f, octets) => [...cle(f, 2), ...v(octets.length), ...octets];
  const zz = n => (n << 1) ^ (n >> 31);
  const carre = (x0, y0, x1, y1) => [9, zz(x0), zz(y0), 26, zz(x1 - x0), 0, 0, zz(y1 - y0), zz(x0 - x1), 0, 15];
  const cles = ["niveauGravite", "type", "nom"];
  const vals = ["crise", "SUP", "Zone d'essai Armançon", "vigilance", "AEP", "Zone d'essai Ouche"];
  const objet = (tags, geo) => [...bloc(2, tags.flatMap(t => v(t))), ...cle(3, 0), ...v(3), ...bloc(4, geo.flatMap(t => v(t)))];
  const pos = ZONES_TUILE;
  /* La position de Fain dans la tuile, pour que la zone en crise la couvre. */
  const fx = Math.round((((4.3 + 180) / 360) * 256 - pos.x) * 4096);
  const calque = [...chaine(1, "zones_arretes_en_vigueur"),
    ...bloc(2, objet([0, 0, 1, 1, 2, 2], carre(Math.max(0, fx - 900), 400, fx + 500, 3700))),
    ...bloc(2, objet([0, 3, 1, 4, 2, 5], carre(fx + 900, 400, Math.min(4095, fx + 2500), 3700))),
    ...cles.flatMap(k => chaine(3, k)), ...vals.flatMap(t => bloc(4, chaine(1, t))), ...cle(5, 0), ...v(4096), ...cle(15, 0), ...v(2)];
  const tuile = zlib.gzipSync(Buffer.from(bloc(3, calque)));
  /* Le rang de la tuile sur la courbe de Hilbert. */
  let acc = 0;
  for (let t = 0; t < pos.z; t++) acc += 4 ** t;
  let { x, y } = pos, d = 0;
  const N = 2 ** pos.z;
  for (let s2 = N / 2; s2 >= 1; s2 /= 2) {
    const rx = (x & s2) > 0 ? 1 : 0, ry = (y & s2) > 0 ? 1 : 0;
    d += s2 * s2 * ((3 * rx) ^ ry);
    if (ry === 0) { if (rx === 1) { x = N - 1 - x; y = N - 1 - y; } [x, y] = [y, x]; }
  }
  const racine = zlib.gzipSync(Buffer.from([...v(1), ...v(acc + d), ...v(1), ...v(tuile.length), ...v(1)]));
  const tete = Buffer.alloc(127);
  tete.write("PMTiles", 0, "ascii"); tete.writeUInt8(3, 7);
  const u64 = (o, n) => { tete.writeUInt32LE(n % 4294967296, o); tete.writeUInt32LE(Math.floor(n / 4294967296), o + 4); };
  u64(8, 127); u64(16, racine.length); u64(24, 127 + racine.length); u64(32, 0);
  u64(40, 127 + racine.length); u64(48, 0); u64(56, 127 + racine.length); u64(64, tuile.length);
  u64(72, 1); u64(80, 1); u64(88, 1);
  tete.writeUInt8(1, 96); tete.writeUInt8(2, 97); tete.writeUInt8(2, 98); tete.writeUInt8(1, 99);
  tete.writeUInt8(8, 100); tete.writeUInt8(8, 101);
  return Buffer.concat([tete, racine, tuile]);
}

export function prevueCorps(u) {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  const t0 = Date.parse("2026-08-18T07:00:00Z") / 1000;
  const time = Array.from({ length: 36 }, (_, k) => t0 + k * 3600);
  const hp = k => (9 + k) % 24;
  const nuit = k => hp(k) >= 20 || hp(k) < 7;
  return lats.map((la, i) => {
    const lo = lons[i];
    const base = 32 - (la - 41) * 1.6 + lo * 0.25;
    const vent = k => Math.round((6 + (la - 41) * 2.2 + k * 0.2) * 10) / 10;
    return { latitude: la, longitude: lo, hourly: {
      time,
      temperature_2m: time.map((_, k) => Math.round((base - (nuit(k) ? 12 : 0) - (nuit(k) && la > 49 && lo > 5 ? 8 : 0)) * 10) / 10),
      precipitation: time.map(() => (la > 48 && lo < 0 ? 1.2 : 0)),
      snowfall: time.map(() => (la < 46 && lo > 6 ? 0.5 : 0)),
      wind_speed_10m: time.map((_, k) => vent(k)),
      wind_direction_10m: time.map(() => Math.round((200 + lo * 4) % 360)),
      wind_gusts_10m: time.map((_, k) => Math.round(vent(k) * 18) / 10),
      pressure_msl: time.map(() => Math.round((1000 + (la - 41) * 2.5) * 10) / 10),
      cloud_cover: time.map(() => (lo < 2 ? 90 : 10)),
      visibility: time.map((_, k) => (hp(k) >= 5 && hp(k) < 10 && la > 46 && la < 48 && lo > 2 && lo < 6 ? 300 : 20000)),
      freezing_level_height: time.map(() => Math.round(3800 - (la - 41) * 150)),
    } };
  });
}

/* La pluie tombée, version 179 : 72 heures passées en secondes Unix. De la
   pluie sur le sud-est, 0,5 mm par heure pendant les 48 dernières heures, et
   1 mm par heure sur la Bretagne pendant les 24 heures d'avant seulement : la
   Bretagne a de la pluie sur 72 h et aucune sur 48 h. Version 180 : de la
   neige sur les Alpes, 0,2 cm par heure les 24 dernières heures ; une rafale
   de 95 km/h sur la Bretagne il y a 60 heures, 30 ailleurs ; une température
   qui va de 10 à 33 degrés selon l'heure, plus fraîche au nord. */
export function passeeCorps(u) {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  const t1 = Date.parse("2026-08-18T07:00:00Z") / 1000;
  const time = Array.from({ length: 72 }, (_, k) => t1 - (71 - k) * 3600);
  return lats.map((la, i) => {
    const lo = lons[i];
    return { latitude: la, longitude: lo, hourly: { time,
      precipitation: time.map((_, k) => (la < 45 && lo > 4 && k >= 24 ? 0.5 : la > 47 && lo < -1 && k < 24 ? 1 : 0)),
      snowfall: time.map((_, k) => (la < 46.5 && lo > 5.5 && k >= 48 ? 0.2 : 0)),
      wind_gusts_10m: time.map((_, k) => (la > 47 && lo < -1 && k === 12 ? 95 : 30)),
      temperature_2m: time.map((_, k) => Math.round((10 + (k % 24) - (la - 41) * 0.5) * 10) / 10) } };
  });
}

/* Les jours passés, version 180 : 61 jours, le dernier étant le jour
   présent, sur la grille lâche. Le jour présent porte 100 mm partout, qu'une
   lecture correcte laisse de côté ; le sud-est a 2 mm par jour sur la semaine
   d'avant, la Bretagne 5 mm par jour du 8e au 30e jour avant. */
export function passeeJoursCorps(u) {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  const t1 = Date.parse("2026-08-17T22:00:00Z") / 1000;
  const time = Array.from({ length: 61 }, (_, k) => t1 - (60 - k) * 86400);
  return lats.map((la, i) => {
    const lo = lons[i];
    const avant = k => 60 - k;
    return { latitude: la, longitude: lo, daily: { time,
      precipitation_sum: time.map((_, k) => (avant(k) === 0 ? 100
        : la < 45 && lo > 4 && avant(k) <= 7 ? 2 : la > 47 && lo < -1 && avant(k) >= 8 && avant(k) <= 30 ? 5 : 0)),
      snowfall_sum: time.map(() => 0),
      wind_gusts_10m_max: time.map((_, k) => (avant(k) === 20 ? 110 : 40)),
      temperature_2m_max: time.map((_, k) => (avant(k) === 0 ? 50 : 28)),
      temperature_2m_min: time.map(() => 12) } };
  });
}

export function grilleCorps(u) {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  return lats.map((la, k) => {
    const lo = lons[k];
    return {
      latitude: la, longitude: lo,
      current: {
        time: "2026-08-18T09:00", interval: 900,
        temperature_2m: Math.round((32 - (la - 41) * 1.6 + lo * 0.25) * 10) / 10,
        wind_speed_10m: Math.round((6 + (la - 41) * 2.2) * 10) / 10,
        wind_direction_10m: Math.round((200 + lo * 4) % 360),
      },
      /* L'indice ultraviolet se prend sur la journée, non sur l'instant : deux
         dates sont rendues, et la lecture doit retenir celle du jour. La valeur
         de la veille est volontairement très différente. */
      daily: {
        time: ["2026-08-17", "2026-08-18"],
        uv_index_max: [1, Math.round((8 - (la - 41) * 0.42) * 100) / 100],
      },
    };
  });
}

/* L'archive du climat. Une série bâtie pour que chaque réponse se recalcule à
   la main : le maximum d'une journée est une sinusoïde de saison plus une
   montée régulière de l'année, plus une bosse déterministe qui donne du relief
   à la distribution. Aucun hasard : deux lectures rendent la même chose, et un
   percentile attendu se calcule à part dans le contrôle.

   La montée vaut deux centièmes de degré par an, soit un degré et demi sur les
   soixante-seize années : les bandes de réchauffement ont alors un sens de
   lecture, du bleu au rouge, que le contrôle vérifie.

   La pluie est nulle un jour sur deux et vaut deux millimètres l'autre, ce qui
   rend un cumul de saison exactement calculable. */
/* Les restrictions d'eau de VigiEau, jalon 18 : la Côte-d'Or en crise, Paris
   en alerte, les Bouches-du-Rhône sans arrêté. */
export const VIGIEAU = [{ code: "21", nom: "Côte-d'Or", niveauGraviteMax: "crise" },
  { code: "75", nom: "Paris", niveauGraviteMax: "alerte" }, { code: "13", nom: "Bouches-du-Rhône", niveauGraviteMax: null }];
/* La restriction de la commune d'essai : eaux de surface en alerte, eau potable
   en vigilance ; un piézomètre voisin qui mesure depuis 1996 et monte d'un
   centimètre par an, donc une nappe très haute, plus haute que ses trente
   années passées. */
export const VIGIEAU_ZONES = [
  { type: "AEP", nom: "Seine amont", niveauGravite: "vigilance", arrete: { cheminFichier: "https://exemple.gouv.fr/arrete.pdf", dateFinValidite: "2026-10-31T00:00:00.000Z" } },
  { type: "SUP", nom: "Seine amont", niveauGravite: "alerte", arrete: { cheminFichier: "https://exemple.gouv.fr/arrete.pdf", dateFinValidite: "2026-10-31T00:00:00.000Z" } }];
let chroniqueEssai = null;
/* Les rivières, jalon 18 : deux stations près de la commune d'essai. La plus
   proche ne mesure que la hauteur ; la seconde mesure aussi le débit, sa
   hauteur monte de cinq centimètres en vingt-quatre heures, et son débit des
   sept derniers jours est dix fois plus faible que celui de toutes les années
   passées à la même date. */
let debitsEssai = null;
export function hydroCorps(u) {
  if (u.includes("/referentiel/stations")) {
    return { count: 2, data: [
      { code_station: "H0000001", libelle_station: "LA SEINE A FAIN - ECHELLE DE SECOURS", libelle_cours_eau: "LA SEINE", longitude_station: FAIN.lon + 0.004, latitude_station: FAIN.lat },
      { code_station: "H0000002", libelle_station: "LA SEINE A FAIN", libelle_cours_eau: "LA SEINE", longitude_station: FAIN.lon + 0.03, latitude_station: FAIN.lat }] };
  }
  /* Les cours d'eau sur la carte : trois stations autour de la commune d'essai,
     les mesures de la plus récente à la plus ancienne. La première monte de
     quatre centimètres en six heures, la deuxième baisse de trois, la
     troisième est stable. */
  if (u.includes("/observations_tr?bbox=")) {
    /* Une dizaine de kilomètres autour de la commune : plus près, les trois
       étiquettes tombaient sur son repère et s'effaçaient, comme le veut la
       règle des chevauchements. */
    const st = [["R1", 0.15, 0.07, 800, 840], ["R2", -0.16, -0.06, 500, 470], ["R3", 0.03, -0.13, 300, 305]];
    const data = [];
    for (let k = 6; k >= 0; k--) for (const [code, dlo, dla, a, b] of st)
      data.push({ code_station: code, latitude: FAIN.lat + dla, longitude: FAIN.lon + dlo,
        date_obs: `2026-08-18T0${9 - (6 - k) > 9 ? 9 : 3 + k}:00:00Z`, resultat_obs: a + Math.round((b - a) * k / 6) });
    return { count: data.length, data };
  }
  if (u.includes("/observations_tr")) {
    const debit = u.includes("H0000002");
    const data = [];
    for (let k = 0; k <= 24; k++) {
      const t = new Date(Date.parse("2026-08-17T09:00:00Z") + k * 3600000).toISOString().slice(0, 19) + "Z";
      data.push({ date_obs: t, resultat_obs: 500 + Math.round(k * 50 / 24), grandeur_hydro: "H" });
      if (debit) data.push({ date_obs: t, resultat_obs: 800, grandeur_hydro: "Q" });
    }
    return { count: data.length, data };
  }
  if (!debitsEssai) {
    debitsEssai = [];
    for (let t = Date.parse("1995-01-01T12:00:00Z"); t <= Date.parse("2026-08-17T12:00:00Z"); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      debitsEssai.push({ date_obs_elab: d, resultat_obs_elab: d >= "2026-08-01" ? 100 : 1000 });
    }
  }
  return { count: debitsEssai.length, data: debitsEssai };
}
/* L'étiage et la température de l'eau, jalon 18 : quatre points vus lors de la
   dernière campagne, le 10 août, deux à sec, un interrompu, un faible, le plus
   proche coulant faiblement ; un cinquième vu seulement le 20 juillet, qui ne
   compte pas. Une température de l'eau mesurée la veille. */
export function ondeCorps() {
  const o = (code, nom, dlo, date, ec) => ({ code_station: code, libelle_station: nom, latitude: FAIN.lat, longitude: FAIN.lon + dlo,
    date_observation: `${date}T00:00:00Z`, libelle_ecoulement: ec });
  return { count: 6, data: [
    o("S1", "LE RU DE FAIN A FAIN", 0.01, "2026-07-20", "Ecoulement visible acceptable"),
    o("S1", "LE RU DE FAIN A FAIN", 0.01, "2026-08-10", "Ecoulement visible faible"),
    o("S2", "LA SEINE A NOD", 0.2, "2026-08-10", "Assec"),
    o("S3", "LE RU D'EN HAUT", 0.25, "2026-08-10", "Assec"),
    o("S4", "LA LAIGNE", 0.3, "2026-08-10", "Ecoulement non visible"),
    o("S5", "LA BRENNE", 0.35, "2026-07-20", "Assec")] };
}
export function hubeauCorps(u) {
  if (u.includes("/ecoulement/")) return ondeCorps();
  if (u.includes("/temperature/")) {
    return { count: 1, data: [{ libelle_station: "LA SEINE A FAIN", resultat: 18.46, date_mesure_temp: "2026-08-16",
      heure_mesure_temp: "14:00:00", latitude: FAIN.lat, longitude: FAIN.lon + 0.01 }] };
  }
  if (u.includes("/hydrometrie/")) return hydroCorps(u);
  if (u.includes("/stations")) {
    return { count: 2, data: [
      { code_bss: "04358X0001/P", libelle_pe: "PUITS DE LA FONTAINE (MONTBARD-21)", nom_commune: "Montbard", x: 4.34, y: 47.62, date_debut_mesure: "1996-01-01", date_fin_mesure: "2026-08-15" },
      { code_bss: "04358X0002/P", libelle_pe: "FORAGE ANCIEN", nom_commune: "Fain", x: 4.31, y: 47.66, date_debut_mesure: "1990-01-01", date_fin_mesure: "2020-06-01" }] };
  }
  if (!chroniqueEssai) {
    chroniqueEssai = [];
    for (let t = Date.parse("1996-01-01T12:00:00Z"); t <= Date.parse("2026-08-15T12:00:00Z"); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      chroniqueEssai.push({ date_mesure: d, niveau_nappe_eau: Math.round((100 + (Number(d.slice(0, 4)) - 1996) * 0.01) * 1000) / 1000 });
    }
  }
  return { count: chroniqueEssai.length, data: chroniqueEssai };
}
/* La comparaison entre lieux, jalon 14, lot 2 : une charge par lieu, dans
   l'ordre des coordonnées. Chaque lieu a deux degrés de plus que le précédent,
   et seul le deuxième reçoit de la pluie, cinq millimètres par jour. */
export function lieuxCorps(u) {
  const q = new URL(u).searchParams;
  const lats = q.get("latitude").split(",");
  const d0 = Date.parse(`${q.get("start_date")}T00:00:00Z`), d1 = Date.parse(`${q.get("end_date")}T00:00:00Z`);
  const time = [];
  for (let t = d0; t <= d1; t += 86400000) time.push(new Date(t).toISOString().slice(0, 10));
  const un = i => ({ latitude: Number(lats[i]), longitude: 0, daily: { time,
    temperature_2m_max: time.map((_, k) => 20 + i * 2 + k * 0.3),
    temperature_2m_min: time.map((_, k) => 11 + i * 2 + k * 0.3),
    precipitation_sum: time.map(() => (i === 1 ? 5 : 0)) } });
  return lats.length === 1 ? un(0) : lats.map((_, i) => un(i));
}
export const ARCHIVE_MONTEE = 0.02;
/* La bosse est la somme de deux restes et non un seul : une somme de deux
   tirages plats donne une distribution en toit, dense au milieu et rare aux
   bords, comme l'est celle d'une température. Un tirage plat rendrait les
   quantiles alignés, et une garde sur le percentile ne verrait pas la
   différence entre l'interpolation par bornes et une simple règle de trois. */
export const archiveMax = (an, rang) =>
  Math.round((14 + 10 * Math.sin((rang / 365) * 2 * Math.PI - 1.9)
    + (an - 1950) * ARCHIVE_MONTEE
    + ((an * 7 + rang * 13) % 7) + ((an * 11 + rang * 5) % 7) - 6) * 10) / 10;
export function archiveCorps(u) {
  const q = new URL(u).searchParams;
  const d0 = new Date(`${q.get("start_date")}T00:00:00Z`);
  const d1 = new Date(`${q.get("end_date")}T00:00:00Z`);
  const time = [], mx = [], mn = [], pl = [];
  for (let t = d0.getTime(); t <= d1.getTime(); t += 86400000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    const an = d.getUTCFullYear();
    const rang = Math.round((d - Date.UTC(an, 0, 1)) / 86400000);
    const M = archiveMax(an, rang);
    time.push(iso); mx.push(M); mn.push(Math.round((M - 8) * 10) / 10);
    pl.push(rang % 2 === 0 ? 2 : 0);
  }
  /* Plusieurs lieux à la fois, pour la comparaison entre lieux du jalon 14 :
     une charge par lieu, deux degrés de plus à chaque lieu, et la pluie sur le
     deuxième seulement, cinq millimètres par jour. Un seul lieu garde la
     charge d'avant, dont d'autres gardes dépendent. */
  const lats = (q.get("latitude") || "").split(",");
  if (lats.length > 1) {
    return lats.map((la, i) => ({ latitude: Number(la), longitude: 0, elevation: 345,
      daily: { time, temperature_2m_max: mx.map(v => v + 2 * i), temperature_2m_min: mn.map(v => v + 2 * i),
        precipitation_sum: time.map(() => (i === 1 ? 5 : 0)) } }));
  }
  return { latitude: 47.6, longitude: 4.3, elevation: 345,
    daily: { time, temperature_2m_max: mx, temperature_2m_min: mn, precipitation_sum: pl } };
}

/* La grille de la qualité de l'air : les mêmes 380 points, un autre service.
   L'indice monte du sud au nord, l'inverse de la température, pour qu'une
   nappe peinte avec la mauvaise grille se voie. */
export function grilleAirCorps(u) {
  const q = new URL(u).searchParams;
  const lats = decodeURIComponent(q.get("latitude")).split(",").map(Number);
  const lons = decodeURIComponent(q.get("longitude")).split(",").map(Number);
  return lats.map((la, k) => ({
    latitude: la, longitude: lons[k],
    current: { time: "2026-08-18T09:00", interval: 3600,
      european_aqi: Math.round(8 + (la - 41) * 4.2) },
  }));
}

/* Le désaccord entre modèles sur la pluie, posé par les contextes qui
   l'éprouvent : AROME annonce une bruine à cette heure, le modèle global reste
   sec. C'est le défaut du 9 septembre 2026 à Paris. */

/* Une retouche de la série servie, à une heure donnée. Elle sert aux charges
   discordantes : un code de pluie sans lame ni risque, un risque sans lame, une
   lame sans risque. Ce sont les situations où deux écrans se mettent à dire deux
   choses, et la charge d'essai ordinaire, propre et cohérente avec elle-même,
   n'en porte aucune. Elle vaut pour les deux modèles : c'est une situation
   météorologique, non un désaccord. */

/* Le modèle fin muet : la source n'a plus qu'une voix. C'est le cas au delà de
   sa portée, trois jours, et celui d'un modèle momentanément indisponible. */

export function retoucher(hourly, etat) {
  if (!etat.retoucheGlobal) return hourly;
  const k = hourly.time.indexOf(etat.retoucheGlobal.heure);
  if (k < 0) return hourly;
  for (const [c, v] of Object.entries(etat.retoucheGlobal)) {
    if (c === "heure" || !Array.isArray(hourly[c])) continue;
    hourly[c][k] = v;
  }
  return hourly;
}

export const brancherFauxServices = async (c, etat) => {
  /* L'ensemble se sert avant la prévision : son domaine porte le même nom à un
     préfixe près, et la route de la prévision le happerait. Playwright essaie la
     dernière route posée en premier, celle-ci vient donc après. */
  await c.route(/api\.open-meteo\.com/, async route => {
    const u = route.request().url();
    const d = JSON.parse(JSON.stringify(METEO));
    // Le classement des lieux : la colonne d'ensoleillement n'est demandée que là.
    /* Le repli de la pluie dans l'heure passe par le même hôte que la prévision.
       Il se reconnaît à sa colonne, demandée nulle part ailleurs. */
    if (u.includes("minutely_15")) {
      etat.appelsRepli.push(u);
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(repliCorps(etat.profilRepli, FIGE, u, etat.accordRepli)) });
      return;
    }
    if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
    /* La grille prévue de la carte, jalon 19, lot 5 : trente-six heures en
       secondes Unix depuis 9 h, heure de Paris. De la pluie sur la Bretagne,
       1,2 mm par heure ; de la neige sur les Alpes, 0,5 cm par heure ; du gel
       la nuit dans le nord-est ; une pression qui monte de 1000 hPa au sud à
       1026 au nord ; du brouillard au matin dans le centre-est. */
    if (u.includes("past_days=60") && u.includes("daily=precipitation_sum")) {
      etat.appelsPasseeJours.push(u);
      if (etat.retardPasseeJours) await new Promise(r => setTimeout(r, etat.retardPasseeJours));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(passeeJoursCorps(u)) });
      return;
    }
    if (u.includes("past_hours=72") && u.includes("hourly=precipitation")) {
      etat.appelsPassee.push(u);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(passeeCorps(u)) });
      return;
    }
    if (u.includes("timeformat=unixtime") && u.includes("hourly=temperature_2m%2Cprecipitation%2Csnowfall")) {
      etat.appelsPrevue.push(u);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(prevueCorps(u)) });
      return;
    }
    /* Le temps d'un point touché sur la carte, jalon 19, lot 4 : une seule
       latitude, et les rafales parmi les valeurs du moment. Une averse de
       0,6 mm, 21,4°, un vent de sud-ouest à 18 km/h et des rafales à 42. */
    if (u.includes("current=") && u.includes("wind_gusts_10m") && !new URL(u).searchParams.get("latitude").includes(",")) {
      etat.appelsPoint.push(u);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: {
        temperature_2m: 21.4, weather_code: 61, precipitation: 0.6, wind_speed_10m: 18, wind_gusts_10m: 42,
        wind_direction_10m: 225, is_day: 1 } }) });
      return;
    }
    /* La grille des nappes de la carte se reconnaît à ses colonnes : la
       direction du vent n'est demandée nulle part ailleurs. */
    if (u.includes("current=") && u.includes("wind_direction_10m")) {
      etat.appelsGrille.push(u);
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(grilleCorps(u)) });
      return;
    }
    if (u.includes("hourly=snow_depth") && u.includes("elevation=")) {
      const lats = new URL(u).searchParams.get("latitude").split(",");
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lats.map((_, i) => ({ hourly: {
        time: Array.from({ length: 24 }, (_, h) => `2026-08-18T${String(h).padStart(2, "0")}:00`),
        snow_depth: Array.from({ length: 24 }, () => (i % 2 ? 0 : 0.5)) } }))) });
      return;
    }
    /* Les prévisions des villes, jalon 18 : la requête se reconnaît à ses
       heures de temps, de température et de jour, demandées ensemble nulle
       part ailleurs ; les villes changent avec la vue depuis la version 143.
       Chaque ville a deux jours d'heures, un temps qui dépend de son rang,
       10° la nuit et 20° à 15 h. */
    if (u.includes("hourly=weather_code%2Ctemperature_2m%2Cis_day")) {
      const lats = new URL(u).searchParams.get("latitude").split(",");
      etat.appelsVilles.push(u);
      const time = ["2026-08-18", "2026-08-19"].flatMap(j => Array.from({ length: 24 }, (_, h) => `${j}T${String(h).padStart(2, "0")}:00`));
      const temp = t => { const h = Number(t.slice(11, 13)); return 10 + 10 * Math.max(0, 1 - Math.abs(h - 15) / 9); };
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lats.map((_, i) => ({
        hourly: { time, weather_code: time.map(() => [0, 3, 61][i % 3]), temperature_2m: time.map(temp), is_day: time.map(t => (+t.slice(11, 13) >= 7 && +t.slice(11, 13) < 20 ? 1 : 0)) } }))) });
      return;
    }
    /* Le sol, jalon 18 : la requête se reconnaît à l'humidité du sol. Un sol sec
       à 18 %, une semaine sans pluie qui a évaporé 21 mm, 3 mm attendus d'ici
       après-demain. */
    if (u.includes("soil_moisture_9_to_27cm")) {
      const jours = ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15", "2026-08-16", "2026-08-17",
        "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"];
      const time = jours.flatMap(j => Array.from({ length: 24 }, (_, h) => `${j}T${String(h).padStart(2, "0")}:00`));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        hourly: { time, soil_moisture_9_to_27cm: time.map(() => 0.18) },
        daily: { time: jours, precipitation_sum: jours.map(j => (j === "2026-08-18" ? 1 : j === "2026-08-19" ? 2 : 0)),
          et0_fao_evapotranspiration: jours.map(() => 3) } }) });
      return;
    }
    /* La comparaison entre lieux se reconnaît à ses dates de début et de fin,
       demandées nulle part ailleurs sur ce service. */
    if (u.includes("start_date=")) {
      etat.appelsLieux.push(u);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lieuxCorps(u)) });
      return;
    }
    // Aperçu des communes suivies : un tableau, un élément par couple de coordonnées.
    if (u.includes("current=")) {
      const lats = decodeURIComponent(new URL(u).searchParams.get("latitude")).split(",");
      const tab = lats.map((_, k) => ({
        current: { temperature_2m: 18 + k * 3, weather_code: [0, 3, 61][k % 3], is_day: 1 },
        daily: { temperature_2m_min: [12 + k], temperature_2m_max: [26 + k] },
      }));
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(tab) });
      return;
    }
    if (u.includes("models=meteofrance_arome")) {
      if (etat.aromeMuet) { route.fulfill({ status: 500, body: "non" }); return; }
      /* AROME sert la même série que le modèle global, sauf quand un contexte
         demande un désaccord : le profil pose alors une bruine que le modèle
         global ne voit pas, ce qui est le défaut relevé le 9 septembre. */
      const a = JSON.parse(JSON.stringify({ hourly: retoucher(d.hourly, etat) }));
      if (etat.bruineArome) {
        const k = a.hourly.time.indexOf(etat.bruineArome.heure);
        if (k >= 0) {
          a.hourly.weather_code[k] = etat.bruineArome.code;
          a.hourly.precipitation[k] = etat.bruineArome.mm;
          a.hourly.cloud_cover[k] = 100;
        }
      }
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(a) });
      return;
    }
    if (u.includes("hourly=")) {
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: retoucher(d.hourly, etat) }) });
      return;
    }
    delete d.hourly;
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  });
  // Les deux sources data.gouv sont coupées : on éprouve le repli.
  await c.route(/object\.files\.data\.gouv\.fr|www\.data\.gouv\.fr/, r => r.abort());
  /* La vigilance : orange sur les orages jusqu'à 20 h, jaune sur le vent de 14 h
     à 18 h, vert ailleurs. Le département 99 sert le tout vert, pour éprouver
     l'absence de panneau.

     La route branche sur le paramètre `echeance` : sans lui la réponse porte le
     jour en cours, avec `J1` le lendemain. L'échéance du lendemain est ici tout
     au vert, le contexte ordinaire éprouvant ce qui est en vigueur ; trois
     contextes dédiés éprouvent l'annonce. */
  await c.route(/webservice\.meteofrance\.com/, r => {
    const u = new URL(r.request().url());
    const dep = u.searchParams.get("domain");
    etat.appelsVig.push(`${dep}|${u.searchParams.get("echeance") || "J0"}`);
    /* Les heures se posent en heure de Paris, celle du navigateur d'essai : les
       construire dans le fuseau du conteneur les décalerait de deux heures. */
    const h = (n, j = 18) => Math.floor(
      Date.parse(`2026-08-${j}T${String(n).padStart(2, "0")}:00:00+02:00`) / 1000);
    const vert = (id, j = 18) => ({ phenomenon_id: String(id),
      timelaps_items: [{ begin_time: h(0, j), end_time: h(23, j), color_id: 1 }] });
    if (u.searchParams.get("echeance") === "J1") {
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        domain_id: dep, update_time: h(6), end_validity_time: h(0, 20),
        timelaps: [1, 2, 3, 4, 5, 6].map(id => vert(id, 19)),
      })});
      return;
    }
    const corps = dep === "99"
      ? { domain_id: dep, update_time: h(6), end_validity_time: h(0, 19),
          timelaps: [1, 2, 3, 4, 5, 6].map(id => vert(id)) }
      : { domain_id: dep, update_time: h(6), end_validity_time: h(0, 19),
          timelaps: [
            { phenomenon_id: "3", timelaps_items: [
              { begin_time: h(6), end_time: h(20), color_id: 3 },
              { begin_time: h(20), end_time: h(23), color_id: 1 }] },
            { phenomenon_id: "1", timelaps_items: [
              { begin_time: h(0), end_time: h(14), color_id: 1 },
              { begin_time: h(14), end_time: h(16), color_id: 2 },
              { begin_time: h(16), end_time: h(18), color_id: 2 },
              { begin_time: h(18), end_time: h(23), color_id: 1 }] },
            vert(2), vert(5), vert(6),
          ] };
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  /* La commune qui contient un point : le point touché sur la carte, jalon
     19, lot 4, et le nom d'une plage que la liste embarquée ne porte pas.
     Tout point est à Grenoble, comme pour le service d'adresses. */
  await c.route(/geo\.api\.gouv\.fr\/communes/, r => {
    etat.appelsGeo.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ nom: "Grenoble", codesPostaux: ["38000"], codeDepartement: "38" }]) });
  });
  await c.route(/api-adresse\.data\.gouv\.fr/, r => {
    const q = new URL(r.request().url()).searchParams.get("q") || "";
    const vide = { features: [] };
    const grenoble = { features: [{
      geometry: { coordinates: [5.7245, 45.1885] },
      properties: { city: "Grenoble", name: "Grenoble", postcode: "38000", context: "38, Isère" },
    }] };
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(/zzzz/i.test(q) ? vide : grenoble) });
  });
  await c.route(/ensemble-api\.open-meteo\.com/, r => {
    etat.appelsEns.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(charpenteEnsemble(r.request().url())) });
  });
  /* L'archive du climat. Son domaine porte « open-meteo.com » et la route de la
     prévision le happerait : elle se pose donc après, Playwright essayant la
     dernière posée en premier. */
  /* L'archive des zones d'alerte, servie par plages d'octets comme le fait le
     serveur de VigiEau. */
  const archiveZones = zonesArchive();
  await c.route(/regleau\.s3\.gra\.perf\.cloud\.ovh\.net/, r => {
    etat.appelsZones.push(r.request().headers().range || "sans plage");
    const m = /bytes=(\d+)-(\d+)/.exec(r.request().headers().range || "");
    const a = m ? Number(m[1]) : 0, b = m ? Math.min(Number(m[2]), archiveZones.length - 1) : archiveZones.length - 1;
    r.fulfill({ status: m ? 206 : 200, headers: { "content-type": "application/octet-stream",
      "content-range": `bytes ${a}-${b}/${archiveZones.length}`, "access-control-allow-origin": "*" },
      body: archiveZones.subarray(a, b + 1) });
  });
  await c.route(/api\.vigieau\.gouv\.fr/, r => {
    const u = r.request().url();
    etat.appelsVigieau.push(u);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(u.includes("/api/zones") ? VIGIEAU_ZONES : VIGIEAU) });
  });
  /* La mer et la neige sur la carte, jalon 18 : une charge par point, l'eau à
     17° et plus selon le rang, des vagues de 0,4 m et plus ; un domaine sur deux
     enneigé à 50 cm au sommet, l'autre sans neige. */
  const heuresCarte = Array.from({ length: 24 }, (_, h) => `2026-08-18T${String(h).padStart(2, "0")}:00`);
  await c.route(/marine-api\.open-meteo\.com/, r => {
    const u = r.request().url();
    /* La grille de la mer sur la carte, jalon 19, lot 5b : l'instant sur les
       380 points. La mer est à l'ouest de 2° de longitude ou au sud de 43,2° ;
       la terre ne rend rien. Des vagues qui grossissent vers l'ouest, une eau
       plus chaude au sud. */
    if (u.includes("current=")) {
      etat.appelsMer.push(u);
      const q = new URL(u).searchParams;
      const la = q.get("latitude").split(",").map(Number), lo = q.get("longitude").split(",").map(Number);
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(la.map((x, i) => {
        const mer = lo[i] < -2 || x < 43.2;
        return { current: { time: "2026-08-18T09:00", interval: 900,
          wave_height: mer ? Math.round((0.5 + Math.max(0, -lo[i]) * 0.5) * 10) / 10 : null,
          sea_surface_temperature: mer ? Math.round((26 - (x - 41) * 0.9) * 10) / 10 : null } };
      })) });
      return;
    }
    const lats = (new URL(u).searchParams.get("latitude") || "").split(",");
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lats.map((_, i) => ({ hourly: { time: heuresCarte,
      sea_surface_temperature: heuresCarte.map(() => 17 + (i % 6)), wave_height: heuresCarte.map(() => 0.4 + (i % 4) * 0.5),
      wave_period: heuresCarte.map(() => 8), wave_direction: heuresCarte.map(() => 270), sea_level_height_msl: heuresCarte.map(() => 0) } }))) });
  });
  await c.route(/hubeau\.eaufrance\.fr/, r => {
    const u = r.request().url();
    etat.appelsHubeau.push(u);
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hubeauCorps(u)) });
  });
  await c.route(/archive-api\.open-meteo\.com/, r => {
    const u = r.request().url();
    etat.appelsArchive.push(u);
    if (etat.archiveMuette) { r.fulfill({ status: 503, body: "non" }); return; }
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(archiveCorps(u)) });
  });
  /* L'air se sert après la prévision, pour la même raison que l'ensemble : son
     domaine porte « api.open-meteo.com » à un préfixe près, et la route de la
     prévision le happerait. */
  await c.route(/air-quality-api\.open-meteo\.com/, r => {
    const u = r.request().url();
    /* La grille de la carte se reconnaît à ce qu'elle demande l'instant sur
       plusieurs points, quand la feuille demande des heures sur un seul. */
    /* Les pollens de la carte, jalon 19, lot 5b : des graminées au pic dans
       le sud-ouest, en saison au centre, rien au nord. */
    if (u.includes("current=") && u.includes("grass_pollen")) {
      etat.appelsPollens.push(u);
      const q = new URL(u).searchParams;
      const la = q.get("latitude").split(",").map(Number), lo = q.get("longitude").split(",").map(Number);
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(la.map((x, i) => ({ current: {
        time: "2026-08-18T09:00", interval: 3600, alder_pollen: 0, birch_pollen: 0, mugwort_pollen: 0, olive_pollen: 0,
        ragweed_pollen: 0, grass_pollen: x < 44.5 && lo[i] < 2 ? 60 : x < 47.5 ? 10 : 0 } }))) });
      return;
    }
    if (u.includes("current=")) {
      etat.appelsGrilleAir.push(u);
      r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(grilleAirCorps(u)) });
      return;
    }
    etat.appelsAir.push(u);
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(airDe(etat.profilAir)) });
  });
  /* La vigilance de tout le pays, pour la couche de la carte. Elle se sert sur
     le même service que le bulletin détaillé et donc après lui. Quelques
     départements en jaune, en orange et un en rouge, de quoi éprouver les trois
     teintes ; le reste du pays reste au vert et ne paraît pas dans la table. */
  await c.route(/warning\/currentphenomenons/, r => {
    etat.appelsPays.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      update_time: Math.floor(FIGE / 1000), domain_id: "FRA",
      subdomains_phenomenons_max_color: [
        ...Object.entries(PAYS_NIVEAUX).map(([d, n]) => ({ domain_id: d,
          phenomenons_max_color: [{ phenomenon_id: "1", phenomenon_max_color_id: n }] })),
        /* Un massif et une zone côtière, que la source rend aussi et que la
           carte ne dessine pas. */
        { domain_id: "MAS21", phenomenons_max_color: [{ phenomenon_id: "8", phenomenon_max_color_id: 3 }] },
        { domain_id: "0610", phenomenons_max_color: [{ phenomenon_id: "9", phenomenon_max_color_id: 4 }] },
      ],
    })});
  });
  /* La pluie dans l'heure, sur le même service que la vigilance et donc posée
     après elle : Playwright essaie la dernière route posée en premier, et celle
     de la vigilance happerait ce chemin. */
  await c.route(/webservice\.meteofrance\.com\/v3\/nowcast\/rain/, r => {
    const u = new URL(r.request().url());
    /* Le point lui-même suit `profilPluie` ; ses quatre voisins, depuis la
       version 168, suivent `profilVoisins` quand il est posé, le même profil
       sinon. Seuls les appels du point se comptent dans `appelsPluie`. */
    const ici = Math.abs(Number(u.searchParams.get("lat")) - FAIN.lat) < 1e-6
      && Math.abs(Number(u.searchParams.get("lon")) - FAIN.lon) < 1e-6;
    if (ici) etat.appelsPluie.push(r.request().url());
    else etat.appelsVoisins.push(r.request().url());
    const profil = ici ? etat.profilPluie : (etat.profilVoisins || etat.profilPluie);
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(pluieCorps(profil, FIGE)) });
  });
  // L'index du radar et ses tuiles, sur deux domaines distincts.
  await c.route(/api\.rainviewer\.com/, r => {
    etat.appelsRadar.push(r.request().url());
    r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(radarIndex(etat)) });
  });
  /* L'indice officiel d'Atmo France. Le service rend les zones d'un rayon, non
     la commune demandée : la charge en porte trois, dont la plus proche est à
     un kilomètre et demi et une autre, plus séduisante par son rang, à douze.
     Un réglage la fait tarder ou échouer, comme le vrai service le fait. */
  await c.route(/data\.atmo-france\.org/, async r => {
    etat.appelsAtmo.push(r.request().url());
    if (etat.atmoMuet) { r.abort(); return; }
    if (etat.atmoLent) await new Promise(f => setTimeout(f, etat.atmoLent));
    const zone = (nom, q, x, y, sous) => ({ type: "Feature", properties: {
      lib_zone: nom, lib_qual: ATMO_MOTS[q], code_qual: q, type_zone: "commune",
      date_ech: atmoJour, source: "Atmo Bourgogne-Franche-Comté",
      x_wgs84: x, y_wgs84: y, code_pm25: sous[0], code_pm10: sous[1],
      code_o3: sous[2], code_no2: sous[3], code_so2: sous[4] } });
    r.fulfill({ status: 200, contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ type: "FeatureCollection", features: [
        zone("Zone lointaine", 5, 4.45, 47.58, [4, 5, 3, 2, 1]),
        zone("Genay", 3, 4.31, 47.512, [1, 2, 3, 1, 1]),
        zone("Zone moyenne", 2, 4.22, 47.44, [1, 1, 2, 1, 1]),
      ] }) });
  });
  await c.route(/view\.eumetsat\.int/, r => {
    const u = r.request().url();
    etat.appelsFoudre.push(u);
    if (/request=GetCapabilities/i.test(u)) {
      r.fulfill({ status: 200, contentType: "text/xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0">`
          + `<Capability><Layer><Layer queryable="1"><Name>mtg_fd:li_afa</Name>`
          + `<Dimension name="time" default="${heureService(FOUDRE_DERNIER)}" units="ISO8601">`
          + `2025-05-30T00:00:00.000Z/${heureService(FOUDRE_DERNIER)}/PT5M</Dimension>`
          + `</Layer></Layer></Capability></WMS_Capabilities>` });
      return;
    }
    const m = /[?&]time=([^&]+)/.exec(u);
    const t = m ? Date.parse(decodeURIComponent(m[1])) : NaN;
    if (t === FOUDRE_XML) {
      r.fulfill({ status: 200, contentType: "application/xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `<?xml version="1.0"?><ServiceExceptionReport><ServiceException `
          + `code="InvalidDimensionValue" locator="time">No nearest match`
          + `</ServiceException></ServiceExceptionReport>` });
      return;
    }
    const corps = !etat.foudreTeinte ? pngUni(0, 0, 0, 0)
      : t === FOUDRE_DERNIER ? pngUni(220, 20, 20, 255) : pngUni(250, 230, 90, 255);
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" }, body: corps });
  });
  /* L'imagerie de nuages, servie par le même hôte que la foudre. La tuile
     arrive opaque, comme le vrai service la rend : un damier de gris clairs et
     sombres, pour que la mise en transparence se mesure. */
  /* Les tuiles de l'indice officiel de l'air. Le service rend un pas à deux
     jours dans le futur quand la date manque : la charge le reproduit en
     servant alors une image vide, sans quoi l'oubli passerait inaperçu. */
  await c.route(/data\.atmo-france\.org\/geoserver\/ind\/ows.*GetMap/, r => {
    const u = r.request().url();
    etat.appelsAirTuiles.push(u);
    const daté = /[?&]time=\d{4}-\d\d-\d\d/.test(u);
    /* Les tuiles sont vides par défaut, comme le vrai service hors de France :
       la nappe interpolée reste alors mesurable là où elle se voit. Un contrôle
       les fait peindre pour vérifier qu'elles se posent. */
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: daté && etat.airTuilesPleines ? pngUni(240, 230, 65, 255) : pngUni(0, 0, 0, 0) });
  });
  await c.route(/maps\.effis\.emergency\.copernicus\.eu/, r => {
    const u = r.request().url();
    etat.appelsFeux.push(u);
    const m = /[?&]time=([^&]+)/.exec(u);
    const jour = m ? decodeURIComponent(m[1]) : "2020-01-01";
    const vide = jour < "2025-01-01";
    /* Comme le vrai service, des foyers verts quand la période dépasse un
       mois : la couleur dit l'âge du foyer. Version 180. */
    const [debut, fin] = jour.split("/");
    const vieux = /layers=viirs\.hs&/.test(u) && fin && Date.parse(fin) - Date.parse(debut) > 30 * 86400000;
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: vide ? pngUni(0, 0, 0, 0) : vieux ? pngUni(60, 200, 70, 255) : pngUni(232, 68, 42, 255) });
  });
  await c.route(/view\.eumetsat\.int\/geoserver\/mtg_fd\/ir105_hrfi/, r => {
    const u = r.request().url();
    etat.appelsNuages.push(u);
    if (/request=GetCapabilities/i.test(u)) {
      r.fulfill({ status: 200, contentType: "text/xml",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: `<?xml version="1.0" encoding="UTF-8"?><WMS_Capabilities version="1.3.0">`
          + `<Capability><Layer><Layer><Name>mtg_fd:ir105_hrfi</Name>`
          + `<Dimension name="time" default="${heureService(NUAGES_DERNIER)}" units="ISO8601">`
          + `2025-05-30T00:00:00.000Z/${heureService(NUAGES_DERNIER)}/PT10M</Dimension>`
          + `</Layer></Layer></Capability></WMS_Capabilities>` });
      return;
    }
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" }, body: pngDamier() });
  });
  await c.route(/api\.meteofrance\.fr\/pro\/piaf/, r => {
    const u = r.request().url();
    etat.appelsPiaf.push(u);
    const ent = { "Access-Control-Allow-Origin": "*" };
    if (!/[?&]apikey=[^&]{20,}/.test(u)) { r.fulfill({ status: 401, headers: ent, body: "" }); return; }
    if (/DescribeCoverage/.test(u)) {
      const bon = u.includes(`___${PIAF_REF}_PT15M`);
      r.fulfill({ status: bon ? 200 : 404, headers: ent, contentType: "application/xml", body: "<x/>" });
      return;
    }
    if (/GetCoverage/.test(u)) {
      const m = /subset=time\(([^)]+)\)/.exec(decodeURIComponent(u));
      if (!m || !u.includes(`___${PIAF_REF}_PT15M`)) { r.fulfill({ status: 404, headers: ent, body: "" }); return; }
      const v = piafCumul(Date.parse(m[1]), etat.profilPiaf);
      r.fulfill({ status: 200, headers: ent, contentType: "image/tiff", body: tiffDe(3, 3, Array(9).fill(v)) });
      return;
    }
    r.fulfill({ status: 200, headers: ent, contentType: "image/png", body: pngUni(...PIAF_TEINTE, 255) });
  });
  await c.route(/tilecache\.rainviewer\.com/, r => {
    const u = r.request().url();
    etat.appelsRadar.push(u);
    const m = /(\/v2\/radar\/[a-z0-9]+)\//.exec(u);
    const t = teinteRadar(m && m[1]);
    if (!t) { r.fulfill({ status: 404, body: "non" }); return; }
    /* Le service sert ses tuiles avec l'en-tête d'origine ouverte, mesuré le
       5 septembre 2026. Sans elle la toile serait souillée et ne se relirait
       plus au pixel, ni ici ni pour le compte à rebours de pluie du lot 4b. */
    /* La tuile de la mesure de déplacement porte un motif qui se déplace ; les
       autres restent unies, les contrôles de la couche lisant leur teinte. */
    const z = /\/256\/(\d+)\/(\d+)\/(\d+)\//.exec(u);
    const mesure = z && z[1] === "5" && z[2] === "16" && z[3] === "11";
    r.fulfill({ status: 200, contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: mesure ? pngMotif(t.r, t.g, t.b, 230, t.rang, 256, etat.radarFondPlein ? 230 : 0)
        : pngUni(t.r, t.g, t.b, 230) });
  });
};

/* La prévision immédiate PIAF de Météo-France, version 186. La dernière
   prévision servie date de 8 h 45, heure de Paris, un quart d'heure avant
   l'heure figée, comme le vrai service ; seule celle-là se décrit. Au point,
   un quart d'heure de pluie modérée, 0,8 mm, pour chaque quart d'heure qui
   finit entre 11 h 15 et 11 h 45 ; rien ailleurs. Les images de la carte
   sont unies, d'un violet que rien d'autre ne peint. */
export const PIAF_REF = "2026-08-18T06.45.00Z";
export const PIAF_TEINTE = [120, 40, 210];
export const tiffDe = (largeur, hauteur, valeurs) => {
  const n = 11, ifd = 8, donnees = ifd + 2 + n * 12 + 4;
  const b = Buffer.alloc(donnees + 8 * largeur * hauteur);
  b.write("II", 0, "latin1"); b.writeUInt16LE(42, 2); b.writeUInt32LE(ifd, 4); b.writeUInt16LE(n, ifd);
  const tags = [[256, 3, largeur], [257, 3, hauteur], [258, 3, 64], [259, 3, 1], [262, 3, 1], [273, 4, donnees],
    [277, 3, 1], [278, 3, hauteur], [279, 4, 8 * largeur * hauteur], [284, 3, 1], [339, 3, 3]];
  tags.forEach(([t, ty, v], k) => {
    const o = ifd + 2 + 12 * k;
    b.writeUInt16LE(t, o); b.writeUInt16LE(ty, o + 2); b.writeUInt32LE(1, o + 4);
    if (ty === 3) b.writeUInt16LE(v, o + 8); else b.writeUInt32LE(v, o + 8);
  });
  valeurs.forEach((v, k) => b.writeDoubleLE(v, donnees + 8 * k));
  return b;
};
export const piafCumul = (T, profil = "tard") => {
  const fin = (T - FIGE) / 60000;
  return profil === "tard" && fin >= 135 && fin <= 165 ? 0.8 : 0;
};

export const nouvelEtat = () => ({
  radarFutur: 0,
  radarFondPlein: false,
  appelsRadar: [],
  appelsFoudre: [],
  appelsAtmo: [],
  appelsNuages: [],
  appelsFeux: [],
  appelsAirTuiles: [],
  airTuilesPleines: false,
  atmoLent: 0,
  atmoMuet: false,
  foudreTeinte: false,
  profilPluie: "sec",
  appelsPluie: [],
  profilVoisins: null,
  appelsVoisins: [],
  profilRepli: "sec",
  accordRepli: Infinity,
  appelsRepli: [],
  appelsPays: [],
  appelsVig: [],
  appelsEns: [],
  appelsAir: [],
  profilAir: "base",
  appelsGrille: [],
  appelsArchive: [],
  appelsVigieau: [],
  appelsVilles: [],
  appelsPoint: [],
  appelsGeo: [],
  appelsPrevue: [],
  appelsPassee: [],
  appelsPasseeJours: [],
  appelsPiaf: [],
  profilPiaf: "tard",
  retardPasseeJours: 0,
  appelsMer: [],
  appelsPollens: [],
  appelsZones: [],
  appelsHubeau: [],
  appelsLieux: [],
  archiveMuette: false,
  appelsGrilleAir: [],
  bruineArome: null,
  retoucheGlobal: null,
  aromeMuet: false,
});

/* Un filet commun, posé le 30 septembre 2026 : tout contexte d'essai répond
   d'office « aucune restriction, aucun piézomètre » à VigiEau et à Hub'eau. Les
   contextes qui posent leurs propres faux services gardent les leurs, une route
   posée après passant devant. Sans ce filet, le contexte du temps calme
   interrogeait le vrai VigiEau et recevait la crise en vigueur ce jour-là. */
/* Filet de dernier rang, posé le 1er octobre 2026 : toute requête vers un
   autre hôte que le serveur d'essai, qu'aucune route n'a servie, est refusée
   et notée. Une passe relevait ce jour-là six requêtes réelles, trois vers
   OSRM depuis Grenoble et trois vers Météo-France. Posé avant les autres
   routes, il ne joue qu'en dernier ; le contrôle qui le juge est dans finir. */
export const envelopperNavigateur = nav => {
  const sortantes = [];
  const nouveauContexte = nav.newContext.bind(nav);
  nav.newContext = async (...a) => {
    const c = await nouveauContexte(...a);
    await c.route(/^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/, r => {
      const u = new URL(r.request().url());
      sortantes.push(`${u.host}${u.pathname}`);
      return r.abort();
    });
    await c.route(/api\.vigieau\.gouv\.fr|hubeau\.eaufrance\.fr/, r => r.fulfill({ status: 200, contentType: "application/json",
      body: r.request().url().includes("hubeau") ? '{"count":0,"data":[]}' : "[]" }));
    /* OSRM et Météo-France sont coupés d'office, comme les sources que la page
       principale coupe déjà : les durées de route se rabattent sur l'estimation
       à vol d'oiseau, la vigilance et la pluie dans l'heure se taisent. Une
       réponse 503 aurait laissé une erreur dans la console, qu'un contrôle
       refuse. Les contextes qui posent leurs faux services gardent les leurs. */
    await c.route(/router\.project-osrm\.org|webservice\.meteofrance\.com/, r => r.abort());
    return c;
  };
  return sortantes;
};
