/* Les vues de la feuille. Chacune rend un titre, un sous-titre facultatif, un
   corps et un branchement facultatif. */

import { nombreFr, hhmm, jourCourt, jourLong, esc, departementDe, heureJour } from "./horloge.js";
import * as P from "./previsions.js";
import { ico, icoTemps, icoCiel, tempsDe, couleurT } from "./icones.js";
import * as Ruban from "./ruban.js";
import { liste, moments, TRANCHES } from "./ecritures.js";
import * as Reglages from "./reglages.js";
import * as Astres from "./astres.js";
import * as Feu from "./feu.js";
import * as Relief from "./relief.js";
import * as Temps from "./temps.js";
import * as Vig from "./vigilance.js";
import { SEUILS } from "./conseils.js";

/* ---------- Fragments communs ---------- */

const hm = ms => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const CARDINAUX = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
const cardinalDe = az => CARDINAUX[Math.round((((az % 360) + 360) % 360) / 45) % 8];

const versCardinal = az => {
  const c = cardinalDe(az);
  return /^[aeiou]/.test(c) ? `à l'${c}` : `au ${c}`;
};

// L'angle de phase se déduit de la part éclairée, qui vaut (1 + cos i) / 2.
const anglePhase = eclairee =>
  Math.acos(Math.max(-1, Math.min(1, 2 * eclairee - 1))) / (Math.PI / 180);

/* Une rangée de course du jour, sur l'écran du soleil comme sur celui de la
   lune. La valeur ne porte que l'heure : le point cardinal et la hauteur sont
   des précisions sur l'évènement, elles tiennent sous son nom. Les heures
   s'alignent alors en colonne, ce qu'une valeur composée interdisait. */
const rangeeAstre = (maintenant, prochain) => ([sym, nom, sous, parts, quand]) => {
  const passe = quand && quand < maintenant;
  const courant = prochain && quand && quand.getTime() === prochain[0].getTime();
  return `<div class="rangee${passe ? " passe" : ""}${courant ? " courant" : ""}">`
    + ico(sym, "")
    + `<span class="rangee-txt"><b>${esc(nom)}</b>`
    + (sous ? `<span>${esc(sous)}</span>` : "") + `</span>`
    + valeur(...parts) + `</div>`;
};

const rangees = lignes => lignes.map(([n, v]) =>
  `<div class="rangee"><span class="rangee-txt">${esc(n)}</span>`
  + `<span class="rangee-val"><b>${esc(v)}</b></span></div>`).join("");

/* Valeur composée d'une rangée. Chaque partie forte reste insécable, la coupure
   se fait entre les parties : sur un grand corps de texte, « 16:05, sud-est »
   d'un seul tenant débordait de la carte, l'heure ne pouvant pas se couper.
   Une partie passée en objet `{ doux }` est secondaire, et se coupe. */
const valeur = (...parties) => `<span class="rangee-val">`
  + parties.filter(Boolean).map(p => typeof p === "string"
    ? `<b>${esc(p)}</b>` : `<i>${esc(p.doux)}</i>`).join(" ")
  + `</span>`;

/* ---------- L'écran du temps ---------- */

export function vueTemps(ctx, rendre) {
  const s = P.serieHoraire();
  const g = Reglages.lire();
  if (!s) {
    return {
      titre: "Le temps",
      corps: `<div class="carte"><p class="vide">La prévision heure par heure n'est pas `
        + `disponible pour le moment. Rouvrir dans un instant.</p></div>`,
    };
  }

  const e = g.ecriture;
  const corps = e === "liste" ? liste(s) : Ruban.dessiner(s);
  /* Le sélecteur se tient sur la ligne du titre, en petit : le ruban et la
     table commencent ainsi en haut de la page. */
  const seg = `<div class="seg seg-menu">` + Reglages.ECRITURES.map(([c, n]) =>
    `<button type="button" data-ecriture="${c}"${c === e ? ' class="actif"' : ""}>${esc(n)}</button>`)
    .join("") + `</div>`;

  /* Ce qui mérite d'être retenu se lit sur l'accueil, sous « À retenir », et
     les moments s'y lisent aussi, en bas de page. Les répéter ici redisait les
     mêmes phrases un écran plus loin, à l'endroit où l'on vient justement
     chercher le détail heure par heure. */
  return {
    titre: "Le temps",
    sousEcran: `${nombreFr(s.t[0])}° et ${tempsDe(s.code[0])[1].toLowerCase()}`,
    cote: seg,
    corps: `<div class="carte">${corps}</div>`,
    brancher(bloc) {
      for (const b of bloc.querySelectorAll("[data-ecriture]")) {
        b.addEventListener("click", () => { Reglages.poserEcriture(b.dataset.ecriture); rendre(); });
      }
      if (e === "ruban") Ruban.brancher(bloc, rendre);
    },
  };
}

/* ---------- La table de la semaine ---------- */


export function vueSemaine() {
  const c = P.chargeCourante();
  const i = P.iJour();
  const g = Reglages.lire();
  if (!c || i < 0) return { titre: "La semaine", corps: `<div class="carte"><p class="vide">Prévision indisponible.</p></div>` };

  const d = c.daily;
  const fin = Math.min(i + 7, d.time.length);
  const lignes = [];
  let tmin = Infinity, tmax = -Infinity;
  for (let k = i; k < fin; k++) {
    const h = P.jourHoraire(d.time[k]);
    tmin = Math.min(tmin, h ? h.tn : d.temperature_2m_min[k]);
    tmax = Math.max(tmax, h ? h.tx : d.temperature_2m_max[k]);
  }
  const amp = Math.max(1, tmax - tmin);

  const maintenant = P.serieHoraire()?.t?.[0] ?? null;
  const heureCourante = new Date().getHours();

  for (let k = i; k < fin; k++) {
    /* Les heures là où elles couvrent la journée entière, la charge quotidienne
       au-delà. Deux sources pour un seul jour font des contradictions dans une
       même feuille. */
    const h = P.jourHoraire(d.time[k]);
    const tn = h ? h.tn : d.temperature_2m_min[k];
    const tx = h ? h.tx : d.temperature_2m_max[k];
    const mm = h ? h.mm : d.precipitation_sum[k];
    const pb = h ? h.pb : d.precipitation_probability_max[k];
    const code = h ? h.code : d.weather_code[k];

    const nom = k === i ? "Auj." : k === i + 1 ? "Demain" : jourCourt(d.time[k]);
    const date = new Date(`${d.time[k]}T12:00`)
      .toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

    /* La plage du jour se pose sur l'échelle commune de la semaine : deux
       journées se comparent d'un coup d'œil, ce qu'une barre partant toujours
       de la gauche interdisait. */
    const gauche = ((tn - tmin) / amp) * 100;
    const large = Math.max(3, ((tx - tn) / amp) * 100);

    /* La pluie se lit sous le symbole, non dans une colonne à elle : la colonne
       repoussait la rangée sur trois lignes dès que la lame était écrite. */
    const eau = mm >= 0.1 ? `${nombreFr(mm)} mm` : pb >= 5 ? `${Math.round(pb)} %` : "";

    const pointe = k === i && maintenant !== null
      ? `<u class="sem-pt" style="left:${(((maintenant - tmin) / amp) * 100).toFixed(1)}%"></u>`
      : "";

    const mo = P.momentsJour(d.time[k]);
    const cle = `sm-${d.time[k]}`;

    const corps = `<span class="j"><b>${esc(nom)}</b><em>${esc(date)}</em></span>`
      + `<span class="c">${icoTemps(icoCiel(code, true), "")}`
      + (eau ? `<em>${esc(eau)}</em>` : "") + `</span>`
      + `<span class="b"><b class="sem-min">${Math.round(tn)}°</b>`
      + `<i class="sem-piste"><s class="sem-plage" style="left:${gauche.toFixed(1)}%;`
      + `width:${large.toFixed(1)}%;`
      + `background:linear-gradient(90deg, ${couleurT(tn)}, ${couleurT(tx)})"></s>`
      + pointe + `</i>`
      + `<b class="sem-max">${Math.round(tx)}°</b></span>`;

    /* Une journée sans heures complètes ne s'ouvre pas, et ne porte alors pas
       de chevron : une cible qui ne mène à rien vaut moins qu'aucune cible. */
    const tete = mo
      ? `<button type="button" class="sem-r" data-jour="${esc(d.time[k])}" `
        + `aria-expanded="false" aria-controls="${cle}">${corps}`
        + ico("chevron_bas", "sem-chev") + `</button>`
      : `<div class="sem-r sem-fixe">${corps}</div>`;

    lignes.push(`<div class="sem-j${k === i ? " sem-auj" : ""}">${tete}`
      + (mo ? `<div class="md" id="${cle}" hidden>${volet(mo, k === i, heureCourante)}</div>` : "")
      + `</div>`);
  }

  return {
    titre: "La semaine",
    corps: `<div class="carte"><div class="sem">${lignes.join("")}</div>`
      + `<p class="note">Chaque journée se résume de ses heures. Jusqu'à trois jours, `
      + `la prévision est affinée par AROME ; au delà, elle vient du modèle `
      + `global.</p></div>`,
    brancher(bloc) { brancherSemaine(bloc); },
  };
}

