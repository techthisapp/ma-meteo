/* La vigilance météorologique de Météo-France, en vigueur.

   Trois voies mènent à cette donnée, et une seule convient à une application
   sans compte ni service dorsal.

   Le portail `public-api.meteofrance.fr` demande une clé, donc un compte, donc
   un secret à loger quelque part : exclu.

   Le jeu ouvert « Vigilance météorologique archivée » de data.gouv.fr porte le
   même contenu sans clé, mais c'est une archive et non un flux. Au 19 août 2026
   son dernier dépôt datait du 5 août. Une vigilance de quatorze jours ne dit
   rien du temps qu'il fait.

   Reste le service qui alimente l'application et le site de Météo-France. Il
   répond sans clé personnelle, en origine croisée ouverte, et c'est celui
   qu'emploient les bibliothèques libres. Le jeton ci-dessous n'est pas un
   secret : il est le même pour tout le monde, publié avec ces bibliothèques, et
   il n'ouvre que des données publiques.

   Si le service se tait, rien ne s'affiche. Une vigilance qu'on ne sait pas
   lire ne se remplace pas par un message d'erreur sur l'écran d'accueil. */

const SERVICE = "https://webservice.meteofrance.com/v3/warning/full";
const JETON = "__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__";
const CARTE = "https://vigilance.meteofrance.fr/fr";

/* Les neuf phénomènes de la vigilance, avec le symbole qui les porte dans
   l'application. Les identifiants sont ceux de la source. */
export const PHENOMENES = {
  1: ["Vent violent", "vent"],
  2: ["Pluie et inondation", "pluie"],
  3: ["Orages", "orage"],
  4: ["Crues", "goutte"],
  5: ["Neige et verglas", "neige"],
  6: ["Canicule", "soleil"],
  7: ["Grand froid", "thermo"],
  8: ["Avalanches", "alerte"],
  9: ["Vagues et submersion", "goutte"],
};

/* Les quatre niveaux et la conduite qu'ils appellent, dans les termes de
   Météo-France. Le vert n'est pas une vigilance : il n'apparaît jamais. */
export const NIVEAUX = {
  1: { nom: "vert", conduite: "Pas de vigilance particulière" },
  2: { nom: "jaune", conduite: "Soyez attentif" },
  3: { nom: "orange", conduite: "Soyez très vigilant" },
  4: { nom: "rouge", conduite: "Vigilance absolue" },
};

/* Le détail se lit sur le site de Météo-France, une page par département. Son
   adresse tient au nom, non au numéro : la table est donc nécessaire, et chaque
   entrée a été vérifiée. Sans entrée, le renvoi se fait sur la carte de
   France, qui vaut toujours. */
/* Le département, par son nom et par sa page sur le site de Météo-France. Le
   numéro ne se lit pas : « Corse-du-Sud » dit ce que « 2A » cache. L'adresse de
   la page tient au nom, mais pas toujours à sa forme attendue, deux
   départements faisant exception : la table est donc explicite, et chaque
   entrée a été vérifiée. Sans entrée, le renvoi se fait sur la carte de France,
   qui vaut toujours. */
