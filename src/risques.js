/* Les risques de la commune, Géorisques, version 191, demande de Jérôme du
   11 octobre 2026.

   Géorisques, le service du ministère de la Transition écologique, sans clé,
   l'origine ouverte. Relevé le 11 octobre 2026 depuis le Mac :

   | Requête | Ce qu'elle rend |
   |---|---|
   | `gaspar/risques?code_insee=` | les risques recensés de la commune, familles à deux chiffres et détails à trois |
   | `gaspar/catnat?code_insee=&page_size=100` | les arrêtés de catastrophe naturelle depuis 1982 |
   | `zonage_sismique?code_insee=` | la zone sismique, de 1, très faible, à 5, forte |
   | `rga?latlon=lon,lat` | l'exposition au retrait-gonflement des argiles, ou rien hors des zones cartographiées |
   | `radon?code_insee=` | le potentiel radon, de 1 à 3 |

   Les plans de prévention, `gaspar/pprn`, ignorent la commune demandée et
   rendent toute la France : ils sont laissés de côté. Le code de la commune
   vient du service des communes, déjà employé par l'application. Ces risques
   ne changent pas d'un jour à l'autre : la lecture se garde trente jours. */

import { chercherEn, lireGardee, ecrireGardee } from "./horloge.js";
import { envoi } from "./reglages.js";

export const SERVICE = "https://georisques.gouv.fr/api/v1";
export const COMMUNES = "https://geo.api.gouv.fr/communes";
const TABLE = "mameteo.risques.v1";
const GARDE = 30 * 86400000;

export const SEISMES = ["très faible", "faible", "modérée", "moyenne", "forte"];
export const RADON = ["faible", "moyen", "significatif"];
export const ARGILES = ["nulle", "faible", "moyenne", "forte"];

/* Les risques recensés, chaque famille avec ses détails. */
export function lireRisques(d) {
  const det = d?.data?.[0]?.risques_detail;
  if (!Array.isArray(det)) return null;
  const familles = [];
  for (const r of det) {
    const num = String(r.num_risque || "");
    if (num.length <= 2) familles.push({ num, nom: r.libelle_risque_long, details: [] });
    else {
      const f = familles.find(x => num.startsWith(x.num));
      if (f) f.details.push(r.libelle_risque_long);
    }
  }
  return familles;
}

/* Les arrêtés de catastrophe naturelle : leur nombre, par type, et les plus
   récents d'abord. Les dates du service s'écrivent jour, mois, année. */
const iso = d => String(d || "").split("/").reverse().join("-");
export function lireCatnat(d) {
  const l = Array.isArray(d?.data) ? d.data : null;
  if (!l) return null;
  const parType = {};
  for (const x of l) parType[x.libelle_risque_jo] = (parType[x.libelle_risque_jo] || 0) + 1;
  const tries = l.map(x => ({ type: x.libelle_risque_jo, debut: iso(x.date_debut_evt), fin: iso(x.date_fin_evt) }))
    .sort((a, b) => b.debut.localeCompare(a.debut));
  return { n: Number.isFinite(d.results) ? d.results : l.length, parType, derniers: tries.slice(0, 3) };
}
export const lireSeisme = d => { const z = Number(d?.data?.[0]?.code_zone); return z >= 1 && z <= 5 ? z : null; };
export const lireRadon = d => { const z = Number(d?.data?.[0]?.classe_potentiel); return z >= 1 && z <= 3 ? z : null; };
export const lireArgiles = d => { const z = Number(d?.codeExposition); return z >= 0 && z <= 3 ? z : null; };

async function json(fetcheur, u) {
  try {
    const r = await fetcheur(u);
    if (!r.ok) return null;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  } catch { return null; }
}

/* Le code de la commune qui contient le point. */
export async function codeDe(lat, lon, fetcheur) {
  const d = await json(fetcheur, `${COMMUNES}?lat=${envoi(lat)}&lon=${envoi(lon)}&fields=code,nom`);
  return Array.isArray(d) && d[0]?.code ? { code: d[0].code, nom: d[0].nom } : null;
}

const memoire = new Map();
/* Une lecture en cours sert aussi aux appels qui arrivent pendant elle :
   l'accueil se redessine plusieurs fois avant la première réponse. */
const enCours = new Map();
export function charger(g, fetcheur = chercherEn(15000)) {
  if (!Number.isFinite(g?.lat) || !Number.isFinite(g?.lon)) return Promise.resolve(null);
  const cleLieu = `${envoi(g.lat)},${envoi(g.lon)}`;
  if (memoire.has(cleLieu)) return Promise.resolve(memoire.get(cleLieu));
  if (!enCours.has(cleLieu)) enCours.set(cleLieu, lireLieu(g, cleLieu, fetcheur).finally(() => enCours.delete(cleLieu)));
  return enCours.get(cleLieu);
}
async function lireLieu(g, cleLieu, fetcheur) {
  const gardee = lireGardee(TABLE, cleLieu, GARDE);
  if (gardee && gardee.d) return gardee.d;
  const c = await codeDe(g.lat, g.lon, fetcheur);
  if (!c) return null;
  const [ri, ca, se, ra, ar] = await Promise.all([
    json(fetcheur, `${SERVICE}/gaspar/risques?code_insee=${c.code}`),
    json(fetcheur, `${SERVICE}/gaspar/catnat?code_insee=${c.code}&page_size=100`),
    json(fetcheur, `${SERVICE}/zonage_sismique?code_insee=${c.code}`),
    json(fetcheur, `${SERVICE}/radon?code_insee=${c.code}`),
    json(fetcheur, `${SERVICE}/rga?latlon=${envoi(g.lon)},${envoi(g.lat)}`),
  ]);
  const d = { code: c.code, commune: c.nom, risques: lireRisques(ri), catnat: lireCatnat(ca),
    seisme: lireSeisme(se), radon: lireRadon(ra), argiles: lireArgiles(ar) };
  if (!d.risques && !d.catnat && d.seisme === null) return null;
  memoire.set(cleLieu, d);
  ecrireGardee(TABLE, cleLieu, { t: Date.now(), d }, GARDE);
  return d;
}

/* La ligne de la porte de l'accueil : les deux premières familles de
   risques et la zone sismique. */
export function resume(d) {
  if (!d) return null;
  /* La famille du séisme se tait quand la zone sismique est connue : elle
     dirait deux fois la même chose. */
  const f = (d.risques || []).filter(x => !(d.seisme && x.num === "13")).map(x => x.nom).slice(0, 2);
  const s = d.seisme ? `sismicité ${SEISMES[d.seisme - 1]}` : null;
  const t = [...f, s].filter(Boolean).join(", ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

/* Ce qui est déjà gardé pour un lieu, sans rien demander. */
export const garde = g => (!Number.isFinite(g?.lat) ? null
  : memoire.get(`${envoi(g.lat)},${envoi(g.lon)}`) || lireGardee(TABLE, `${envoi(g.lat)},${envoi(g.lon)}`, GARDE)?.d || null);
