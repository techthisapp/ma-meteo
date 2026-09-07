/* Le vent, matérialisé par des particules qui suivent le champ.

   Le vent est la seule des trois nappes qui ne se dise pas par une couleur : ce
   qui compte est sa direction, et une direction se montre par du mouvement. Les
   particules avancent dans le sens où le vent souffle, laissent une traînée
   courte, vieillissent et renaissent ailleurs.

   L'allure est graphique, non physique. À la vue de la France entière, un pixel
   couvre environ deux kilomètres et demi : un vent de trente kilomètres par
   heure y avancerait de trois millièmes de pixel par seconde, c'est-à-dire rien.
   La vitesse à l'écran est donc proportionnelle à la force et indépendante du
   zoom. Ce qui se lit est la direction et la force relative, non une distance
   parcourue.

   Les particules vivent en latitude et longitude, non en pixels : elles restent
   accrochées au sol pendant qu'on déplace la carte. La toile s'efface alors
   entièrement, une traînée peinte à l'ancienne place n'ayant plus de sens.

   Même contrat que les trois autres toiles animées du dépôt, le feu, le relief
   et le temps : trente images par seconde, arrêt hors du document ou de l'onglet
   visible, image fixe sous mouvement réduit. */

import { metresParPixel, surEcran } from "./carte.js";

export const PAS = 33;

/* Une particule pour trois cents points d'écran, soit environ neuf cents sur un
   téléphone. Assez pour que le flux se lise d'un coup d'œil, assez
   peu pour qu'aucune image ne coûte plus d'une milliseconde. */
export const DENSITE = 1 / 300;
export const PARTICULES_MAX = 1400;

/* La durée de vie borne la longueur d'une trajectoire. Sans elle, les
   particules s'accumulent dans les zones où le champ converge et désertent le
   reste de la carte. La valeur porte une part d'aléa, faute de quoi elles
   renaîtraient toutes ensemble et le flux battrait. */
export const VIE = 84;
export const VIE_ALEA = 40;

/* Pixels par seconde et par kilomètre par heure. Un vent modéré de trente
   avance de vingt-cinq points par seconde, une traversée de l'écran en quinze
   secondes. */
export const ALLURE = 0.85;

/* L'effacement de chaque image fait la traînée : plus il est faible, plus elle
   est longue. Il agit en proportion, non par soustraction : après n images, il
   reste (1 - EFFACEMENT) puissance n de l'encre posée. Une trace cesse de se
   voir vers cinq centièmes d'opacité, ce qui fait ici vingt-quatre images, soit
   quatre cinquièmes de seconde.

   Réglé d'abord à six centièmes, il laissait des traits de quarante points qui
   se lisaient comme une pluie oblique, non comme un flux. */
export const EFFACEMENT = 0.12;
const SEUIL_VU = 0.05;

/* La longueur qu'une traînée atteint à l'écran, en points, pour une force
   donnée : le pas d'une image multiplié par le nombre d'images pendant
   lesquelles l'encre reste visible. La légende s'en sert pour montrer ce que
   valent trois forces, seule chose qui distingue un vent léger d'un vent fort
   sur cette carte. */
export const IMAGES_VUES = Math.log(SEUIL_VU) / Math.log(1 - EFFACEMENT);
export const longueurTrace = v => ALLURE * v * (PAS / 1000) * IMAGES_VUES;

const RAYON_TERRE_LAT = 110540;   // mètres par degré de latitude
const RAYON_TERRE_LON = 111320;   // mètres par degré de longitude à l'équateur

/* Le vent se donne par sa provenance : un vent de nord vient du nord et souffle
   vers le sud. Les composantes rendues vont vers où il souffle, en fractions
   d'une unité de déplacement. */
export function composantes(direction) {
  const r = (direction * Math.PI) / 180;
  return { est: -Math.sin(r), nord: -Math.cos(r) };
}

/* Le point atteint après un déplacement de `pixels` pixels d'écran, la vue
   donnant le nombre de mètres qu'un pixel couvre. */
export function avancerPoint(lat, lon, direction, pixels, mpp) {
  const c = composantes(direction);
  const metres = pixels * mpp;
  const cos = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  return {
    lat: lat + (c.nord * metres) / RAYON_TERRE_LAT,
    lon: lon + (c.est * metres) / (RAYON_TERRE_LON * cos),
  };
}

/* ---------- Le troupeau ---------- */

const alea = (a, b) => a + Math.random() * (b - a);

function naitre(p, emprise) {
  p.lat = alea(emprise.S, emprise.N);
  p.lon = alea(emprise.O, emprise.E);
  p.age = Math.round(alea(0, VIE + VIE_ALEA));
  p.neuve = true;
  return p;
}

export function creer(n, emprise) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(naitre({}, emprise));
  return out;
}

/* ---------- Boucle ----------

   `lire` rend l'état courant de la carte : la vue, le champ et l'emprise. Il est
   appelé à chaque image plutôt que posé une fois, le cadrage changeant sous le
   doigt. */

let toile = null;
let lireEtat = null;
let troupeau = [];
let boucle = null;
let derniere = 0;
let vuePrecedente = "";

const figee = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const cleVue = v => `${v.lat.toFixed(5)},${v.lon.toFixed(5)},${v.z.toFixed(3)}`;