const PAGES = {
  "01": ["Ain", "ain"], "02": ["Aisne", "aisne"], "03": ["Allier", "allier"],
  "04": ["Alpes-de-Haute-Provence", "alpes-de-haute-provence"],
  "05": ["Hautes-Alpes", "hautes-alpes"], "06": ["Alpes-Maritimes", "alpes-maritimes"],
  "07": ["Ardèche", "ardeche"], "08": ["Ardennes", "ardennes"], "09": ["Ariège", "ariege"],
  "10": ["Aube", "aube"], "11": ["Aude", "aude"], "12": ["Aveyron", "aveyron"],
  "13": ["Bouches-du-Rhône", "bouches-du-rhone"], "14": ["Calvados", "calvados"],
  "15": ["Cantal", "cantal"], "16": ["Charente", "charente"],
  "17": ["Charente-Maritime", "charente-maritime"], "18": ["Cher", "cher"],
  "19": ["Corrèze", "correze"], "2A": ["Corse-du-Sud", "corse-du-sud"],
  "2B": ["Haute-Corse", "haute-corse"], "21": ["Côte-d'Or", "cote-d-or"],
  "22": ["Côtes-d'Armor", "cotes-d-armor"], "23": ["Creuse", "creuse"],
  "24": ["Dordogne", "dordogne"], "25": ["Doubs", "doubs"], "26": ["Drôme", "drome"],
  "27": ["Eure", "eure"], "28": ["Eure-et-Loir", "eure-et-loir"],
  "29": ["Finistère", "finistere"], "30": ["Gard", "gard"],
  "31": ["Haute-Garonne", "haute-garonne"], "32": ["Gers", "gers"],
  "33": ["Gironde", "gironde"], "34": ["Hérault", "herault"],
  "35": ["Ille-et-Vilaine", "ille-et-vilaine"], "36": ["Indre", "indre"],
  "37": ["Indre-et-Loire", "indre-et-loire"], "38": ["Isère", "isere"],
  "39": ["Jura", "jura"], "40": ["Landes", "landes"],
  "41": ["Loir-et-Cher", "loir-et-cher"], "42": ["Loire", "loire"],
  "43": ["Haute-Loire", "haute-loire"], "44": ["Loire-Atlantique", "loire-atlantique"],
  "45": ["Loiret", "loiret"], "46": ["Lot", "lot"],
  "47": ["Lot-et-Garonne", "lot-et-garonne"], "48": ["Lozère", "lozere"],
  "49": ["Maine-et-Loire", "maine-et-loire"], "50": ["Manche", "manche"],
  "51": ["Marne", "marne"], "52": ["Haute-Marne", "haute-marne"],
  "53": ["Mayenne", "mayenne"], "54": ["Meurthe-et-Moselle", "meurthe-et-moselle"],
  "55": ["Meuse", "meuse"], "56": ["Morbihan", "morbihan"], "57": ["Moselle", "moselle"],
  "58": ["Nièvre", "nievre"], "59": ["Nord", "nord"], "60": ["Oise", "oise"],
  "61": ["Orne", "orne"], "62": ["Pas-de-Calais", "pas-de-calais"],
  "63": ["Puy-de-Dôme", "puy-de-dome"],
  "64": ["Pyrénées-Atlantiques", "pyrenees-atlantiques"],
  "65": ["Hautes-Pyrénées", "hautes-pyrenees"],
  "66": ["Pyrénées-Orientales", "pyrenees-orientales"], "67": ["Bas-Rhin", "bas-rhin"],
  "68": ["Haut-Rhin", "haut-rhin"], "69": ["Rhône", "rhone"],
  "70": ["Haute-Saône", "haute-saone"], "71": ["Saône-et-Loire", "saone-et-loire"],
  "72": ["Sarthe", "sarthe"], "73": ["Savoie", "savoie"],
  "74": ["Haute-Savoie", "haute-savoie"], "75": ["Paris", "paris"],
  "76": ["Seine-Maritime", "seine-maritime"], "77": ["Seine-et-Marne", "seine-et-marne"],
  "78": ["Yvelines", "yvelines"], "79": ["Deux-Sèvres", "deux-sevres"],
  "80": ["Somme", "somme"], "81": ["Tarn", "tarn"],
  "82": ["Tarn-et-Garonne", "tarn-et-garonne"], "83": ["Var", "var"],
  "84": ["Vaucluse", "vaucluse"], "85": ["Vendée", "vendee"], "86": ["Vienne", "vienne"],
  "87": ["Haute-Vienne", "haute-vienne"], "88": ["Vosges", "vosges"],
  "89": ["Yonne", "yonne"], "90": ["Territoire de Belfort", "terr-de-belfort"],
  "91": ["Essonne", "essonne"], "92": ["Hauts-de-Seine", "hauts-de-seine"],
  "93": ["Seine-Saint-Denis", "seine-st-denis"], "94": ["Val-de-Marne", "val-de-marne"],
  "95": ["Val-d'Oise", "val-d-oise"], "971": ["Guadeloupe", "guadeloupe"],
  "972": ["Martinique", "martinique"], "973": ["Guyane", "guyane"],
  "974": ["La Réunion", "la-reunion"], "976": ["Mayotte", "mayotte"]
};

