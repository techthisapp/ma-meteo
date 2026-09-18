/* L'indice officiel de la qualité de l'air.

   Les associations agréées de surveillance, réunies sous Atmo France, publient
   chaque jour l'indice ATMO par commune, avec les cinq sous-indices qui le
   composent : dioxyde d'azote, ozone, particules, particules fines, dioxyde de
   soufre. Le service est ouvert, sans clé ni compte, en licence ODbL, et rend
   l'origine demandée.

   Pourquoi cette source en plus de Copernicus, mesuré le 14 septembre 2026.
   Sur soixante communes tirées au sort, les deux tombent dans la même classe
   neuf fois sur dix : ce n'est pas un désaccord de fond. Mais les cartes
   diffèrent beaucoup, parce que les deux indices ne se composent pas de la même
   façon. L'indice ATMO retient le pire de ses sous-indices ; l'indice européen
   de Copernicus fait autrement. Ce jour-là, Saint-Étienne était classée
   mauvaise par l'indice officiel avec un indice européen de 27, plus bas que
   celui de Paris classé moyen. C'est la règle de composition qui fait
   l'écart, non la qualité des modèles.

   Ce que le service coûte, mesuré le même jour sur trois communes : entre vingt
   et vingt-huit secondes par requête, et des 503 ou 504 par moments. D'où la
   forme retenue : l'écran de l'air s'ouvre avec Copernicus, qui répond en une
   fraction de seconde, et l'indice officiel vient s'y ajouter quand il arrive.
   Rien n'attend après lui. La garde est d'une demi-journée, l'indice n'étant
   publié qu'une fois par jour, vers quatorze heures.

   La zone rendue n'est pas toujours la commune demandée : à Avignon, le service
   rend l'agglomération ; à Fain-lès-Moutiers, la zone la plus proche porte le
   nom d'une commune voisine. Le nom affiché est donc celui que la source donne,
   jamais celui de la commune choisie, sous peine d'annoncer un chiffre sous un
   mauvais nom. La distance au point demandé est gardée pour que la feuille
   puisse la dire. */

const SERVICE = "https://data.atmo-france.org/geoserver/ind/ows";
const COUCHE = "ind:ind_atmo";
const CACHE = "mameteo.atmo.v1";

// Une demi-journée : l'indice est publié une fois par jour, vers quatorze heures.
export const GARDE = 12 * 3600 * 1000;

/* Le délai au bout duquel la lecture est abandonnée. Le service a mis jusqu'à
   vingt-huit secondes ; au delà, la feuille reste sur Copernicus seul. */
export const DELAI = 35000;

/* Le rayon de recherche. La couche porte un point par zone, non son contour :
   quinze kilomètres attrapent la zone d'une commune isolée sans ramener la
   moitié d'un département. */
export const RAYON = 15000;

/* Les six niveaux de l'échelle ATMO, du bon à l'extrêmement mauvais. Ce sont
   ceux de l'arrêté qui fixe l'indice ; aucun seuil n'est inventé ici. */
export const NIVEAUX = [
  [1, "bon", "#50F0E6"],
  [2, "moyen", "#50CCAA"],
  [3, "dégradé", "#F0E641"],
  [4, "mauvais", "#FF5050"],
  [5, "très mauvais", "#960032"],
  [6, "extrêmement mauvais", "#7D2181"],
];

/* Les cinq sous-indices, dans l'ordre où ils se lisent. Les particules d'abord,
   ce sont elles qui décident le plus souvent ; l'ozone ensuite, qui décide
   l'été ; puis les polluants de trafic et d'industrie. C'est l'ordre déjà
   retenu pour les polluants de Copernicus, pour que les deux cartes de la
   feuille se lisent de la même façon. */
export const SOUS = [
  ["pm25", "Particules fines", "PM2,5", "code_pm25"],
  ["pm10", "Particules", "PM10", "code_pm10"],
  ["o3", "Ozone", "O₃", "code_o3"],
  ["no2", "Dioxyde d'azote", "NO₂", "code_no2"],
  ["so2", "Dioxyde de soufre", "SO₂", "code_so2"],
];