/* Le volet des quatre moments. Une seule température, celle qui compte : le
   minimum la nuit, le maximum le jour. Les bornes de la journée sont déjà sur
   la rangée fermée, les redire quatre fois n'apprendrait rien.

   Les deux lignes du bas ne paraissent que si elles ont quelque chose à dire,
   l'eau d'abord, la rafale ensuite. Sur la journée en cours, un moment déjà
   passé s'efface, comme la course du jour du soleil. */
function volet(moments, aujourdhui, heureCourante) {
  return moments.map(m => {
    const passe = aujourdhui && m.h1 <= heureCourante;
    /* Mêmes seuils que la rangée fermée : elle annonce huit pour cent de
       risque, le volet ne peut pas se taire dessus. */
    const eau = m.mm >= SEUILS.lame ? `${nombreFr(m.mm)} mm`
      : m.pb >= SEUILS.risque ? `${Math.round(m.pb)} %` : "";
    const vent = m.raf >= SEUILS.rafale ? `${Math.round(m.raf)} km/h` : "";
    return `<div${passe ? ' class="passe"' : ""}>`
      + `<i>${esc(TRANCHES[m.q][4])}</i>`
      + icoTemps(icoCiel(m.code, m.clair), "")
      + `<b>${Math.round(m.q === 0 ? m.tn : m.tx)}°</b>`
      + (eau ? `<em>${esc(eau)}</em>` : "")
      + (vent ? `<u>${esc(vent)}</u>` : "")
      + `</div>`;
  }).join("");
}

/* Un seul volet ouvert à la fois : sept ouverts feraient de la semaine une
   page à défiler, ce que la rangée fermée évitait justement. */
function brancherSemaine(bloc) {
  const sem = bloc.querySelector(".sem");
  if (!sem) return;
  sem.addEventListener("click", ev => {
    const b = ev.target.closest(".sem-r[aria-expanded]");
    if (!b || !sem.contains(b)) return;
    const ouvert = b.getAttribute("aria-expanded") === "true";
    for (const autre of sem.querySelectorAll('.sem-r[aria-expanded="true"]')) {
      autre.setAttribute("aria-expanded", "false");
      const v = document.getElementById(autre.getAttribute("aria-controls"));
      if (v) v.hidden = true;
    }
    if (ouvert) return;
    b.setAttribute("aria-expanded", "true");
    const v = document.getElementById(b.getAttribute("aria-controls"));
    if (v) v.hidden = false;
  });
}

/* ---------- Vigilance ----------

   Le détail du bulletin en vigueur, ouvert depuis le panneau de l'accueil. Le
   bulletin est celui que `vigilance.js` a lu, porté par le contexte : la
   feuille et le panneau disent la même chose, à deux niveaux de détail.

   Les conséquences possibles et les conseils de comportement restent sur
   Météo-France, qui fait foi. Les recopier ici les figerait. */

export function vueVigilance(ctx) {
  const g = Reglages.lire();
  const dep = departementDe(g.codePostal);
  const v = ctx && ctx.vigilance;
  const lien = Vig.lienDe(dep);
  const externe = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" `
    + `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`
    + `</svg>`;
  const bouton = `<a class="lien-plein" href="${lien}" target="_blank" rel="noopener noreferrer">`
    + `<span>Ouvrir la vigilance${Vig.nomDe(dep) ? ` de ${esc(Vig.nomDe(dep))}` : ""} sur Météo-France</span>`
    + `${externe}</a>`;

  /* Sans vigilance en vigueur, la feuille reste atteignable par l'historique :
     elle le dit alors, plutôt que de montrer un cadre vide. */
  if (!v) {
    return {
      titre: "Vigilance",
      corps: `<div class="carte">`
        + `<p class="prose">Aucune vigilance en vigueur`
        + (Vig.nomDe(dep) ? ` sur ${esc(Vig.nomDe(dep))}` : "")
        + `. Le bulletin de Météo-France fait foi et se `
        + `consulte à tout moment.</p>${bouton}</div>`,
    };
  }

  const n = Vig.NIVEAUX[v.niveau];
  const lignes = v.alertes.map(a => {
    const na = Vig.NIVEAUX[a.niveau];
    return `<div class="rangee vg-r n-${a.niveau}">${ico(a.symbole, "")}`
      + `<span class="rangee-txt"><b>${esc(a.nom)}</b>`
      + `<span>${esc(heureJour(a.debut))} à ${esc(heureJour(a.fin))}</span></span>`
      + `<span class="rangee-val"><b>${esc(na.nom)}</b></span></div>`;
  }).join("");

  return {
    titre: "Vigilance",
    sous: `${n.nom.charAt(0).toUpperCase()}${n.nom.slice(1)} sur ${v.nom || `le département ${dep}`}`,
    corps: `<div class="carte vg-f vg-${esc(n.nom)}">`
      + `<div class="vg-tete">${ico("alerte", "vg-ic")}`
      + `<span class="vg-txt"><b>${esc(n.conduite)}</b>`
      + (v.validite ? `<em>Bulletin valable jusqu'à ${esc(heureJour(v.validite))}</em>` : "")
      + `</span></div>${bouton}</div>`

      + `<div class="section"><h2>Phénomènes signalés</h2>`
      + `<div class="carte groupe-plat">${lignes}</div></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Source</h3></div>`
      + `<p class="prose-2">Bulletin de Météo-France, lu sur le service qui alimente son `
      + `site et son application, sans compte ni clé`
      + (v.maj ? `. Dernière révision ${esc(heureJour(v.maj))}` : "")
      + `. Le détail par phénomène, les conséquences possibles et les conseils de `
      + `comportement se lisent sur Météo-France, qui fait foi.</p></div>`,
  };
}

/* ---------- Le soleil ---------- */

/* Le bandeau du ciel.

   Il occupe toute la largeur et passe sous la barre de tête : c'est le seul
   endroit de l'application où le contenu monte jusqu'au bord haut. Sa couleur
   vient de la hauteur du Soleil, non du thème de l'appareil : un ciel de midi
   reste clair en thème sombre, sans quoi midi ressemblerait à minuit. */

const CIELS = {
  nuit: ["#0A1120", "#16203A"],
  aube: ["#1E2E52", "#C6764A"],
  jour: ["#4F8FC4", "#BBD9EE"],
  soir: ["#22325A", "#C2643F"],
};

const enRVB = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const ecritRVB = v => `rgb(${v[0]} ${v[1]} ${v[2]})`;
const melange = (a, b, t) => {
  const [r1, g1, b1] = enRVB(a), [r2, g2, b2] = enRVB(b);
  const v = (x, y) => Math.round(x + (y - x) * t);
  return [v(r1, r2), v(g1, g2), v(b1, b2)];
};
/* Le sol se déduit du bas du ciel par assombrissement : une bande ardoise fixe
   ferait nuit à midi, et un sol clair ferait jour à minuit. */
const assombrir = (v, k) => v.map(x => Math.round(x * k));

function cielDe(hauteur, montant) {
  const bord = montant ? CIELS.aube : CIELS.soir;
  let de, vers, t;
  if (hauteur <= -12) { de = CIELS.nuit; vers = CIELS.nuit; t = 0; }
  else if (hauteur < 2) { de = CIELS.nuit; vers = bord; t = (hauteur + 12) / 14; }
  else if (hauteur < 20) { de = bord; vers = CIELS.jour; t = (hauteur - 2) / 18; }
  else { de = CIELS.jour; vers = CIELS.jour; t = 0; }
  const haut = melange(de[0], vers[0], t);
  const bas = melange(de[1], vers[1], t);
  const borne = (v, a, b) => Math.max(0, Math.min(1, (v - a) / (b - a)));
  return {
    haut: ecritRVB(haut), bas: ecritRVB(bas),
    // Les composantes servent aussi à teindre les nuages, qui prennent leur
    // couleur du ciel : elles sont donc rendues telles quelles.
    hautRVB: haut, basRVB: bas,
    solHaut: ecritRVB(assombrir(bas, 0.80)), sol: ecritRVB(assombrir(bas, 0.66)),
    nuit: borne(-hauteur, 2, 12),
    jour: borne(hauteur, -4, 4),
    chaud: borne(25 - hauteur, 0, 25),
    // Un pour un ciel de plein jour : c'est lui qui pâlit la Lune.
    clarte: borne(hauteur, -8, 6),
  };
}

