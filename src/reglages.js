/* Réglages, en stockage local. Commune courante, communes suivies, écriture
   retenue pour l'écran du temps. Ni compte, ni base, ni service dorsal. */

import { chercher, departementDe } from "./horloge.js";

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
  ciel: "soleil",      // écran ouvert dans la destination Le ciel
  poste: null,         // numéro du poste de mesure retenu
  suivies: [],         // communes suivies, la courante comprise
  auto: false,         // le lieu courant suit la position de l'appareil
  position: null,      // dernier relevé : commune, codePostal, lat, lon, t
  alertes: null,       // instants d'alerte du parapluie, au pas de la demi-heure
  jetonsPris: [],      // jetons de parapluie déjà pris, par date et instant
  biais: 0,            // ressenti personnel, en degrés, borné
  pollensMuets: [],    // pollens dont on ne veut pas être averti
  radar: true,         // ancien réglage de la couche de pluie, repris par `nappe`
  vigicarte: true,     // la couche de vigilance sur la carte
  ventcarte: false,    // les particules de vent sur la carte
  foudrecarte: true,   // la foudre observée par satellite sur la carte
  nuagescarte: false,  // les nuages vus du satellite sur la carte
  feuxcarte: false,    // les foyers vus par satellite sur la carte
  previcarte: false,   // les prévisions des villes sur la carte, jalon 18
  plagecarte: false,   // la mer des plages sur la carte, jalon 18
  neigecarte: false,   // la neige des grands domaines sur la carte, jalon 18
  rivierecarte: false, // les hauteurs des cours d'eau sur la carte, jalon 18
  // Ni `nappe` ni `pluiecarte` n'ont de valeur par défaut : c'est leur absence
  // qui déclenche la reprise des anciens réglages, `radar` puis `nappe`.
};

let etat = { ...DEFAUT };

try {
  const brut = JSON.parse(localStorage.getItem(CLE) || "null");
  if (brut && typeof brut === "object") etat = { ...DEFAUT, ...brut };
} catch { /* stockage indisponible, les valeurs par défaut suffisent */ }

/* Deux instants d'alerte croissants dans la journée, au pas de la demi-heure.
   Une forme abîmée retombe sur la valeur par défaut plutôt que de faire
   paraître un jeton à une heure absurde. */
const estDemie = h => Number.isFinite(h) && h * 2 === Math.round(h * 2);
function estAlertes(v) {
  return Array.isArray(v) && v.length === 2 && v.every(estDemie)
    && v[0] >= 0 && v[0] < v[1] && v[1] < 24;
}

/* La position publique de l'appareil, celle que reçoivent les services, au
   centième de degré : un kilomètre environ, la maille des modèles de
   prévision. Le relevé au dix-millième désignait la maison. Audit du
   1er octobre 2026, constat 2.2. */
export const envoi = v => Math.round(v * 100) / 100;

/* Clé d'un lieu : ses coordonnées arrondies au dix-millième, soit une dizaine
   de mètres. Deux entrées de la même commune ne peuvent pas coexister. */
export const cleLieu = l => (l && l.lat !== null && l.lon !== null)
  ? `${Number(l.lat).toFixed(4)},${Number(l.lon).toFixed(4)}` : null;

/* `nom` est le nom donné au lieu par l'utilisateur, depuis la version 147,
   demande de Jérôme du 3 octobre 2026 : « Maison » plutôt que la commune. Il
   s'affiche à la place de la commune ; la commune reste écrite dessous. */
const nu = l => ({
  commune: l.commune, codePostal: l.codePostal ?? null, departement: l.departement ?? null,
  lat: l.lat, lon: l.lon, nom: l.nom || null,
});
/* Le nom à afficher d'un lieu : celui qu'on lui a donné, sinon sa commune. */
export const nomAffiche = l => (l && (l.nom || l.commune)) || null;

/* Le département d'une commune, tel que le service d'adresses le donne en tête
   de son contexte, « 74, Haute-Savoie, Auvergne-Rhône-Alpes ». Le code postal
   ne le dit pas toujours : un bureau distributeur dessert parfois des communes
   d'un département voisin, vingt-six communes en tout, qui recevaient la
   vigilance d'un autre département. La règle du code postal ne sert plus que
   de secours, pour une commune enregistrée avant la version 130. Audit du
   1er octobre 2026, constat 1.7. */
