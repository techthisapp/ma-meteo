/* Pluie mesurée aux postes de Météo-France.

   Jeu « Données climatologiques de base, quotidiennes » sur data.gouv.fr,
   identifiant `6569b51ae64326786e4e8e1a`, servi par le seau
   `object.files.data.gouv.fr/meteofrance`.

   Adresses vérifiées le 19 août 2026 depuis un navigateur, en origine croisée :

   - `data/stations/stations_21.geojson`, 221 postes pour la Côte-d'Or, avec
     leurs coordonnées. C'est ce fichier qui sert au rattachement.
   - `data/synchro_ftp/BASE/QUOT/Q_21_latest-2025-2026_RR-T-Vent.csv.gz`,
     331 ko compressés, 2,1 Mo décompressés, 13 277 lignes, un fichier par
     département et par période.

   Le rattachement passe par le geojson et non par le CSV : lire deux mégaoctets
   pour trouver le poste le plus proche, puis les relire pour ses relevés, coûtait
   deux fois le même téléchargement.

   Dans « Mon jardin », ce fichier était lu par une fonction de bord et le poste
   était rattaché en base. Ici tout se fait dans le navigateur. */

import { json, texteGzip } from "./reseau.js";

const SEAU = "https://object.files.data.gouv.fr/meteofrance";
const STATIONS = `${SEAU}/data/stations`;
const QUOT = `${SEAU}/data/synchro_ftp/BASE/QUOT`;
const CACHE = "mameteo.postes.v2";
const TTL = 6 * 3600 * 1000;

// Distance à vol d'oiseau entre deux points, en kilomètres.
export const distanceKm = (la, lo, lb, ob) => {
  const r = Math.PI / 180;
  return 6371 * Math.acos(Math.min(1,
    Math.sin(la * r) * Math.sin(lb * r)
    + Math.cos(la * r) * Math.cos(lb * r) * Math.cos((ob - lo) * r)));
};

/* Le nom du poste est écrit en capitales dans la source, avec des suffixes de
   réseau qui n'apprennent rien : « BRETENIERES_INRAE » devient
   « Bretenieres ». */