/* Étoiles réparties par hachage : une suite arithmétique dessinait une
   diagonale. Elles ne paraissent qu'au-dessous de l'horizon. */
const ETOILES = (() => {
  const bruit = n => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  let out = "";
  for (let k = 0; k < 46; k++) {
    out += `<i style="left:${(bruit(k + 1) * 98).toFixed(1)}%;`
      + `top:${(bruit(k + 71) * 70).toFixed(1)}%;`
      + `animation-delay:${(bruit(k + 131) * 3.4).toFixed(1)}s"></i>`;
  }
  return out;
})();

/* Ordonnée du disque dans le panneau, tirée de sa hauteur. L'horizon est à
   quatre-vingt-cinq pour cent, le zénith à treize. */
const ordonnee = hauteur => 85 - Math.max(-14, Math.min(90, hauteur)) / 90 * (85 - 13);

/* Abscisse du disque, tirée de son azimut. L'heure ne convient pas : deux
   astres dans un même ciel doivent partager la même règle, et l'heure ne dit
   rien de la place de la Lune, qui se lève cinquante minutes plus tard chaque
   jour. L'arc couvert va de l'est-nord-est à l'ouest-nord-ouest, ce qui contient
   les levers et les couchers aux latitudes françaises en toute saison. */
const abscisse = azimut => {
  const az = ((azimut % 360) + 360) % 360;
  return Math.max(3, Math.min(97, (az - 55) / 250 * 100));
};

// Le panneau est plus large que haut : un écart vertical compte moins qu'un
// écart horizontal de même valeur en pour cent.
const PANNEAU = 306 / 390;

/* Le panneau, commun aux trois bandeaux. Il ne sait rien des astres qu'il
   porte : chacun lui passe sa place et sa toile. Il en prend un, deux, ou
   aucun, le dernier de la liste étant devant. */
function panneauCiel(c, astres, temps = "") {
  return `<div class="ci" style="`
    + `--ci-haut:${c.haut};--ci-bas:${c.bas};--ci-sol-haut:${c.solHaut};--ci-sol:${c.sol};`
    + `--ci-nuit:${c.nuit.toFixed(2)};--ci-jour:${c.jour.toFixed(2)}">`
    + `<div class="ci-etoiles" aria-hidden="true">${ETOILES}</div>`
    + astres.filter(a => a.corps).map(a =>
      `<div class="ci-astre${a.sous ? " sous" : ""}" `
      + `style="--ax:${a.x.toFixed(1)}%;--ay:${a.y.toFixed(1)}%">${a.corps}</div>`).join("")
    + temps
    + `<div class="ci-sol"></div><div class="ci-horizon"></div>`
    + `<div class="ci-voile-haut"></div><div class="ci-voile-bas"></div>`
    + `</div>`;
}

/* Qui se montre dans le ciel de l'accueil.

   Le Soleil dès qu'il n'est pas trop bas sous l'horizon, la lueur du crépuscule
   comptant encore pour lui. La Lune dès qu'elle est levée, de jour comme de
   nuit, et de nuit même couchée, faute de quoi le panneau serait vide.

   Deux réserves de jour, chacune sa raison. Un croissant trop mince est une
   Lune trop proche du Soleil pour être vue, un huitième éclairé valant environ
   quarante degrés d'écart. Et deux disques ne se recouvrent pas : leurs rayons
   font ensemble près d'un tiers de la largeur du panneau.

   La règle est sortie de la vue pour être éprouvée sur des cas que la charge
   d'essai ne contient pas, une Lune neuve de plein jour et deux astres qui se
   frôlent. */
export function astresVus(ps, pl, eclairee) {
  const ecart = Math.hypot(
    (abscisse(ps.azimut) - abscisse(pl.azimut)) / 100,
    ((ordonnee(ps.hauteur) - ordonnee(pl.hauteur)) / 100) * PANNEAU);
  const soleil = ps.hauteur > -6;
  const lune = soleil
    ? pl.hauteur > Astres.SEUIL.lune && eclairee > 0.12 && ecart > 0.30
    : true;
  return { soleil, lune, ecart };
}

const corpsSoleil = c =>
  `<canvas class="ci-feu" id="ciFeu" data-chaud="${c.chaud.toFixed(3)}" `
  + `role="img" aria-label="Le Soleil dans le ciel"></canvas>`;

const corpsLune = (c, ph, pl, maintenant, g) =>
  `<canvas class="ci-lune" id="ciLune" `
  + `data-phase="${anglePhase(ph.eclairee).toFixed(1)}" `
  + `data-angle="${Astres.angleLimbe(maintenant, g.lat, g.lon).toFixed(4)}" `
  + `data-eclairee="${ph.eclairee.toFixed(3)}" data-clarte="${c.clarte.toFixed(3)}" `
  + `data-chaud="${Math.max(0, Math.min(1, (12 - pl.hauteur) / 20)).toFixed(3)}" `
  + `role="img" aria-label="La Lune dans le ciel"></canvas>`;

function bandeauCiel(g, maintenant, meridien) {
  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const montant = meridien ? maintenant < meridien : minutes < 720;
  const c = cielDe(p.hauteur, montant);

  /* L'abscisse suit l'azimut, l'ordonnée la hauteur : le disque est à sa place,
     non sur un arc supposé. */
  return panneauCiel(c, [{ x: abscisse(p.azimut), y: ordonnee(p.hauteur),
    sous: p.hauteur < Astres.SEUIL.soleil, corps: corpsSoleil(c) }]);
}

/* Le bandeau de la Lune. Le ciel est celui du Soleil : une Lune levée en plein
   jour se voit sur un ciel bleu, pâle et peu contrastée, comme dans le ciel
   réel. La Lune, elle, se place par son azimut : elle se lève à ses propres
   heures, qui reculent d'environ cinquante minutes par jour, et l'heure ne dit
   donc rien de sa position. */