function peindre(cv, ctx, etat, l, h, avecMouvement) {
  const { vue, champ, emprise, couleur } = etat;
  const mpp = metresParPixel(vue);

  /* Un changement de cadrage efface tout : les traînées sont peintes à des
     places qui ne désignent plus le même endroit. */
  const cle = cleVue(vue);
  if (cle !== vuePrecedente) {
    ctx.clearRect(0, 0, l, h);
    vuePrecedente = cle;
  } else if (avecMouvement) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${EFFACEMENT})`;
    ctx.fillRect(0, 0, l, h);
    ctx.restore();
  }

  const voulu = Math.min(PARTICULES_MAX, Math.round(l * h * DENSITE));
  if (troupeau.length !== voulu) troupeau = creer(voulu, emprise);

  ctx.strokeStyle = couleur;
  ctx.lineWidth = 1.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  let tracees = 0;
  for (const p of troupeau) {
    const v = champ(p.lat, p.lon);
    if (v === null || !Number.isFinite(v.vitesse) || !Number.isFinite(v.direction)) {
      naitre(p, emprise);
      continue;
    }
    const a = surEcran(vue, p.lat, p.lon, l, h);
    const pas = ALLURE * v.vitesse * (PAS / 1000);
    const suite = avancerPoint(p.lat, p.lon, v.direction, avecMouvement ? pas : 0, mpp);
    const b = surEcran(vue, suite.lat, suite.lon, l, h);
    p.lat = suite.lat;
    p.lon = suite.lon;
    p.age -= 1;

    const dedans = b.x > -20 && b.x < l + 20 && b.y > -20 && b.y < h + 20;
    if (p.age <= 0 || !dedans) { naitre(p, emprise); continue; }
    if (p.neuve) { p.neuve = false; continue; }
    /* Une particule immobile se dessine quand même : un vent nul est un fait,
       et un point sans trace se lit comme une donnée manquante. */
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    tracees++;
  }
  if (tracees) ctx.stroke();
  if (tracees) adoucirBords(ctx, vue, emprise, l, h);
  return tracees;
}

/* Le champ s'arrête au bord de son emprise, qui est un rectangle. Sans rien, les
   particules cessent sur une ligne droite en pleine mer, ce qui se lit comme un
   défaut de dessin plutôt que comme une limite de donnée. Une bande de fondu le
   long de chacun des quatre bords rend cette limite à ce qu'elle est. */
export const FONDU = 26;

function adoucirBords(ctx, vue, emprise, l, h) {
  const coin = (lat, lon) => surEcran(vue, lat, lon, l, h);
  const ho = coin(emprise.N, emprise.O), bd = coin(emprise.S, emprise.E);
  const bandes = [
    [ho.x, 0, ho.x + FONDU, 0],
    [bd.x, 0, bd.x - FONDU, 0],
    [0, ho.y, 0, ho.y + FONDU],
    [0, bd.y, 0, bd.y - FONDU],
  ];
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (const [x0, y0, x1, y1] of bandes) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    const vertical = x0 === x1;
    if (vertical) ctx.fillRect(0, Math.min(y0, y1) - FONDU, l, FONDU * 2);
    else ctx.fillRect(Math.min(x0, x1) - FONDU, 0, FONDU * 2, h);
  }
  ctx.restore();
}

function image(ms) {
  if (!toile || !toile.isConnected) { arreter(); return; }
  boucle = requestAnimationFrame(image);
  if (ms - derniere < PAS) return;
  derniere = ms;
  rendre(true);
}

function rendre(avecMouvement) {
  const etat = lireEtat && lireEtat();
  if (!toile || !etat || !etat.champ) return 0;
  const dpr = window.devicePixelRatio || 1;
  const l = toile.clientWidth || 320, h = toile.clientHeight || 320;
  if (toile.width !== Math.round(l * dpr) || toile.height !== Math.round(h * dpr)) {
    toile.width = Math.round(l * dpr);
    toile.height = Math.round(h * dpr);
    vuePrecedente = "";
  }
  const ctx = toile.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return peindre(toile, ctx, etat, l, h, avecMouvement);
}

/* Pose la toile à animer. `null` arrête la boucle et rend la toile vide : c'est
   ce que fait l'extinction de la couche, et tout rendu d'écran. */
export function poser(cv, lire) {
  arreter();
  /* La toile qu'on lâche est vidée : l'encre d'une couche éteinte resterait
     sinon posée sur la carte jusqu'au prochain rendu d'écran. */
  const vider = t => {
    if (!t) return;
    const c = t.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, t.width, t.height);
  };
  if (toile && toile !== cv) vider(toile);
  toile = cv || null;
  lireEtat = cv ? lire : null;
  troupeau = [];
  vuePrecedente = "";
  if (!cv) return;
  vider(cv);
  /* Sous mouvement réduit, une image fixe : les traînées disent le champ sans
     rien animer. */
  if (figee()) { rendre(true); rendre(false); return; }
  derniere = 0;
  boucle = requestAnimationFrame(image);
}

export function arreter() {
  if (boucle !== null) { cancelAnimationFrame(boucle); boucle = null; }
}

export function anime() { return boucle !== null; }

document.addEventListener("visibilitychange", () => {
  if (document.hidden) arreter();
  else if (toile && toile.isConnected && !figee() && boucle === null) {
    derniere = 0;
    boucle = requestAnimationFrame(image);
  }
});