export const niveauDe = c => {
  if (!Number.isFinite(c)) return null;
  const n = NIVEAUX.find(x => x[0] === Math.round(c));
  return n ? { code: n[0], nom: n[1], couleur: n[2] } : null;
};

const RAYON_TERRE = 6378137;
export const enMercator = (lat, lon) => [
  RAYON_TERRE * (lon * Math.PI / 180),
  RAYON_TERRE * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)),
];

export const jourDe = (t = Date.now()) => {
  const d = new Date(t);
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function adresse(lat, lon, jour = jourDe()) {
  const [x, y] = enMercator(lat, lon);
  const champs = ["code_qual", "lib_qual", "lib_zone", "type_zone", "date_ech",
    "source", "x_wgs84", "y_wgs84", ...SOUS.map(s => s[3])].join(",");
  const filtre = `date_ech='${jour}' AND DWITHIN(the_geom,`
    + `POINT(${x.toFixed(0)} ${y.toFixed(0)}),${RAYON},meters)`;
  const p = new URLSearchParams({
    service: "WFS", version: "2.0.0", request: "GetFeature",
    typeName: COUCHE, outputFormat: "application/json", count: "30",
    propertyName: champs, CQL_FILTER: filtre,
  });
  return `${SERVICE}?${p}`;
}

/* La zone la plus proche du point demandé, parmi celles que le rayon a
   ramenées. Le service n'ordonne pas par distance et la première rendue peut
   être à quinze kilomètres quand une autre est à deux. */
export function plusProche(elements, lat, lon) {
  let bon = null;
  for (const e of elements || []) {
    const p = e?.properties;
    if (!p || !Number.isFinite(p.x_wgs84) || !Number.isFinite(p.y_wgs84)) continue;
    if (!Number.isFinite(p.code_qual)) continue;
    const dlat = (p.y_wgs84 - lat) * 111.32;
    const dlon = (p.x_wgs84 - lon) * 111.32 * Math.cos(lat * Math.PI / 180);
    const d = Math.sqrt(dlat * dlat + dlon * dlon);
    if (!bon || d < bon.km) bon = { km: d, p };
  }
  if (!bon) return null;
  const sous = {};
  for (const [cle, , , colonne] of SOUS) {
    const v = bon.p[colonne];
    sous[cle] = Number.isFinite(v) ? Math.round(v) : null;
  }
  return {
    code: Math.round(bon.p.code_qual),
    libelle: bon.p.lib_qual || null,
    zone: bon.p.lib_zone || null,
    typeZone: bon.p.type_zone || null,
    jour: bon.p.date_ech || null,
    source: bon.p.source || null,
    km: Math.round(bon.km * 10) / 10,
    sous,
  };
}

let charge = null;
let cleChargee = null;
export const chargeCourante = () => charge;
export function oublier() { charge = null; cleChargee = null; }

/* Lit l'indice officiel pour un point, ou rend `null`. Une lecture qui échoue
   ne prive de rien : l'air de Copernicus est déjà à l'écran, et la feuille se
   lit sans cette carte. */
export async function charger({ lat, lon }, fetcheur = fetch) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { oublier(); return null; }
  const jour = jourDe();
  const cle = `${lat.toFixed(3)},${lon.toFixed(3)}|${jour}`;
  if (cleChargee !== cle) { charge = null; cleChargee = cle; }
  if (charge) return charge;

  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || "null");
    if (c && c.cle === cle && Date.now() - c.t < GARDE) { charge = c.d; return charge; }
  } catch { /* cache indisponible */ }

  let d = null;
  try {
    const stop = new AbortController();
    const minuteur = setTimeout(() => stop.abort(), DELAI);
    const r = await fetcheur(adresse(lat, lon, jour), { signal: stop.signal });
    clearTimeout(minuteur);
    if (r.ok) {
      const j = await r.json();
      d = plusProche(j?.features, lat, lon);
    }
  } catch { d = null; }
  charge = d;
  if (d) {
    try { localStorage.setItem(CACHE, JSON.stringify({ cle, t: Date.now(), d })); }
    catch { /* quota atteint, la garde n'est pas indispensable */ }
  }
  return d;
}