function bandeauLune(g, maintenant, phase) {
  const ps = Astres.position("soleil", maintenant, g.lat, g.lon);
  const pl = Astres.position("lune", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const c = cielDe(ps.hauteur, minutes < 720);

  return panneauCiel(c, [{ x: abscisse(pl.azimut), y: ordonnee(pl.hauteur),
    sous: pl.hauteur < Astres.SEUIL.lune,
    corps: corpsLune(c, phase, pl, maintenant, g) }]);
}

/* Le bandeau de l'accueil. Même panneau que les deux autres, avec le temps
   qu'il fait peint par-dessus les astres : un nuage passe devant le Soleil, non
   derrière. Sous une couche fermée aucun disque n'est dessiné, seule reste la
   lueur diffuse à l'endroit où l'astre se tient.

   Le Soleil et la Lune partagent le ciel quand ils sont levés tous les deux, ce
   qui arrive une bonne partie du mois : la Lune se voit en plein jour, pâle,
   dès qu'elle s'écarte du Soleil. Ne montrer que l'un des deux donnait un ciel
   faux la moitié des après-midi.

   Deux réserves. Trop près du Soleil, la Lune est une Lune nouvelle noyée dans
   sa lueur : elle n'est pas dessinée, elle ne se voit pas davantage dans le vrai
   ciel, et les deux disques se recouvriraient. Et de nuit la Lune reste
   dessinée sous l'horizon, faute de quoi le panneau serait vide. */
export function bandeauAccueil(g, maintenant, p, vent) {
  const ps = Astres.position("soleil", maintenant, g.lat, g.lon);
  const pl = Astres.position("lune", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const c = cielDe(ps.hauteur, minutes < 720);
  const voile = Temps.voileDe(p);
  const visible = voile < Temps.SEUIL_VOILE;

  const xs = abscisse(ps.azimut), ys = ordonnee(ps.hauteur);
  const xl = abscisse(pl.azimut), yl = ordonnee(pl.hauteur);
  const { soleil: soleilVu, lune: luneVue } =
    astresVus(ps, pl, Astres.phase(maintenant).eclairee);

  /* L'astre pâlit et se dilue sous une couche mince : le voile est porté par le
     panneau, la toile de l'astre n'a rien à en savoir. */
  const voiler = corps => (corps && voile > 0
    ? `<div class="ci-voile" style="--voile:${voile.toFixed(2)}">${corps}</div>` : corps);

  // La Lune d'abord, le Soleil devant : c'est lui qui l'emporte s'ils se frôlent.
  const astres = [];
  if (luneVue) {
    astres.push({ x: xl, y: yl, sous: pl.hauteur < Astres.SEUIL.lune,
      corps: visible ? voiler(corpsLune(c, Astres.phase(maintenant), pl, maintenant, g)) : "" });
  }
  if (soleilVu) {
    astres.push({ x: xs, y: ys, sous: ps.hauteur < Astres.SEUIL.soleil,
      corps: visible ? voiler(corpsSoleil(c)) : "" });
  }

  /* La lueur qui traverse la couche vient du Soleil quand il est levé, de la
     Lune sinon : c'est lui qui éclaire les nuages, elle ne les éclaire qu'en
     son absence. */
  const astre = soleilVu
    ? { sorte: "soleil", x: xs / 100, y: ys / 100 }
    : { sorte: "lune", x: xl / 100, y: yl / 100 };
  const toile = `<canvas class="ci-temps" id="ciTemps" aria-hidden="true" `
    + Temps.attributs(p, c, vent, astre) + `></canvas>`;
  return panneauCiel(c, astres, toile);
}

/* La trajectoire du jour : la hauteur du Soleil de minuit à minuit. Le trait
   plein est au-dessus de l'horizon, le pointillé au-dessous. */
function trajectoire(courbe, lever, coucher, minutes, opts = {}) {
  const W = 342, H = 170, G = 24, D = 16, BAS = 20;
  const hx = m => G + (m / 1440) * (W - G - D);
  const hy = h => {
    const t = (Math.max(-30, Math.min(90, h)) + 30) / 120;
    return (H - BAS) - t * (H - BAS - 10);
  };
  const sol = hy(0);

  const trait = pts => pts.map((p, k) =>
    `${k ? "L" : "M"}${hx(p.m).toFixed(1)},${hy(p.h).toFixed(1)}`).join(" ");

  /* Un astre peut être levé en début et en fin de journée, avec un coucher au
     milieu : la courbe se découpe en tronçons contigus, sans quoi un trait
     droit relierait les deux passages en rasant l'horizon. */
  const troncons = dedans => {
    const out = []; let cur = [];
    for (const p of courbe) {
      if (dedans(p)) cur.push(p);
      else { if (cur.length > 1) out.push(cur); cur = []; }
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const hauts = troncons(p => p.h >= 0);
  const bas = troncons(p => p.h < 0);

  const aire = hauts.map(t => `${trait(t)} L${hx(t[t.length - 1].m).toFixed(1)},${sol.toFixed(1)} `
    + `L${hx(t[0].m).toFixed(1)},${sol.toFixed(1)} Z`).join(" ");

  let ici = courbe[0];
  for (const p of courbe) if (Math.abs(p.m - minutes) < Math.abs(ici.m - minutes)) ici = p;
  const cx = hx(minutes), cy = hy(ici.h);
  const teinte = opts.teinte === "lune" ? "tr-lune" : "";

  const deuxCh = n => String(n).padStart(2, "0");
  const grille = [0, 6, 12, 18, 24].map(h =>
    `<line class="tr-grille" x1="${hx(h * 60).toFixed(1)}" y1="10" `
    + `x2="${hx(h * 60).toFixed(1)}" y2="${(H - BAS).toFixed(1)}"/>`
    + `<text class="tr-txt" x="${hx(h * 60).toFixed(1)}" y="${H - 6}" text-anchor="middle">`
    + `${deuxCh(h)} h</text>`).join("");

  const echelle = [0, 30, 60, 90].map(v =>
    `<text class="tr-txt" x="2" y="${(hy(v) + 3).toFixed(1)}">${v}°</text>`).join("");

  const borne = m => m === null ? ""
    : `<circle class="tr-borne" cx="${hx(m).toFixed(1)}" cy="${sol.toFixed(1)}" r="3.4"/>`;

  return `<svg class="tr ${teinte}" viewBox="0 0 ${W} ${H}" role="img" `
    + `aria-label="${esc(opts.titre || "Hauteur du Soleil dans le ciel, de minuit à minuit")}">`
    + `<defs><linearGradient id="grJour" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${opts.teinte === "lune" ? "var(--ic-lune)" : "var(--ic-soleil)"}" stop-opacity=".26"/>`
    + `<stop offset="1" stop-color="${opts.teinte === "lune" ? "var(--ic-lune)" : "var(--ic-soleil)"}" stop-opacity=".04"/>`
    + `</linearGradient></defs>`
    + grille + echelle
    + (aire ? `<path class="tr-jour" d="${aire}"/>` : "")
    + (opts.fond ? `<path class="tr-fond" d="${trait(opts.fond)}"/>` : "")
    + bas.map(t => `<path class="tr-ligne-nuit" d="${trait(t)}"/>`).join("")
    + hauts.map(t => `<path class="tr-ligne" d="${trait(t)}"/>`).join("")
    + `<line class="tr-sol" x1="${G}" y1="${sol.toFixed(1)}" x2="${W - D}" y2="${sol.toFixed(1)}"/>`
    + borne(lever) + borne(coucher)
    + `<line class="tr-fil" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" `
    + `x2="${cx.toFixed(1)}" y2="${(H - BAS).toFixed(1)}"/>`
    + `<circle class="tr-halo" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="9"/>`
    + `<circle class="tr-astre" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"/>`
    + `</svg>`;
}

/* ---------- Le ruban de la lumière ----------

   Les vingt-quatre heures du jour, teintées par la hauteur du Soleil. Cinq
   états se suivent du plein jour à la nuit noire, séparés par les trois seuils
   de crépuscule. Les bornes se placent par interpolation entre deux points de
   la courbe : à cinq minutes de pas, la hauteur varie assez peu pour que la
   droite suffise. */

const SEUILS_LUM = [-0.833, -6, -12, -18];
const ZONES_LUM = ["jour", "civil", "naut", "astro", "nuit"];

const zoneLum = h => {
  for (let z = 0; z < SEUILS_LUM.length; z++) if (h >= SEUILS_LUM[z]) return z;
  return SEUILS_LUM.length;
};

export function bandesLum(courbe) {
  const out = [];
  let m0 = courbe[0].m;
  let z = zoneLum(courbe[0].h);
  const poser = (m1, zone) => {
    if (m1 > m0 + 0.01) out.push({ a: m0, b: m1, z: zone });
    m0 = Math.max(m0, m1);
  };

  for (let k = 1; k < courbe.length; k++) {
    const a = courbe[k - 1], b = courbe[k];
    const za = zoneLum(a.h), zb = zoneLum(b.h);
    if (za === zb) continue;
    const pas = zb > za ? 1 : -1;
    /* Une même paire de points peut franchir plusieurs seuils aux latitudes
       hautes : ils se traitent dans l'ordre où le temps les rencontre. */
    const franchis = [];
    for (let q = za; q !== zb; q += pas) franchis.push(pas > 0 ? q : q - 1);
    for (const q of franchis) {
      const t = (SEUILS_LUM[q] - a.h) / (b.h - a.h);
      const part = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
      poser(a.m + part * (b.m - a.m), z);
      z += pas;
    }
  }
  poser(courbe[courbe.length - 1].m, z);
  return out;
}

function rubanLumiere(courbe, minutes) {
  const W = 342, H = 54, G = 4, D = 4, Y = 8, EP = 30;
  const x = m => G + (m / 1440) * (W - G - D);

  const rects = bandesLum(courbe).map(b =>
    `<rect class="lm lm-${ZONES_LUM[b.z]}" x="${x(b.a).toFixed(1)}" y="${Y}" `
    + `width="${Math.max(0.6, x(b.b) - x(b.a)).toFixed(1)}" height="${EP}"/>`).join("");

  const deuxCh = n => String(n).padStart(2, "0");
  const traits = [6, 12, 18].map(h =>
    `<line class="lm-grille" x1="${x(h * 60).toFixed(1)}" y1="${Y}" `
    + `x2="${x(h * 60).toFixed(1)}" y2="${Y + EP}"/>`).join("");
  const heures = [0, 6, 12, 18, 24].map((h, k) =>
    `<text class="lm-txt" x="${x(h * 60).toFixed(1)}" y="${H - 2}" `
    + `text-anchor="${k === 0 ? "start" : k === 4 ? "end" : "middle"}">`
    + `${deuxCh(h)} h</text>`).join("");

  const cx = x(Math.max(0, Math.min(1440, minutes)));
  const marque = `<path class="lm-marque" d="M${(cx - 4).toFixed(1)},0 `
    + `L${(cx + 4).toFixed(1)},0 L${cx.toFixed(1)},6 Z"/>`
    + `<line class="lm-fil" x1="${cx.toFixed(1)}" y1="${Y}" `
    + `x2="${cx.toFixed(1)}" y2="${Y + EP}"/>`;

  return `<svg class="lm-r" viewBox="0 0 ${W} ${H}" role="img" `
    + `aria-label="Ruban de la lumière, de minuit à minuit">`
    + `<defs><clipPath id="lmClip">`
    + `<rect x="${G}" y="${Y}" width="${W - G - D}" height="${EP}" rx="7"/></clipPath></defs>`
    + `<g clip-path="url(#lmClip)">${rects}${traits}</g>`
    + marque + heures + `</svg>`;
}

export function vueSoleil() {
  const c = P.chargeCourante();
  const i = P.iJour();
  const g = Reglages.lire();
  if (!c || i < 0 || !Reglages.situe()) {
    return { titre: "Le soleil", corps: `<div class="carte"><p class="vide">Indisponible.</p></div>` };
  }

  const d = c.daily;
  const lever = new Date(d.sunrise[i]).getTime();
  const coucher = new Date(d.sunset[i]).getTime();
  const maintenant = new Date();
  const duree = d.daylight_duration[i];
  const veille = i > 0 ? d.daylight_duration[i - 1] : duree;
  const delta = Math.round((duree - veille) / 60);

  /* Les heures de lever et de coucher viennent d'Open-Meteo, qui fait foi ici.
     Les azimuts, le midi solaire et les crépuscules se calculent sur l'appareil :
     la source ne les porte pas. */
  const e = Astres.evenements("soleil", maintenant, g.lat, g.lon);
  const cr = Astres.crepuscules(maintenant, g.lat, g.lon);
  const courbe = Astres.courbe("soleil", maintenant, g.lat, g.lon, 5);

  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const enMinutes = ms => (ms - minuit.getTime()) / 60000;
  const minutes = enMinutes(maintenant.getTime());

  /* Le jour de passage du seuil de dix heures, dans un sens ou dans l'autre.
     C'est la borne au-delà de laquelle la lumière change de régime. */
  let passage = null;
  const SEUIL = 10 * 3600;
  for (let k = i; k < d.time.length - 1; k++) {
    const a = d.daylight_duration[k], b = d.daylight_duration[k + 1];
    if (a === null || b === null) continue;
    if ((a < SEUIL && b >= SEUIL) || (a >= SEUIL && b < SEUIL)) {
      passage = { date: d.time[k + 1], sens: b >= SEUIL ? "franchit" : "repasse sous" };
      break;
    }
  }

  /* Le prochain évènement, celui que le bandeau annonce en grand. Passé les
     dernières lueurs, c'est l'aube du lendemain. */
  const suite = [
    [cr.civil.matin, "Premières lueurs"],
    [new Date(lever), "Lever du soleil"],
    [e.meridien, "Midi solaire"],
    [new Date(coucher), "Coucher du soleil"],
    [cr.civil.soir, "Dernières lueurs"],
  ].filter(([x]) => x);
  const prochain = suite.find(([x]) => x > maintenant)
    || (cr.civil.matin ? [cr.civil.matin, "Premières lueurs demain"] : null);

  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const etat = p.hauteur >= -0.833
    ? `Soleil à ${Math.round(p.hauteur)}° au-dessus de l'horizon`
    : p.hauteur >= -6 ? "Crépuscule civil, il fait encore clair"
      : p.hauteur >= -12 ? "Crépuscule nautique, le jour s'est retiré"
        : p.hauteur >= -18 ? "Crépuscule astronomique, dernière lueur"
          : "Nuit noire, aucune lueur du Soleil";

  /* Course du jour : les instants du disque, dans l'ordre où ils se vivent. Les
     crépuscules ont leur propre carte, où les trois seuils se comparent ; les
     redire ici en ferait lire deux fois les mêmes heures. */
  const chrono = [
    ["lever", "Lever", e.azimutLever === null ? null : versCardinal(e.azimutLever),
      [hm(lever)], new Date(lever)],
    ["midi", "Midi solaire",
      e.hauteurMax === null ? null : `${Math.round(e.hauteurMax)}° de hauteur`,
      [e.meridien ? hm(e.meridien.getTime()) : "—"], e.meridien],
    ["coucher", "Coucher", e.azimutCoucher === null ? null : versCardinal(e.azimutCoucher),
      [hm(coucher)], new Date(coucher)],
  ];

  const lignes = chrono.map(rangeeAstre(maintenant, prochain)).join("");

  /* Les trois durées qui se partagent les vingt-quatre heures : le disque
     au-dessus de l'horizon, la clarté lueurs comprises, et la part sans aucune
     lueur. La nuit noire se mesure d'un soir à l'aube du lendemain : celle du
     jour même en tient lieu, à deux ou trois minutes près. */
  const clarte = cr.civil.matin && cr.civil.soir
    ? Math.round((cr.civil.soir - cr.civil.matin) / 1000) : null;
  const nuitNoire = cr.astronomique.matin && cr.astronomique.soir
    ? 86400 - Math.round((cr.astronomique.soir - cr.astronomique.matin) / 1000) : 0;

  const mesures = `<div class="tm">`
    + `<div><i>Durée du jour</i><b>${hhmm(duree)}</b>`
    + `<em>${delta === 0 ? "comme hier"
      : `${Math.abs(delta)} min de ${delta > 0 ? "plus" : "moins"} qu'hier`}</em></div>`
    + `<div><i>Clarté</i><b>${clarte === null ? "—" : hhmm(clarte)}</b>`
    + `<em>lueurs comprises</em></div>`
    + `<div><i>Nuit noire</i><b>${nuitNoire > 0 ? hhmm(nuitNoire) : "aucune"}</b>`
    + `<em>${nuitNoire > 0 ? "sans lueur du Soleil" : "le Soleil reste trop haut"}</em></div>`
    + `</div>`;

  /* Les trois seuils, du plus clair au plus sombre, chacun avec son heure du
     matin et son heure du soir. Les deux colonnes disent de quel côté de la
     journée tombe chaque heure : « 05:45 et 21:45 » ne le disait pas. */
  const CREPS = [
    ["civil", "Crépuscule civil", "on distingue encore sans lampe", cr.civil],
    ["naut", "Crépuscule nautique", "l'horizon reste visible en mer", cr.nautique],
    ["astro", "Crépuscule astronomique", "au-delà, la nuit noire", cr.astronomique],
  ];

  const heureCrep = d => {
    if (!d) return `<b class="cp-h">—</b>`;
    const ici = prochain && prochain[0].getTime() === d.getTime() ? " courant" : "";
    return `<b class="cp-h${ici}">${hm(d.getTime())}</b>`;
  };

  const creps = `<div class="cp">`
    + `<span class="cp-t"></span><span class="cp-t">Le matin</span><span class="cp-t">Le soir</span>`
    + CREPS.map(([cle, nom, quoi, v]) =>
      `<span class="cp-n"><i class="cp-p p-${cle}"></i>`
      + `<span><b>${esc(nom)}</b><em>${esc(quoi)}</em></span></span>`
      + (v.matin || v.soir
        ? heureCrep(v.matin) + heureCrep(v.soir)
        : `<span class="cp-abs">le Soleil ne descend pas si bas</span>`)).join("")
    + `</div>`;

  return {
    titre: "Le soleil",
    pleinCadre: true,
    corps: `<div class="plein">${bandeauCiel(g, maintenant, e.meridien)}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>` : `<b>Le soleil</b>`)
      + `<em><span>${esc(etat)}</span></em></div></div>`

      + `<div class="ecran-corps">`
      + `<div class="section"><h2>Trajectoire</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Hauteur dans le ciel</h3>`
      + `<em>Maintenant ${hm(maintenant.getTime())}</em></div>`
      + trajectoire(courbe, enMinutes(lever), enMinutes(coucher), minutes)
      + `</div></div>`

      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte groupe-plat ch">${lignes}</div>`
      + `<div class="carte">${mesures}`
      + (passage ? `<p class="note">La durée du jour ${esc(passage.sens)} dix heures `
        + `le ${esc(jourLong(passage.date))}.</p>` : "")
      + `</div></div>`

      + `<div class="section"><h2>Les crépuscules</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Du jour à la nuit noire</h3></div>`
      + rubanLumiere(courbe, minutes)
      + creps
      + `<p class="note">Les seuils tiennent à la hauteur du Soleil sous l'horizon : `
      + `six degrés pour le civil, douze pour le nautique, dix-huit pour `
      + `l'astronomique. Passé le dernier, plus aucune lueur solaire n'atteint le `
      + `ciel.</p></div></div>`
      + `</div>`,

    brancher(bloc) {
      Feu.poser(bloc.querySelector("#ciFeu"));
    },
  };
}

/* ---------- La lune ---------- */

export function vueLune() {
  const g = Reglages.lire();
  if (!Reglages.situe()) {
    return { titre: "La lune", corps: `<div class="carte"><p class="vide">Indisponible.</p></div>` };
  }

  const maintenant = new Date();
  const p = Astres.phase(maintenant);
  const e = Astres.evenements("lune", maintenant, g.lat, g.lon);
  const l = Astres.lunaison(maintenant);
  const phases = Astres.prochainesPhases(maintenant);

  const courbe = Astres.courbe("lune", maintenant, g.lat, g.lon, 10);
  const fond = Astres.courbe("soleil", maintenant, g.lat, g.lon, 10);

  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const enMinutes = ms => (ms - minuit.getTime()) / 60000;
  const minutes = enMinutes(maintenant.getTime());

  /* Durée au-dessus de l'horizon : la somme des tronçons levés. Un lever du
     soir et un coucher du matin appartiennent à deux passages, leur écart ne
     dirait rien. La courbe suffit à la mesurer au quart d'heure près. */
  let leves = 0;
  for (let k = 1; k < courbe.length; k++) {
    const a = courbe[k - 1].h > Astres.SEUIL.lune;
    const b = courbe[k].h > Astres.SEUIL.lune;
    leves += (a && b) ? 10 : (a || b) ? 5 : 0;
  }
  const duree = leves ? leves * 60 : null;

  /* Le prochain évènement, dans la même grammaire que l'écran du soleil : ce
     qui vient, et à quelle heure.

     Les trois évènements de la Lune ne se suivent pas dans un ordre fixe, la
     journée pouvant commencer avec la Lune déjà levée : ils se trient. Et quand
     la journée n'en garde plus aucun, c'est le premier du lendemain qui vient,
     recalculé plutôt que repris : les heures de la Lune reculent d'environ
     cinquante minutes par jour. */
  const trier = ev => [
    [ev.lever, "Lever de la lune"],
    [ev.meridien, "Passage au méridien"],
    [ev.coucher, "Coucher de la lune"],
  ].filter(([x]) => x).sort((a, b) => a[0] - b[0]);

  let prochain = trier(e).find(([x]) => x > maintenant) || null;
  if (!prochain) {
    const lendemain = new Date(minuit.getFullYear(), minuit.getMonth(), minuit.getDate() + 1);
    const p2 = trier(Astres.evenements("lune", lendemain, g.lat, g.lon))[0];
    if (p2) prochain = [p2[0], `${p2[1]}, demain`];
  }

  const pct = Math.round(p.eclairee * 100);
  const etat = `${p.nom}, ${pct} % éclairée`;

  /* Course du jour : les instants du disque seulement, comme sur l'écran du
     soleil. Les durées sont des mesures, elles ont leur ligne à part. */
  const aucun = [{ doux: "aucun ce jour" }];
  const chrono = [
    ["lever", "Lever", e.lever ? versCardinal(e.azimutLever) : null,
      e.lever ? [hm(e.lever.getTime())] : aucun, e.lever],
    ["meridien", "Passage au méridien",
      e.hauteurMax === null ? null : `${Math.round(e.hauteurMax)}° de hauteur`,
      e.meridien ? [hm(e.meridien.getTime())] : aucun, e.meridien],
    ["coucher", "Coucher", e.coucher ? versCardinal(e.azimutCoucher) : null,
      e.coucher ? [hm(e.coucher.getTime())] : aucun, e.coucher],
  ];

  const lignes = chrono.map(rangeeAstre(maintenant, prochain)).join("");

  /* La part éclairée est déjà dite dans le ciel, en toutes lettres et en
     image : la redire ici ferait lire deux fois la même chose. La place revient
     au temps passé au-dessus de l'horizon, qui ne se lit nulle part ailleurs. */
  const mesures = `<div class="tm">`
    + `<div><i>Au-dessus de l'horizon</i><b>${duree === null ? "—" : hhmm(duree)}</b>`
    + `<em>de minuit à minuit</em></div>`
    + `<div><i>Âge</i><b>${nombreFr(p.age)} j</b><em>depuis la nouvelle</em></div>`
    + `<div><i>Lunaison</i><b>${nombreFr(l.duree)} j</b><em>du cycle en cours</em></div>`
    + `</div>`;

  /* Les quatre prochaines phases : dessins géométriques, non toiles. À quarante
     points, un relief ne se verrait pas et coûterait quatre textures. */
  const bande = `<div class="ph">` + phases.map(x => {
    const eclairee = /Nouvelle/.test(x.nom) ? 0 : /Pleine/.test(x.nom) ? 1 : 0.5;
    const court = x.nom.replace("Nouvelle lune", "Nouvelle").replace("Pleine lune", "Pleine")
      .replace("Premier quartier", "1<sup>er</sup> quartier").replace("Dernier quartier", "Dern. quartier");
    const quand = x.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    /* Le délai autant que la date : « 20 août » ne dit pas si c'est dans deux
       jours ou dans trois semaines. Le jour même se dit, il ne se compte pas. */
    const jours = Math.round((x.date - maintenant) / 86400000);
    const delai = jours <= 0 ? "aujourd'hui" : jours === 1 ? "demain" : `dans ${jours} j`;
    return `<div>${Astres.dessinPhase(eclairee, /Premier/.test(x.nom), 18)}`
      + `<b>${court}</b><em>${esc(quand)}</em><u>${esc(delai)}</u></div>`;
  }).join("") + `</div>`;

  return {
    titre: "La lune",
    pleinCadre: true,
    corps: `<div class="plein">${bandeauLune(g, maintenant, p)}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>`
        : `<b>La lune</b>`)
      /* La forme du disque, à côté de son nom. Dans le ciel du bandeau la Lune
         est à sa place réelle : sous l'horizon, basse derrière le sol ou pâlie
         par le jour, elle ne se voit pas. La vignette la montre toujours. */
      + `<em><canvas class="pt-lune" id="ptLune" `
      + `data-phase="${anglePhase(p.eclairee).toFixed(1)}" `
      + `data-angle="${Astres.angleLimbe(maintenant, g.lat, g.lon).toFixed(4)}" `
      + `data-eclairee="${p.eclairee.toFixed(3)}" aria-hidden="true"></canvas>`
      + `<span>${esc(etat)}</span></em></div></div>`

      + `<div class="ecran-corps">`
      + `<div class="section"><h2>Trajectoire</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Hauteur dans le ciel</h3>`
      + `<em>Maintenant ${hm(maintenant.getTime())}</em></div>`
      + trajectoire(courbe, e.lever ? enMinutes(e.lever.getTime()) : null,
        e.coucher ? enMinutes(e.coucher.getTime()) : null, minutes,
        { fond, teinte: "lune", titre: "Hauteur de la Lune dans le ciel, de minuit à minuit" })
      + `<div class="tr-leg"><span><i></i>Lune</span><span><i class="s"></i>Soleil</span></div>`
      + `</div></div>`

      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte groupe-plat ch ch-lune">${lignes}</div></div>`

      + `<div class="carte">${mesures}</div>`

      + `<div class="section"><h2>Prochaines phases</h2>`
      + `<div class="carte">${bande}`
      + `<p class="note">Positions calculées sur l'appareil, sans source distante. `
      + `Écart de l'ordre de la minute sur les heures, de quelques minutes sur les `
      + `instants de phase.</p></div></div>`
      + `</div>`,

    brancher(bloc) {
      Relief.poser(bloc.querySelector("#ciLune"));
      Relief.vignette(bloc.querySelector("#ptLune"));
    },
  };
}

/* ---------- Réglages et commune ---------- */

/* ---------- Communes suivies ----------

   Deux gestes séparent deux communes : le titre d'écran ouvre cette feuille,
   une rangée bascule. Chaque rangée porte le temps qu'il fait, sans quoi la
   liste ne serait qu'un répertoire de noms.

   La première rangée ne nomme pas un lieu mais l'appareil : Ma position relève
   la position et suit les déplacements. Elle est épinglée en tête et ne se
   retire pas. */

/* Le ciel d'un lieu, en deux couleurs, pour le fond de sa rangée. La hauteur du
   Soleil là-bas donne la teinte, le code de temps sensible la couvre et la
   plombe : la rangée porte le même ciel que l'accueil de ce lieu, en petit. Tout
   se calcule sur l'appareil, sans une requête de plus. */
function fondLieu(l, a) {
  const maintenant = new Date();
  const p = Astres.position("soleil", maintenant, l.lat, l.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const c = cielDe(p.hauteur, (maintenant - minuit) / 60000 < 720);
  return Temps.fond(c, Temps.depuis(a ? a.code : 0, null, null));
}

const styleFond = f => `--co-haut:${f.haut};--co-bas:${f.bas}`;

export function vueCommunes(ctx, rendre, majEtat) {
  const suivies = Reglages.suivies();
  const courante = Reglages.cleCourante();
  const pos = Reglages.position();
  const enPos = Reglages.enPosition();

  /* Chaque rangée porte le ciel de son lieu, la même image qu'en fond d'accueil
     là-bas : la liste se lit d'un coup d'œil, un bleu contre un gris. */
  const rangeePosition = () => {
    const sous = pos?.commune || (pos ? "Position relevée" : "Relever la position");
    const f = pos ? fondLieu(pos, null) : null;
    return `<div class="co co-pos" data-cle="${esc(Reglages.CLE_POSITION)}"`
      + (f ? ` style="${styleFond(f)}"` : ` data-plat`) + `>`
      + `<button type="button" class="co-l" id="coPos"`
      + (enPos ? ` aria-current="true"` : "")
      /* Une fois le relevé pris, le symbole de ciel occupe la même place que sur
         les autres rangées et la cible passe dans le titre, où elle dit que la
         rangée suit l'appareil. Avant le premier relevé, la cible tient seule la
         place du symbole : deux cibles sur une rangée n'apprendraient rien. */
      + `><span class="co-ic"${pos ? " data-ic" : ""}>${ico("cible", "")}</span>`
      + `<span class="co-t"><b>Ma position${pos ? ico("cible", "co-cible") : ""}</b>`
      + `<em data-bornes>${esc(sous)}</em></span>`
      + `<span class="co-d" data-deg>${pos ? `<i class="ossature">00°</i>` : ""}</span>`
      + ico("coche", enPos ? "co-coche" : "co-coche co-coche-vide")
      + `</button></div>`;
  };

  const rangee = (l, k) => {
    const c = Reglages.cleLieu(l);
    const ici = c === courante;
    const nom = l.commune || "Commune";
    /* Monter et descendre sont là pour le clavier et la synthèse vocale : au
       doigt, l'appui long suffit. Les boutons ne se voient qu'au focus, mais ils
       gardent leur taille de cible. */
    return `<div class="co" data-cle="${esc(c)}" style="${styleFond(fondLieu(l, null))}">`
      + `<span class="co-ordre">`
      + `<button type="button" class="co-o" data-monter="${esc(c)}" `
      + `aria-label="Monter ${esc(nom)}">${ico("chevron", "")}</button>`
      + `<button type="button" class="co-o" data-descendre="${esc(c)}" `
      + `aria-label="Descendre ${esc(nom)}">${ico("chevron", "")}</button></span>`
      + `<button type="button" class="co-l" data-k="${k}"`
      + (ici ? ` aria-current="true"` : "")
      + `><span class="co-ic" data-ic></span>`
      + `<span class="co-t"><b>${esc(nom)}</b>`
      + `<em data-bornes>${esc(l.codePostal || "")}</em></span>`
      + `<span class="co-d" data-deg><i class="ossature">00°</i></span>`
      /* La coche garde sa place sur toutes les rangées : sans quoi la colonne
         des températures se décalerait d'une rangée à l'autre. */
      + ico("coche", ici ? "co-coche" : "co-coche co-coche-vide")
      + `</button>`
      + `<button type="button" class="co-x" data-retirer="${esc(c)}">`
      + `Retirer<span class="co-hors">${esc(nom)} des lieux suivis</span></button>`
      + `</div>`;
  };

  const liste = `<div class="carte co-liste" id="coListe">`
    + rangeePosition() + suivies.map(rangee).join("")
    + `<p class="champ-erreur co-err" id="coErr" hidden></p></div>`;

  const plein = suivies.length >= Reglages.MAX_SUIVIES;

  return {
    titre: "Mes lieux",
    /* Ajouter ne vit plus au bas de la liste : c'est une action, elle se range
       dans la tête de feuille, à droite du titre. */
    action: `<button type="button" class="feuille-plus" data-feuille="ajout" `
      + `aria-label="Ajouter un lieu"${plein ? " disabled" : ""}>${ico("plus", "")}</button>`,
    corps: liste
      + `<p class="note">Ma position suit l'appareil et se relève à chaque ouverture. `
      + `Un appui long sur un lieu le déplace dans la liste. Glisser une rangée vers `
      + `la gauche pour la retirer. Le lieu courant porte une coche.</p>`
      + (plein ? `<p class="note">Dix lieux au plus. En retirer un pour en ajouter `
        + `un autre.</p>` : ""),

    brancher(bloc) {
      /* Les températures arrivent après coup : la feuille s'ouvre tout de
         suite, l'ossature tient la place, un seul appel couvre la liste, Ma
         position comprise dès qu'un relevé est connu. */
      const cibles = pos ? [pos, ...suivies] : suivies;
      if (cibles.length) {
        P.apercus(cibles).then(({ par, age }) => {
          for (const el of bloc.querySelectorAll(".co")) {
            const l = el.classList.contains("co-pos")
              ? pos : suivies.find(x => Reglages.cleLieu(x) === el.dataset.cle);
            if (!l) continue;
            const a = par[`${l.lat},${l.lon}`];
            const deg = el.querySelector("[data-deg]");
            const bornes = el.querySelector("[data-bornes]");
            const icone = el.querySelector("[data-ic]");
            if (!a) { deg.textContent = "—"; continue; }
            deg.textContent = `${Math.round(a.t)}°`;
            /* Le ciel de la rangée n'est connu qu'une fois l'aperçu reçu : le
               marquage part d'un ciel dégagé, la couleur juste vient ici. Le
               symbole reste monochrome, un dessin bicolore posé sur un ciel
               peint ne se détacherait plus. */
            if (icone) icone.innerHTML = ico(icoCiel(a.code, a.jour), "");
            const f = fondLieu(l, a);
            el.style.setProperty("--co-haut", f.haut);
            el.style.setProperty("--co-bas", f.bas);
            el.removeAttribute("data-plat");
            /* Sur Ma position, la commune relevée passe avant le code postal :
               c'est elle qui dit où l'appareil se trouve. */
            const tete = el.classList.contains("co-pos")
              ? (l.commune || "") : (l.codePostal || "");
            bornes.textContent = a.tn === null ? tete
              : `${tete ? `${tete} · ` : ""}${Math.round(a.tn)}° à ${Math.round(a.tx)}°`;
          }
          if (age !== null && age > 15 * 60 * 1000) {
            majEtat("Températures de la dernière lecture connue.");
          }
        });
      }

      // Bascule de commune : un appui, la feuille se ferme, la prévision suit.
      for (const b of bloc.querySelectorAll(".co-l[data-k]")) {
        b.addEventListener("click", () => {
          const l = suivies[Number(b.dataset.k)];
          if (Reglages.cleLieu(l) === courante) { rendre({ fermer: true }); return; }
          Reglages.poserLieu(l);
          rendre({ recharger: true, fermer: true });
        });
      }

      /* Ma position : l'appui relève la position, même quand elle est déjà
         courante. C'est le seul moyen de la rafraîchir à la demande, et le
         geste vient de l'utilisateur, ce qu'exigent les navigateurs pour la
         première autorisation. */
      const bPos = bloc.querySelector("#coPos");
      const err = bloc.querySelector("#coErr");
      bPos.addEventListener("click", async () => {
        bPos.disabled = true;
        bPos.setAttribute("aria-busy", "true");
        err.hidden = true;
        majEtat("Recherche de la position…");
        try {
          await Reglages.releverPosition();
          majEtat("");
          rendre({ recharger: true, fermer: true });
        } catch (e) {
          majEtat("");
          err.textContent = e.message;
          err.hidden = false;
        } finally {
          bPos.disabled = false;
          bPos.removeAttribute("aria-busy");
        }
      });

      brancherGlissement(bloc, cle => {
        const { change } = Reglages.retirerSuivie(cle);
        rendre(change ? { recharger: true } : {});
      });

      brancherOrdre(bloc, cles => { Reglages.reordonnerSuivies(cles); rendre(); });

      for (const b of bloc.querySelectorAll("[data-monter],[data-descendre]")) {
        b.addEventListener("click", () => {
          const monte = b.hasAttribute("data-monter");
          Reglages.deplacerSuivie(monte ? b.dataset.monter : b.dataset.descendre, monte ? -1 : 1);
          rendre();
        });
      }
    },
  };
}

/* ---------- Ajouter un lieu ----------

   Une feuille à elle, poussée par le bouton de la tête de « Mes lieux ». Le
   champ occupait le bas de la liste et se faisait oublier ; il tient
   maintenant la page entière, et le clavier s'ouvre dessus. */

export function vueAjout(ctx, rendre, majEtat) {
  const plein = Reglages.suivies().length >= Reglages.MAX_SUIVIES;
  return {
    titre: "Ajouter un lieu",
    corps: `<div class="carte">`
      + `<div class="champ"><label for="rgQ">Nom de commune ou code postal</label>`
      + `<input class="rg-champ" id="rgQ" type="search" inputmode="search" autocomplete="off" `
      + `placeholder="Grenoble, 38000"${plein ? " disabled" : ""}></div>`
      + `<p class="champ-erreur" id="rgErr"${plein ? "" : " hidden"}>`
      + (plein ? `Dix lieux au plus. En retirer un pour en ajouter un autre.` : "")
      + `</p>`
      + `<div class="rg-res" id="rgRes"></div></div>`
      + `<p class="note">La recherche interroge l'interface adresse de data.gouv.fr, `
      + `sans compte ni clé.</p>`,
    brancher(bloc) {
      brancherRecherche(bloc, rendre, majEtat);
      // Le clavier s'ouvre sur le champ : la feuille n'existe que pour lui.
      const q = bloc.querySelector("#rgQ");
      if (q && !plein) requestAnimationFrame(() => q.focus());
    },
  };
}

/* Glissement d'une rangée vers la gauche pour découvrir l'action de retrait.
   Le menu contextuel, appui long ou clic droit, découvre la même action : le
   glissement n'est pas atteignable au clavier. Le bouton reste dans l'ordre de
   tabulation, et le focus ouvre la rangée. */
function brancherGlissement(bloc, retirer) {
  const LARGE = 104;

  // Ma position ne se retire pas : sa rangée n'a pas de bouton, donc pas de glissement.
  for (const el of bloc.querySelectorAll(".co:not(.co-pos)")) {
    const l = el.querySelector(".co-l");
    let x0 = null, y0 = null, glisse = false, ouvert = false;

    const poser = v => { l.style.transform = v ? `translateX(${-LARGE}px)` : ""; ouvert = v; };

    l.addEventListener("pointerdown", ev => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      x0 = ev.clientX; y0 = ev.clientY; glisse = false;
    });

    l.addEventListener("pointermove", ev => {
      if (x0 === null) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!glisse) {
        if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
        glisse = true;
        l.style.transition = "none";
        l.setPointerCapture(ev.pointerId);
      }
      const base = ouvert ? -LARGE : 0;
      const v = Math.max(-LARGE, Math.min(0, base + dx));
      l.style.transform = `translateX(${v}px)`;
    });

    const fin = () => {
      if (x0 === null) return;
      const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(l.style.transform || "");
      const v = m ? Number(m[1]) : 0;
      l.style.transition = "";
      if (glisse) poser(v < -LARGE / 2);
      x0 = null;
    };
    l.addEventListener("pointerup", fin);
    l.addEventListener("pointercancel", fin);

    // Un glissement ne doit pas valoir appui.
    l.addEventListener("click", ev => { if (glisse) { ev.preventDefault(); ev.stopPropagation(); } }, true);

    el.addEventListener("contextmenu", ev => { ev.preventDefault(); poser(!ouvert); });
    el.querySelector(".co-x").addEventListener("focus", () => poser(true));
    el.querySelector(".co-x").addEventListener("blur", () => poser(false));
    el.querySelector(".co-x").addEventListener("click", () => retirer(el.dataset.cle));
  }
}

/* Recherche de commune par le nom ou le code postal. La position, elle, tient
   dans la rangée épinglée en tête de liste. */
/* Réordonner par appui long. Un déplacement avant la fin du délai annule la
   prise : le glissement de retrait garde donc son geste, et la liste n'a pas
   besoin d'un mode d'édition. Une fois la prise faite, la rangée capture le
   pointeur, ce qui met le glissement hors circuit pour la durée du
   déplacement. */
function brancherOrdre(bloc, ordonner) {
  const liste = bloc.querySelector("#coListe");
  if (!liste) return;
  const DELAI = 300, SEUIL = 10;
  const rangs = () => [...liste.querySelectorAll(".co:not(.co-pos)")];

  for (const el of rangs()) {
    let minuteur = null, x0 = 0, y0 = 0, prise = false, bouge = false;

    const annuler = () => { clearTimeout(minuteur); minuteur = null; };

    const lacher = () => {
      annuler();
      if (!prise) return;
      prise = false;
      el.classList.remove("co-prise");
      liste.classList.remove("co-ordonne");
      if (bouge) ordonner(rangs().map(x => x.dataset.cle));
    };

    el.addEventListener("pointerdown", ev => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      x0 = ev.clientX; y0 = ev.clientY; bouge = false;
      minuteur = setTimeout(() => {
        minuteur = null;
        prise = true;
        el.classList.add("co-prise");
        liste.classList.add("co-ordonne");
        el.setPointerCapture(ev.pointerId);
        if (navigator.vibrate) navigator.vibrate(8);
      }, DELAI);
    });

    el.addEventListener("pointermove", ev => {
      if (!prise) {
        if (minuteur !== null
          && (Math.abs(ev.clientX - x0) > SEUIL || Math.abs(ev.clientY - y0) > SEUIL)) annuler();
        return;
      }
      ev.preventDefault();
      /* La rangée se déplace dans le document plutôt que sous un calque : la
         liste montre en direct l'ordre qu'elle prendra. */
      for (const f of rangs()) {
        if (f === el) continue;
        const b = f.getBoundingClientRect();
        const milieu = b.top + b.height / 2;
        const apres = Boolean(f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (ev.clientY < milieu && apres) { liste.insertBefore(el, f); bouge = true; break; }
        if (ev.clientY > milieu && !apres) { liste.insertBefore(el, f.nextSibling); bouge = true; break; }
      }
    });

    el.addEventListener("pointerup", lacher);
    el.addEventListener("pointercancel", lacher);
    // Un appui long n'est pas un appui : il ne doit pas basculer de lieu.
    el.addEventListener("click", ev => {
      if (bouge) { ev.preventDefault(); ev.stopPropagation(); bouge = false; }
    }, true);
  }
}

function brancherRecherche(bloc, rendre, majEtat) {
  const q = bloc.querySelector("#rgQ");
  const res = bloc.querySelector("#rgRes");
  const err = bloc.querySelector("#rgErr");
  if (!q) return;
  let minuteur = null;

  /* L'erreur se montre sous le champ concerné, non dans une alerte globale ni
     au milieu de la liste des résultats. */
  const dire = t => {
    err.textContent = t || "";
    err.hidden = !t;
    q.setAttribute("aria-invalid", t ? "true" : "false");
  };

  const poser = lieu => {
    Reglages.poserLieu(lieu);
    rendre({ recharger: true, fermer: true });
  };

  const chercher = async () => {
    const saisie = q.value.trim();
    res.innerHTML = "";
    if (saisie.length < 2) { dire(""); return; }
    const l = await Reglages.chercherCommune(saisie);
    if (!l.length) { dire("Aucune commune ne correspond à cette saisie."); return; }
    dire("");
    res.innerHTML = l.map((x, k) =>
      `<button type="button" data-k="${k}">${esc(x.commune)}`
      + `<em>${esc(x.codePostal || "")}</em></button>`).join("");
    for (const b of res.querySelectorAll("button")) {
      b.addEventListener("click", () => poser(l[Number(b.dataset.k)]));
    }
  };

  q.addEventListener("input", () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(chercher, 260);
  });
}