export const lienDe = dep => (PAGES[dep] ? `${CARTE}/${PAGES[dep][1]}` : CARTE);
export const nomDe = dep => (PAGES[dep] ? PAGES[dep][0] : null);

/* La garde se cale sur la publication, non sur une durée fixe.

   Le bulletin est publié deux fois par jour, à 06 h et à 16 h en heure locale,
   et révisé entre ces bornes quand la situation bouge. Un quart d'heure de
   garde ne savait rien de ce rythme : il relisait quarante fois dans une
   journée qui ne bougeait pas, et servait encore le bulletin de la veille un
   quart d'heure après la publication du matin.

   Une charge vaut donc jusqu'à la prochaine borne, ou jusqu'à sa fin de
   validité, la plus proche des deux. Et une charge dont la révision précède la
   dernière borne franchie a déjà été remplacée à la source : elle ne vaut que
   le plancher, le temps d'éviter une relecture en boucle quand la publication
   tarde de quelques minutes sur son heure. */
const HEURES_PUB = [6, 16];
const PLANCHER = 5 * 60 * 1000;
const GARDE_MUET = 15 * 60 * 1000;
const gardes = new Map();

/* Une borne de publication, en heure locale : `setHours` la pose sur le fuseau
   de l'appareil, changement d'heure compris. */
const posee = (t, h, j) => {
  const d = new Date(t);
  d.setDate(d.getDate() + j);
  d.setHours(h, 0, 0, 0);
  return d.getTime();
};
export function bornePrecedente(t) {
  for (let j = 0; j > -2; j--) {
    for (let i = HEURES_PUB.length - 1; i >= 0; i--) {
      const b = posee(t, HEURES_PUB[i], j);
      if (b <= t) return b;
    }
  }
  return t;
}
export function borneSuivante(t) {
  for (let j = 0; j < 2; j++) {
    for (const h of HEURES_PUB) {
      const b = posee(t, h, j);
      if (b > t) return b;
    }
  }
  return t;
}

// Jusqu'à quand une charge se sert.
export function jusqua(d, t) {
  if (!d) return t + GARDE_MUET;
  const fin = d.end_validity_time ? d.end_validity_time * 1000 : Infinity;
  const maj = d.update_time ? d.update_time * 1000 : 0;
  if (maj < bornePrecedente(t)) return Math.min(t + PLANCHER, fin);
  return Math.min(borneSuivante(t), fin);
}

/* Deux items contigus de même couleur ne font qu'une plage : la source les
   découpe sur ses propres bornes, qui ne sont pas celles du phénomène.

   Les items du jour et ceux du lendemain sont passés ensemble, dans cet ordre :
   leurs plages se touchent exactement à minuit, et la fusion les recolle
   d'elle-même. Passés séparément, un même phénomène de même couleur des deux
   côtés de minuit écrivait deux lignes. */
function plages(items) {
  const out = [];
  for (const it of items) {
    if (!it || it.color_id < 2) continue;
    const d = new Date(it.begin_time * 1000);
    const f = new Date(it.end_time * 1000);
    const der = out[out.length - 1];
    if (der && der.niveau === it.color_id && der.fin.getTime() === d.getTime()) der.fin = f;
    else out.push({ niveau: it.color_id, debut: d, fin: f });
  }
  return out;
}

/* Une échéance du service, gardée pour elle-même. Sans `echeance`, la réponse
   porte le jour en cours ; avec `J1`, le lendemain, dans la même forme. */
async function charger(dep, echeance) {
  const cle = `${dep}|${echeance || "J0"}`;
  const garde = gardes.get(cle);
  if (garde && Date.now() < garde.exp) return garde.d;

  let d = null;
  try {
    const r = await fetch(`${SERVICE}?domain=${encodeURIComponent(dep)}`
      + (echeance ? `&echeance=${echeance}` : "") + `&token=${JETON}`);
    if (r.ok) d = await r.json();
  } catch { d = null; }
  if (!d || !Array.isArray(d.timelaps)) d = null;
  const t = Date.now();
  gardes.set(cle, { t, d, exp: jusqua(d, t) });
  return d;
}