const depDe = contexte => {
  const c = String(contexte || "").split(",")[0].trim().toUpperCase();
  return /^(\d{2,3}|2A|2B)$/.test(c) ? c : null;
};
export const departementDu = l => l?.departement || departementDe(l?.codePostal);

/* Reprise des réglages écrits avant les communes suivies : la commune courante
   ouvre la liste, sinon l'application paraîtrait avoir tout oublié. */
if (!Array.isArray(etat.suivies)) etat.suivies = [];
// Les moments ont quitté l'écran du temps : un réglage ancien y menait au vide.
if (etat.ecriture !== "ruban" && etat.ecriture !== "liste") etat.ecriture = "ruban";
if (typeof etat.auto !== "boolean") etat.auto = false;
if (etat.auto && !etat.position) etat.auto = false;
/* Reprise des réglages écrits avant la version 123 : le relevé précis passe
   dans `releve`, et la position publique s'arrondit au kilomètre. */
if (etat.position && !etat.releve) {
  etat.releve = { lat: etat.position.lat, lon: etat.position.lon };
  etat.position = { ...etat.position, lat: envoi(etat.position.lat), lon: envoi(etat.position.lon) };
  if (etat.auto) { etat.lat = etat.position.lat; etat.lon = etat.position.lon; }
}
/* En mode position, le lieu courant n'est pas une commune choisie : le reprendre
   dans la liste y ferait entrer une commune que personne n'a demandée. */
if (!etat.suivies.length && etat.lat !== null && !etat.auto) etat.suivies = [nu(etat)];

/* Les instants d'alerte et les jetons pris viennent avec le rappel de
   parapluie : un réglage écrit avant lui ne les porte pas.

   La première version du rappel gardait deux plages de sortie, `[[7.5, 9],
   [17, 19]]`, avant que les heures ne deviennent des instants d'alerte. Un
   réglage de cette forme se reprend par le début de chaque plage, qui est bien
   le moment où l'on sortait, plutôt que d'être jeté en silence. */
if (!Array.isArray(etat.jetonsPris)) etat.jetonsPris = [];
if (Array.isArray(etat.sorties)) {
  const repris = etat.sorties.map(f => (Array.isArray(f) ? f[0] : f));
  if (!estAlertes(etat.alertes) && estAlertes(repris)) etat.alertes = repris;
  delete etat.sorties;
}
if (!estAlertes(etat.alertes)) etat.alertes = null;

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

/* Poser une commune la rend courante et l'ajoute à la liste si elle en manque.
   Choisir une commune vaut donc suivi : personne ne cherche une commune pour
   ne pas la garder, et rien n'oblige à la garder ensuite. */
export function poserLieu(l) {
  const c = cleLieu(l);
  if (!c) return lire();
  const reste = etat.suivies.filter(x => cleLieu(x) !== c);
  const liste = [nu(l), ...reste].slice(0, MAX_SUIVIES);
  etat = { ...etat, ...nu(l), poste: null, suivies: liste, auto: false, retour: null };
  ecrire();
  return lire();
}

/* ---------- Consultation d'un lieu ----------

   Jalon 19, lot 4, décision de Jérôme du 2 octobre 2026 : un point touché sur
   la carte s'ouvre en consultation, sans changer la commune suivie. Le lieu
   consulté devient le lieu courant, que tout l'écran lit, sans entrer dans la
   liste des lieux ; le lieu d'avant est gardé dans `retour`, que « Revenir »
   rétablit et que « Suivre ce lieu » oublie après avoir ajouté le lieu à la
   liste. Choisir une commune ou sa position met fin à la consultation. */
const CHAMPS_LIEU = ["commune", "codePostal", "departement", "lat", "lon", "nom", "poste", "auto"];
export const consultation = () => (etat.retour ? { ...etat.retour } : null);
export function consulter(l) {
  if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lon)) return lire();
  const retour = etat.retour || Object.fromEntries(CHAMPS_LIEU.map(k => [k, etat[k] ?? null]));
  etat = { ...etat, ...nu(l), poste: null, auto: false, retour };
  ecrire();
  return lire();
}
export function revenir() {
  if (!etat.retour) return lire();
  etat = { ...etat, ...etat.retour, retour: null };
  ecrire();
  return lire();
}
export function suivreConsulte() {
  if (!etat.retour) return lire();
  return poserLieu(nu(etat));
}

