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

/* Un quart d'heure de garde. La vigilance est révisée deux fois par jour en
   temps ordinaire, davantage quand la situation bouge : relire plus souvent
   n'apprendrait rien et pèserait sur la source. */
const GARDE = 15 * 60 * 1000;
const gardes = new Map();

/* Deux items contigus de même couleur ne font qu'une plage : la source les
   découpe sur ses propres bornes, qui ne sont pas celles du phénomène. */
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

/* Rend la vigilance en vigueur pour un département, ou `null` : département
   inconnu, service muet, réponse illisible, ou rien à signaler. Le vert n'est
   pas une vigilance et ne remonte pas. */
export async function lire(dep) {
  if (!dep) return null;
  const garde = gardes.get(dep);
  if (garde && Date.now() - garde.t < GARDE) return garde.v;

  let d;
  try {
    const r = await fetch(`${SERVICE}?domain=${encodeURIComponent(dep)}&token=${JETON}`);
    if (!r.ok) return null;
    d = await r.json();
  } catch { return null; }
  if (!d || !Array.isArray(d.timelaps)) return null;

  const alertes = [];
  for (const t of d.timelaps) {
    const id = Number(t.phenomenon_id);
    if (!PHENOMENES[id]) continue;
    const p = plages(t.timelaps_items || []);
    if (!p.length) continue;
    alertes.push({
      id, nom: PHENOMENES[id][0], symbole: PHENOMENES[id][1],
      niveau: Math.max(...p.map(x => x.niveau)),
      debut: p[0].debut,
      fin: p[p.length - 1].fin,
    });
  }
  if (!alertes.length) { gardes.set(dep, { t: Date.now(), v: null }); return null; }

  // Le plus grave d'abord, et à gravité égale le plus proche.
  alertes.sort((a, b) => b.niveau - a.niveau || a.debut - b.debut);

  const v = {
    dep, nom: nomDe(dep),
    niveau: Math.max(...alertes.map(a => a.niveau)),
    alertes,
    maj: d.update_time ? new Date(d.update_time * 1000) : null,
    validite: d.end_validity_time ? new Date(d.end_validity_time * 1000) : null,
    lien: lienDe(dep),
  };
  gardes.set(dep, { t: Date.now(), v });
  return v;
}

// Vide la garde : le changement de commune ne doit pas servir l'ancien bulletin.
export function oublier() { gardes.clear(); }