export const libellePoste = nom =>
  String(nom || "").replace(/_[A-Z0-9]+$/, "").toLowerCase()
    .replace(/(^|[\s'-])([a-zà-ÿ])/g, (m, s, c) => s + c.toUpperCase());

/* La période du nom de fichier. Le jeu bascule d'une année sur l'autre, la forme
   observée est `latest-2025-2026`. Trois formes sont essayées, la période
   courante étant calée sur l'année civile en cours et la suivante. */
function adresses(dep) {
  const a = new Date().getFullYear();
  return [`${a - 1}-${a}`, `${a}-${a + 1}`, `${a - 2}-${a - 1}`]
    .map(p => `${QUOT}/Q_${dep}_latest-${p}_RR-T-Vent.csv.gz`);
}

/* Le poste le plus proche, lu dans le geojson départemental. Les coordonnées y
   sont des chaînes, non des nombres, et `DATFERM` porte la date de fermeture
   quand le poste n'est plus en service. */
async function plusProche(dep, lat, lon, rayonKm) {
  const d = await json(`${STATIONS}/stations_${dep}.geojson`);
  let meilleur = null;
  for (const f of d.features || []) {
    const p = f.properties || {};
    if (p.DATFERM) continue;
    const [lo, la] = (f.geometry?.coordinates || []).map(Number);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const km = distanceKm(lat, lon, la, lo);
    if (km > rayonKm) continue;
    if (!meilleur || km < meilleur.km) {
      meilleur = { num: p.NUM_POSTE, nom: p.NOM_USUEL, commune: p.COMMUNE,
                   lat: la, lon: lo, alti: Number(p.ALTI) || null,
                   km: Math.round(km * 10) / 10 };
    }
  }
  return meilleur;
}

/* L'étendue réellement couverte par un fichier, tous postes confondus. Elle sert
   à dire pourquoi la comparaison est vide quand elle l'est.

   Relevé le 19 août 2026 : les fichiers `Q_21` et `Q_33` portaient des mesures
   jusqu'au 22 juin et n'avaient pas été modifiés depuis le 24 juin. Le seau
   `data/synchro_ftp` n'est plus alimenté, contrairement à ce que décrivait le
   document de reprise de « Mon jardin ». */
function etendue(csv) {
  const lignes = csv.split("\n");
  const tete = (lignes[0] || "").split(";").map(c => c.trim().toUpperCase());
  const iJour = tete.indexOf("AAAAMMJJ");
  if (iJour < 0) return null;
  let min = null, max = null;
  for (let k = 1; k < lignes.length; k++) {
    const j = lignes[k].split(";")[iJour];
    if (!j || j.length !== 8) continue;
    if (min === null || j < min) min = j;
    if (max === null || j > max) max = j;
  }
  const iso = j => (j ? `${j.slice(0, 4)}-${j.slice(4, 6)}-${j.slice(6, 8)}` : null);
  return min ? { debut: iso(min), fin: iso(max) } : null;
}

/* Les relevés d'un poste sur la fenêtre demandée.

   L'en-tête réel est
   `NUM_POSTE;NOM_USUEL;LAT;LON;ALTI;AAAAMMJJ;RR;QRR;TN;...`, la lame de pluie
   étant en septième colonne et son code qualité en huitième. Une valeur douteuse
   ou filtrée, c'est-à-dire de code qualité supérieur à 1, n'entre pas dans la
   lecture. */
function relevesDe(csv, num, depuis) {
  const lignes = csv.split("\n");
  const tete = (lignes[0] || "").split(";").map(c => c.trim().toUpperCase());
  const iNum = tete.indexOf("NUM_POSTE");
  const iJour = tete.indexOf("AAAAMMJJ");
  const iRR = tete.indexOf("RR");
  const iQ = tete.indexOf("QRR");
  const out = new Map();
  if (iNum < 0 || iJour < 0 || iRR < 0) return out;
  const borne = depuis.replace(/-/g, "");

  for (let k = 1; k < lignes.length; k++) {
    const c = lignes[k].split(";");
    if (c.length <= iRR || c[iNum] !== num) continue;
    const j = c[iJour];
    if (!j || j < borne) continue;
    const q = iQ >= 0 ? Number(c[iQ]) : 0;
    if (Number.isFinite(q) && q > 1) continue;
    const rr = Number(String(c[iRR]).replace(",", "."));
    if (!Number.isFinite(rr)) continue;
    out.set(`${j.slice(0, 4)}-${j.slice(4, 6)}-${j.slice(6, 8)}`, rr);
  }
  return out;
}

/* Rend `{ etat, poste, pluie, etendue }`.

   `etat` vaut :
   - « ok », le poste publie sur la fenêtre demandée ;
   - « perime », le fichier existe mais s'arrête avant la fenêtre, ce qui est le
     cas depuis que la synchronisation du seau s'est interrompue ;
   - « aucun », aucun poste ouvert à portée ;
   - « indisponible », la source n'est pas atteignable. */
export async function charger({ departement, lat, lon, rayonKm = 40, jours = 14 }) {
  if (!departement) return { etat: "aucun", poste: null, pluie: new Map() };
  const cle = `${CACHE}.${departement}`;
  /* Le poste publie avec deux jours de retard : la fenêtre est élargie pour que
     la comparaison porte bien sur quatorze jours mesurés. */
  const depuis = new Date(Date.now() - (jours + 4) * 86400000).toISOString().slice(0, 10);

  try {
    const c = JSON.parse(sessionStorage.getItem(cle) || "null");
    if (c && Date.now() - c.t < TTL) {
      return { etat: c.etat, poste: c.poste, pluie: new Map(c.pluie || []), etendue: c.etendue };
    }
  } catch { /* stockage indisponible */ }

  let poste = null;
  try {
    poste = await plusProche(departement, lat, lon, rayonKm);
  } catch {
    return { etat: "indisponible", poste: null, pluie: new Map(), etendue: null };
  }
  if (!poste) {
    const vide = { etat: "aucun", poste: null, pluie: [], etendue: null };
    try { sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), ...vide })); } catch {}
    return { ...vide, pluie: new Map() };
  }

  let csv = null;
  for (const u of adresses(departement)) {
    try { csv = await texteGzip(u); break; }
    catch { /* forme suivante */ }
  }
  if (csv === null) return { etat: "indisponible", poste, pluie: new Map(), etendue: null };

  let pluie = relevesDe(csv, poste.num, depuis);

  /* Un poste peut être ouvert sans publier de lame. Le deuxième plus proche
     prend alors le relais, une seule fois : au delà, le département n'a rien à
     dire sur cette fenêtre. */
  if (!pluie.size) {
    const tete = csv.split("\n", 1)[0].split(";").map(c => c.trim().toUpperCase());
    const iNum = tete.indexOf("NUM_POSTE");
    const publiants = new Set();
    for (const l of csv.split("\n")) {
      const c = l.split(";");
      if (c.length > iNum) publiants.add(c[iNum]);
    }
    try {
      const d = await json(`${STATIONS}/stations_${departement}.geojson`);
      let second = null;
      for (const f of d.features || []) {
        const p = f.properties || {};
        if (p.DATFERM || p.NUM_POSTE === poste.num || !publiants.has(p.NUM_POSTE)) continue;
        const [lo, la] = (f.geometry?.coordinates || []).map(Number);
        if (!Number.isFinite(la)) continue;
        const km = distanceKm(lat, lon, la, lo);
        if (km > rayonKm) continue;
        if (!second || km < second.km) {
          second = { num: p.NUM_POSTE, nom: p.NOM_USUEL, commune: p.COMMUNE,
                     lat: la, lon: lo, alti: Number(p.ALTI) || null,
                     km: Math.round(km * 10) / 10 };
        }
      }
      if (second) { poste = second; pluie = relevesDe(csv, second.num, depuis); }
    } catch { /* le geojson a déjà été lu une fois, l'échec ici n'est pas bloquant */ }
  }

  poste = { ...poste, libelle: libellePoste(poste.nom) };
  const cadre = etendue(csv);
  /* Un fichier qui s'arrête avant la fenêtre demandée n'est pas un poste
     silencieux : c'est une source qui n'est plus alimentée. Le distinguer permet
     à l'affichage de dire lequel des deux, plutôt que d'accuser le poste. */
  const etat = pluie.size ? "ok" : (cadre && cadre.fin < depuis ? "perime" : "aucun");
  const res = { etat, poste, pluie: [...pluie], etendue: cadre };
  try { sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), ...res })); } catch {}
  return { ...res, pluie };
}