/* ---------- Ma position ----------

   Une entrée de plus dans la liste, épinglée en tête et jamais retirée : elle
   ne nomme pas un lieu mais l'appareil. La choisir relève la position, la
   nomme par l'interface adresse, et la prévision suit. Le dernier relevé est
   gardé pour que la liste s'ouvre sur une température plutôt que sur un vide,
   et pour que l'application reste lisible hors ligne. */

export const enPosition = () => etat.auto === true;
export const position = () => (etat.position ? { ...etat.position } : null);
/* Le relevé précis, au dix-millième de degré, ne quitte pas l'appareil : il ne
   sert qu'à savoir si l'appareil a bougé. */
export const releve = () => (etat.releve ? { ...etat.releve } : null);

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
  const releve = { lat: Math.round(p.lat * 10000) / 10000, lon: Math.round(p.lon * 10000) / 10000 };
  /* Sans nom rendu par l'interface adresse, le nom précédent n'est repris que
     si la position n'a pas bougé de plus de deux kilomètres. Au delà, il
     désignerait une autre commune. */
  const proche = ecart(etat.releve ?? etat.position, releve) < 2000;
  const commune = p.commune ?? (proche ? etat.position?.commune ?? null : null);
  const codePostal = p.commune
    ? (p.codePostal ?? null)
    : (proche ? etat.position?.codePostal ?? null : null);
  const departement = p.commune
    ? (p.departement ?? null)
    : (proche ? etat.position?.departement ?? null : null);
  const lat = envoi(releve.lat), lon = envoi(releve.lon);
  const pos = { commune, codePostal, departement, lat, lon, t: Date.now() };
  etat = { ...etat, auto: true, position: pos, releve, commune, codePostal, departement, lat, lon, nom: null, poste: null, retour: null };
  ecrire();
  return lire();
}

/* Relève la position et la nomme. Un nom qui manque n'empêche rien : la
   prévision se lit sur les coordonnées. */