export function vueReglages(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  const c = P.chargeCourante();

  const sources = [
    ["Prévision", "Open-Meteo, AROME de Météo-France forcé sur les deux premiers jours"],
    ["Recherche de commune", "interface adresse de data.gouv.fr"],
    ["Vigilance", "renvoi vers Météo-France"],
  ];

  return {
    titre: "Réglages",
    corps:
      `<div class="carte"><div class="carte-tete"><h3>Écriture de l'écran Le temps</h3></div>`
      + `<div class="seg">` + Reglages.ECRITURES.map(([k, n]) =>
        `<button type="button" data-ecriture="${k}"${k === g.ecriture ? ' class="actif"' : ""}>${esc(n)}</button>`)
        .join("") + `</div></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Sources</h3></div>`
      + sources.map(([n, v]) => `<div class="rangee"><span class="rangee-txt">${esc(n)}</span>`
        + `<span class="rangee-val">${esc(v)}</span></div>`).join("")
      + (g.lat !== null ? `<div class="rangee"><span class="rangee-txt">Coordonnées</span>`
        + `<span class="rangee-val">${esc(`${g.lat}, ${g.lon}`)}</span></div>` : "")
      + `</div>`

      + `<p class="note">Aucun compte, aucune base de données, aucune donnée envoyée. `
      + `Les réglages restent sur cet appareil.</p>`,

    brancher(bloc) {
      for (const b of bloc.querySelectorAll("[data-ecriture]")) {
        b.addEventListener("click", () => {
          Reglages.poserEcriture(b.dataset.ecriture);
          for (const x of bloc.querySelectorAll("[data-ecriture]")) {
            x.classList.toggle("actif", x === b);
          }
        });
      }
    },
  };
}
/* ---------- Mesure contre modèle ---------- */