const horodate = v => (v ? new Date(v * 1000) : null);
// Le maximum des plages qui coupent un intervalle, zéro s'il n'y en a aucune.
const surIntervalle = (p, a, b) => (a === null || b === null || b <= a ? []
  : p.filter(x => x.fin > a && x.debut < b));

/* Rend la vigilance d'un département, ou `null` : département inconnu, service
   muet, réponse illisible, ou rien à signaler ni aujourd'hui ni demain.

   Deux échéances sont lues. Celle du jour porte ce qui est en vigueur, celle du
   lendemain ce qui est annoncé. La seconde ne conditionne pas la première : si
   elle manque ou échoue, la lecture rend le jour en cours seul. Le cas le plus
   utile est celui d'un département vert aujourd'hui et orange demain, où le
   panneau ne paraissait pas du tout alors que c'est le moment où l'information
   sert. Le vert n'est pas une vigilance et ne remonte pas. */
export async function lire(dep) {
  if (!dep) return null;
  const [j0, j1] = await Promise.all([charger(dep, null), charger(dep, "J1")]);
  if (!j0) return null;

  const maintenant = new Date();
  const finJour = horodate(j0.end_validity_time);
  const finLendemain = horodate(j1 && j1.end_validity_time);

  /* Les phénomènes de l'échéance du lendemain, par identifiant : la source ne
     garantit ni le même ordre ni le même nombre d'une échéance à l'autre. */
  const demain = new Map();
  for (const t of (j1 ? j1.timelaps : [])) demain.set(Number(t.phenomenon_id), t.timelaps_items);

  const alertes = [];
  const annonces = [];
  for (const t of j0.timelaps) {
    const id = Number(t.phenomenon_id);
    if (!PHENOMENES[id]) continue;
    /* Un phénomène peut rendre un `timelaps_items` vide : la lecture ne doit pas
       tomber dessus. */
    const p = plages([...(t.timelaps_items || []), ...(demain.get(id) || [])]);
    if (!p.length) continue;

    const enCours = surIntervalle(p, maintenant, finJour);
    const nJour = enCours.length ? Math.max(...enCours.map(x => x.niveau)) : 0;
    const suite = surIntervalle(p, finJour, finLendemain);
    const nLendemain = suite.length ? Math.max(...suite.map(x => x.niveau)) : 0;

    const base = { id, nom: PHENOMENES[id][0], symbole: PHENOMENES[id][1] };
    if (nJour >= 2) {
      alertes.push({ ...base, niveau: nJour,
        debut: enCours[0].debut, fin: enCours[enCours.length - 1].fin });
    }
    /* Une aggravation seulement : redire demain ce qui est déjà en vigueur au
       même niveau n'apprend rien. */
    if (nLendemain >= 2 && nLendemain > nJour) annonces.push({ ...base, niveau: nLendemain });
  }
  if (!alertes.length && !annonces.length) return null;

  // Le plus grave d'abord, et à gravité égale le plus proche.
  alertes.sort((a, b) => b.niveau - a.niveau || a.debut - b.debut);
  annonces.sort((a, b) => b.niveau - a.niveau || a.id - b.id);

  const majs = [horodate(j0.update_time), horodate(j1 && j1.update_time)].filter(Boolean);
  const v = {
    dep, nom: nomDe(dep), lien: lienDe(dep),
    maj: majs.length ? new Date(Math.max(...majs.map(x => x.getTime()))) : null,
    alertes, annonces,
  };
  if (alertes.length) v.niveau = Math.max(...alertes.map(a => a.niveau));
  if (annonces.length) v.niveauLendemain = Math.max(...annonces.map(a => a.niveau));
  return v;
}

/* La garde porte le département dans sa clé : un changement de commune lit le
   bulletin du nouveau département et sert celui de l'ancien s'il y revient. Un
   `oublier()` vidait tout à chaque chargement d'écran, ce qui redemandait le
   même bulletin à la source sans rien en apprendre. */