export async function releverPosition() {
  const { lat, lon } = await geolocaliser();
  const l = await communeDe(lat, lon);
  return poserPosition({ ...(l || {}), lat, lon });
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

/* Renommer un lieu suivi. Un nom vide rend au lieu le nom de sa commune. Le
   lieu courant prend le nouveau nom aussitôt. */
export const NOM_MAX = 40;
export function renommerSuivie(cle, nom) {
  const n = String(nom ?? "").trim().replace(/\s+/g, " ").slice(0, NOM_MAX) || null;
  const i = etat.suivies.findIndex(l => cleLieu(l) === cle);
  if (i < 0) return lire();
  const l = etat.suivies[i];
  const propre = n && n !== l.commune ? n : null;
  const out = [...etat.suivies];
  out[i] = { ...l, nom: propre };
  etat = { ...etat, suivies: out };
  if (!etat.auto && cleLieu(etat) === cle) etat.nom = propre;
  ecrire();
  return lire();
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
      etat = { ...etat, auto: true, nom: null, commune: p.commune, codePostal: p.codePostal,
        departement: p.departement ?? null, lat: p.lat, lon: p.lon, poste: null };
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

/* Les écrans de la destination Le ciel. Le soleil ouvre : il parle de la journée
   en cours, quand la Lune parle d'un cycle qui déborde la journée.

   Le choix se garde, comme l'écriture de la page « Heure par heure » : revenir sur Le ciel
   doit rendre l'écran qu'on regardait, non recommencer au premier. Les étoiles
   s'ajouteront ici au jalon 9 ; un segment qui ne mènerait nulle part
   maintenant serait une promesse que l'application ne tient pas. */
export const ECRANS_CIEL = [["soleil", "Soleil"], ["lune", "Lune"], ["etoiles", "Étoiles"]];
export const ciel = () => (ECRANS_CIEL.some(([c]) => c === etat.ciel) ? etat.ciel : "soleil");
export function poserCiel(e) {
  if (!ECRANS_CIEL.some(([c]) => c === e)) return;
  poser({ ciel: e });
}

/* La nappe de la carte. Une seule à la fois : ce sont des étalements de couleur
   sur toute la surface, et deux superposés ne se liraient ni l'un ni l'autre.
   Aucune au départ, la pluie tenant désormais sa place au-dessus.

   La pluie a longtemps figuré dans cette liste. Elle en est sortie le
   19 septembre 2026 : mesurée sur les images radar un jour de pluie, elle ne
   couvre que 19 % de la tuile de la France au zoom cinq et 14 % de la vue au
   zoom six, donc elle laisse voir ce qui est dessous, comme la foudre et les
   nuages. La raison écrite pour l'y mettre, un étalement sur toute la surface,
   ne valait pas pour elle ; c'était un héritage du temps où elle était la seule
   couche de la carte.

   Deux réglages d'avant se reprennent. La version la plus ancienne ne portait
   qu'un booléen de pluie ; celle d'ensuite écrivait `nappe: "pluie"`. Dans les
   deux cas la pluie s'allume et la nappe reste absente. */
/* Les restrictions d'eau, VigiEau, rejoignent les nappes le 30 septembre
   2026 : elles teintent tout un département, comme un étalement. */
/* Les nappes de la grille prévue rejoignent la liste le 3 octobre 2026, jalon
   19, lot 5 : oubliées ici, elles se peignaient sans que le choix soit gardé
   d'une ouverture à l'autre. */
/* Les nappes du passé, version 180 : la pluie des 48 et des 72 heures,
   deux nappes de la version 179, deviennent une seule pluie tombée dont la
   période se choisit au curseur. Un ancien choix se reprend avec sa durée. */
export const NAPPES = ["temp", "uv", "air", "eau", "ventmoy", "rafales", "pluie24", "pluiepassee", "neige24", "limite", "pression",
  "gel", "cielnuit", "brouillard", "pollens", "vagues", "eaumer", "neigepassee", "rafalespassees", "temppassee", "foret"];
const ANCIENNES = { pluie48: ["pluiepassee", "48h"], pluie72: ["pluiepassee", "72h"] };
if (ANCIENNES[etat.nappe]) etat = { ...etat, nappe: ANCIENNES[etat.nappe][0], periodepasse: ANCIENNES[etat.nappe][1] };
export const nappe = () => (NAPPES.includes(etat.nappe) ? etat.nappe : null);
export function poserNappe(v) { poser({ nappe: NAPPES.includes(v) ? v : null }); }

/* La vigilance sur la carte. Allumée au départ : elle ne coûte qu'une lecture de
   mille deux cents octets, et c'est la seule vue nationale de l'alerte que
   l'application propose. */
export const vigicarte = () => etat.vigicarte !== false;
export function poserVigicarte(v) { poser({ vigicarte: v === true }); }

/* Le vent sur la carte. Éteint au départ, à la différence des deux autres
   couches : il anime une toile en permanence, ce qui se paie en batterie, et il
   répond à une question qu'on ne se pose pas tous les jours. */
export const ventcarte = () => etat.ventcarte === true;
export function poserVentcarte(v) { poser({ ventcarte: v === true }); }

/* La foudre, allumée au départ comme la vigilance : clairsemée, elle ne couvre
   rien quand il n'y a pas d'orage, et un orage doit se voir sans le demander. */
export const foudrecarte = () => etat.foudrecarte !== false;
export function poserFoudrecarte(v) { poser({ foudrecarte: v === true }); }

/* Les nuages, éteints au départ : ils couvrent une grande partie de la vue et
   masqueraient la nappe choisie à qui ne les a pas demandés. */
export const nuagescarte = () => etat.nuagescarte === true;
export function poserNuagescarte(v) { poser({ nuagescarte: v === true }); }

/* Les feux, éteints au départ : la saison des incendies ne dure qu'une partie
   de l'année, et la couche serait vide le reste du temps. */
export const feuxcarte = () => etat.feuxcarte === true;
export function poserFeuxcarte(v) { poser({ feuxcarte: v === true }); }

/* Les périodes des couches du passé, version 180 : celle des nappes, le
   plus haut ou le plus bas des températures, celle des feux. Une valeur
   inconnue retombe sur la valeur par défaut. Les feux s'ouvrent sur sept
   jours depuis la version 182, décision de Jérôme du 8 octobre 2026 ; une
   période déjà choisie reste. */
export const PERIODES_PASSE = ["24h", "48h", "72h", "7j", "14j", "30j", "60j"];
export const periodePasse = () => (PERIODES_PASSE.includes(etat.periodepasse) ? etat.periodepasse : "48h");
export function poserPeriodePasse(v) { poser({ periodepasse: PERIODES_PASSE.includes(v) ? v : "48h" }); }
export const extremePasse = () => (etat.extremepasse === "froid" ? "froid" : "chaud");
export function poserExtremePasse(v) { poser({ extremepasse: v === "froid" ? "froid" : "chaud" }); }
export const PERIODES_FEUX = ["1j", "2j", "7j", "30j", "90j", "1an"];
export const periodeFeux = () => (PERIODES_FEUX.includes(etat.periodefeux) ? etat.periodefeux : "7j");
export function poserPeriodeFeux(v) { poser({ periodefeux: PERIODES_FEUX.includes(v) ? v : "7j" }); }
/* La légende de la carte repliée, version 155. */
export const legendeRepliee = () => etat.legenderepliee === true;
export function poserLegendeRepliee(v) { poser({ legenderepliee: v === true }); }

/* Le dernier cadrage de la carte, jalon 19, lot 7 : la carte rouvre où on
   l'a laissée, même après un relancement de l'application. */
export const vueCarte = () => {
  const v = etat.vuecarte;
  return v && [v.lat, v.lon, v.z].every(Number.isFinite) ? { lat: v.lat, lon: v.lon, z: v.z } : null;
};
export function poserVueCarte(v) {
  poser({ vuecarte: v && [v.lat, v.lon, v.z].every(Number.isFinite)
    ? { lat: Math.round(v.lat * 1000) / 1000, lon: Math.round(v.lon * 1000) / 1000, z: Math.round(v.z * 100) / 100 } : null });
}
export const previcarte = () => etat.previcarte === true;
export function poserPrevicarte(v) { poser({ previcarte: v === true }); }
export const plagecarte = () => etat.plagecarte === true;
export function poserPlagecarte(v) { poser({ plagecarte: v === true }); }
export const neigecarte = () => etat.neigecarte === true;
export function poserNeigecarte(v) { poser({ neigecarte: v === true }); }
export const rivierecarte = () => etat.rivierecarte === true;
export function poserRivierecarte(v) { poser({ rivierecarte: v === true }); }

/* La pluie, allumée au départ : c'est la couche pour laquelle la carte a été
   faite. Elle a longtemps été une nappe, exclusive des trois autres, alors
   qu'elle ne couvre qu'un cinquième de la vue un jour de pluie et laisse voir
   ce qui est dessous. Un ancien réglage `nappe: "pluie"` vaut désormais une
   pluie allumée et aucune nappe, ce que `poser` reprend au chargement. */
export const pluiecarte = () => {
  if (typeof etat.pluiecarte === "boolean") return etat.pluiecarte;
  if (etat.nappe === "pluie") return true;
  if (etat.nappe !== undefined) return false;
  return etat.radar !== false;
};
export function poserPluiecarte(v) { poser({ pluiecarte: v === true }); }

/* Les instants d'alerte. `null` rend la valeur par défaut du module du
   parapluie, qui la porte avec les seuils : les nombres du rappel vivent au
   même endroit. */
export const alertes = defaut => (estAlertes(etat.alertes) ? etat.alertes : defaut);
export function poserAlertes(v) {
  if (!estAlertes(v)) return;
  poser({ alertes: [v[0], v[1]] });
}

/* Le ressenti personnel. Deux personnes ne sentent pas le même froid, et le
   biais dit de combien de degrés celle-ci s'écarte de la moyenne. Il déplace le
   conseil d'habillement et rien d'autre : les degrés écrits viennent de la
   source, et trois contrôles gardent leur accord entre écrans.

   Il est borné des deux côtés. Sans borne, une suite d'appuis sur le même
   bouton finirait par conseiller un manteau en juillet, et la borne est ce qui
   fait de ce réglage une correction plutôt qu'une autre échelle. Il reste sur
   l'appareil et n'entre dans aucune requête. */
export const biais = () => (Number.isFinite(etat.biais) ? etat.biais : 0);
export function poserBiais(v, borne) {
  const b = Math.max(-borne, Math.min(borne, Math.round(Number(v) || 0)));
  poser({ biais: b });
  return b;
}

/* Le profil d'allergies. Ce sont les pollens dont on ne veut pas être averti
   qui sont gardés, non ceux qu'on suit : la liste vide vaut donc « tous », et
   c'est ce qu'il faut. Un profil vide au départ ferait une fonction invisible
   tant que personne n'ouvre les réglages, et une liste de suivis deviendrait
   fausse le jour où un pollen s'ajoute à la source.

   Le profil ne sort pas de l'appareil : la requête demande les six pollens quoi
   qu'il arrive, et c'est ici seulement que le tri se fait. Filtrer la requête
   ferait voyager une donnée de santé. */
const muets = () => (Array.isArray(etat.pollensMuets) ? etat.pollensMuets : []);
export const pollenSuivi = cle => !muets().includes(cle);
export function basculerPollen(cle) {
  const l = muets();
  poser({ pollensMuets: l.includes(cle) ? l.filter(x => x !== cle) : [...l, cle] });
  return pollenSuivi(cle);
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
    const r = await chercher(u, {}, 5000);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.features || []).map(f => {
      const [lon, lat] = f.geometry.coordinates;
      return {
        commune: f.properties.city || f.properties.name,
        codePostal: f.properties.postcode,
        departement: depDe(f.properties.context),
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
export async function communeDe(latBrute, lonBrute) {
  /* Le service d'adresses ne reçoit qu'un point au millième de degré, une
     centaine de mètres : assez pour nommer la commune, trop peu pour désigner
     une maison. Audit du 1er octobre 2026, constat 2.2. */
  const lat = Math.round(latBrute * 1000) / 1000, lon = Math.round(lonBrute * 1000) / 1000;
  const base = `https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}`;
  for (const u of [`${base}&type=municipality`, base]) {
    try {
      const r = await chercher(u, {}, 5000);
      if (!r.ok) continue;
      const d = await r.json();
      const f = (d.features || [])[0];
      const nom = f && (f.properties.city || f.properties.municipality
        || (f.properties.type === "municipality" ? f.properties.name : null));
      if (!nom) continue;
      return {
        commune: nom,
        codePostal: f.properties.postcode ?? null,
        departement: depDe(f.properties.context),
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
  const pos = { ...etat.position, commune: l.commune, codePostal: l.codePostal ?? null, departement: l.departement ?? null };
  etat = { ...etat, position: pos, commune: pos.commune, codePostal: pos.codePostal, departement: pos.departement };
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

/* Les étoiles affichées sur la carte du ciel : les plus visibles par défaut,
   la carte entière étant trop dense pour se lire. Le choix se garde d'une
   visite à l'autre et vaut pour le bandeau comme pour le plein écran. */
export const AFFICHAGES_CIEL = ["visibles", "toutes", "constellations"];
/* Le voile des nuages prévus sur la carte du ciel, version 177, demande de
   Jérôme du 6 octobre 2026 : allumé au départ, il se coupe d'un bouton et le
   choix se garde. */
/* La clé de la prévision immédiate de Météo-France, PIAF, version 186. Elle
   se saisit dans les réglages et reste sur cet appareil : le dépôt est
   public et n'en porte aucune. Sans clé, la pluie des trois heures garde ses
   six modèles et la carte ses images poussées. */
export const clePiaf = () => (typeof etat.clepiaf === "string" && etat.clepiaf.length > 20 ? etat.clepiaf : null);
/* La fin de validité de la clé, version 187, choix A de Jérôme du
   10 octobre 2026 : la clé du portail porte sa date d'expiration, et
   l'application prévient un mois avant. `null` quand la clé ne se lit pas. */
export function expirationCle(cle = clePiaf()) {
  try {
    const p = String(cle || "").split(".")[1];
    if (!p) return null;
    const j = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(p.length / 4) * 4, "=")));
    return Number.isFinite(j.exp) ? j.exp * 1000 : null;
  } catch { return null; }
}
export const RAPPEL_CLE = 30 * 86400000;
export function poserClePiaf(v) { poser({ clepiaf: typeof v === "string" && v.trim().length > 20 ? v.trim() : null }); }

export const voileCiel = () => etat.voileCiel !== false;
export function poserVoileCiel(v) { poser({ voileCiel: v === true }); }

export const affichageCiel = () =>
  AFFICHAGES_CIEL.includes(etat.affichageCiel) ? etat.affichageCiel : "visibles";
export function poserAffichageCiel(v) {
  if (AFFICHAGES_CIEL.includes(v)) poser({ affichageCiel: v });
}
