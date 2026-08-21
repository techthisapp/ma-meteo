/* Les vues de la feuille. Chacune rend un titre, un sous-titre facultatif, un
   corps et un branchement facultatif. */

import { nombreFr, hhmm, jourCourt, jourLong, esc, departementDe } from "./horloge.js";
import * as P from "./previsions.js";
import { ico, icoTemps, icoCiel, tempsDe } from "./icones.js";
import { conseilsHTML } from "./conseils.js";
import * as Ruban from "./ruban.js";
import { liste, moments } from "./ecritures.js";
import * as Reglages from "./reglages.js";
import * as Astres from "./astres.js";
import * as Feu from "./feu.js";
import * as Relief from "./relief.js";
import * as Temps from "./temps.js";

/* ---------- Fragments communs ---------- */

const hm = ms => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const CARDINAUX = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
const cardinalDe = az => CARDINAUX[Math.round((((az % 360) + 360) % 360) / 45) % 8];

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
  const corps = e === "liste" ? liste(s) : e === "moments" ? moments(s) : Ruban.dessiner(s);
  const seg = `<div class="seg">` + Reglages.ECRITURES.map(([c, n]) =>
    `<button type="button" data-ecriture="${c}"${c === e ? ' class="actif"' : ""}>${esc(n)}</button>`)
    .join("") + `</div>`;

  const conseils = conseilsHTML(s);
  const tete = conseils ? `<div class="conseils">${conseils}</div>` : "";

  return {
    titre: "Le temps",
    sousEcran: `${nombreFr(s.t[0])}° et ${tempsDe(s.code[0])[1].toLowerCase()}`,
    corps: `${seg}${tete}<div class="carte">${corps}</div>`,
    brancher(bloc) {
      for (const b of bloc.querySelectorAll("[data-ecriture]")) {
        b.addEventListener("click", () => { Reglages.poserEcriture(b.dataset.ecriture); rendre(); });
      }
      if (e === "ruban") Ruban.brancher(bloc, rendre);
    },
  };
}

/* ---------- La table de la semaine ---------- */

/* Teinte d'une température, du bleu froid au rouge chaud. Saturation et clarté
   restent constantes pour que la rampe se tienne sur les deux thèmes. La
   couleur double le chiffre, elle ne le remplace jamais. */
const ARRETS = [[-5, 214], [4, 196], [11, 158], [18, 52], [25, 30], [33, 8]];
const couleurT = t => {
  if (t === null || !Number.isFinite(t)) return "var(--etiquette-3)";
  let h = ARRETS[ARRETS.length - 1][1];
  if (t <= ARRETS[0][0]) h = ARRETS[0][1];
  else {
    for (let k = 0; k < ARRETS.length - 1; k++) {
      const [t0, h0] = ARRETS[k], [t1, h1] = ARRETS[k + 1];
      if (t >= t0 && t <= t1) { h = h0 + ((t - t0) / (t1 - t0)) * (h1 - h0); break; }
    }
  }
  return `hsl(${h.toFixed(0)} 54% 47%)`;
};

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

    lignes.push(`<tr${k === i ? ' class="sem-auj"' : ""}>`
      + `<td class="j"><b>${esc(nom)}</b><em>${esc(date)}</em></td>`
      + `<td class="c">${icoTemps(icoCiel(code, true), "")}`
      + (eau ? `<em>${esc(eau)}</em>` : "") + `</td>`
      + `<td class="b"><b class="sem-min">${Math.round(tn)}°</b>`
      + `<i class="sem-piste"><s class="sem-plage" style="left:${gauche.toFixed(1)}%;`
      + `width:${large.toFixed(1)}%;`
      + `background:linear-gradient(90deg, ${couleurT(tn)}, ${couleurT(tx)})"></s>`
      + pointe + `</i>`
      + `<b class="sem-max">${Math.round(tx)}°</b></td></tr>`);
  }

  return {
    titre: "La semaine",
    corps: `<div class="carte"><table class="sem"><tbody>${lignes.join("")}</tbody></table>`
      + `<p class="note">Aujourd'hui et demain se résument des heures, les jours `
      + `suivants de la charge quotidienne.</p></div>`,
  };
}

/* ---------- Vigilance ----------

   Renvoi vers Météo-France, non affichage du jeu archivé de data.gouv.fr.

   Le module `vigilance.js` sait lire ce jeu et son schéma est vérifié, mais
   l'archive avait quatorze jours de retard au 19 août 2026. Une vigilance n'a de
   sens que si elle est en vigueur : servir un bulletin de quinze jours serait
   pire que renvoyer vers la source qui fait foi. */

export function vueVigilance() {
  const g = Reglages.lire();
  const dep = departementDe(g.codePostal);
  const lien = "https://vigilance.meteofrance.fr/fr";

  return {
    titre: "Vigilance",
    corps:
      `<div class="carte">`
      + `<p class="prose">La vigilance météorologique en vigueur `
      + `est publiée par Météo-France. Elle couvre le vent violent, la pluie et l'inondation, `
      + `les orages, les crues, la neige et le verglas, la canicule, le grand froid, les `
      + `avalanches, les vagues et la submersion.</p>`
      + `<a class="lien-plein" href="${lien}" target="_blank" rel="noopener noreferrer">`
      + `<span>Ouvrir la vigilance${dep ? ` du département ${esc(dep)}` : ""}</span>`
      + `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" `
      + `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">`
      + `<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`
      + `</svg></a></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Pourquoi ce renvoi</h3></div>`
      + `<p class="prose-2">Le jeu ouvert `
      + `« Vigilance météorologique archivée » de data.gouv.fr porte le même contenu sans `
      + `demander de compte, mais c'est une archive et non un flux : au 19 août 2026, son `
      + `dernier bulletin datait du 5 août. Une vigilance de quatorze jours ne dit rien du `
      + `temps qu'il fait. L'application ne l'affiche donc pas.</p></div>`,
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

/* Le panneau, commun aux deux bandeaux. Il ne sait rien de l'astre qu'il
   porte : le Soleil et la Lune lui passent leur place et leur toile. */
function panneauCiel(c, x, y, sous, corps, temps = "") {
  return `<div class="ci" style="`
    + `--ci-haut:${c.haut};--ci-bas:${c.bas};--ci-sol-haut:${c.solHaut};--ci-sol:${c.sol};`
    + `--ci-nuit:${c.nuit.toFixed(2)};--ci-jour:${c.jour.toFixed(2)}">`
    + `<div class="ci-etoiles" aria-hidden="true">${ETOILES}</div>`
    + (corps ? `<div class="ci-astre${sous ? " sous" : ""}" `
      + `style="--ax:${x.toFixed(1)}%;--ay:${y.toFixed(1)}%">${corps}</div>` : "")
    + temps
    + `<div class="ci-sol"></div><div class="ci-horizon"></div>`
    + `<div class="ci-voile-haut"></div><div class="ci-voile-bas"></div>`
    + `</div>`;
}

function bandeauCiel(g, maintenant, meridien) {
  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const montant = meridien ? maintenant < meridien : minutes < 720;
  const c = cielDe(p.hauteur, montant);

  /* L'abscisse suit l'avancement du jour, l'ordonnée la hauteur : le disque
     est à sa place, non sur un arc supposé. */
  const corps = `<canvas class="ci-feu" id="ciFeu" data-chaud="${c.chaud.toFixed(3)}" `
    + `role="img" aria-label="Le Soleil dans le ciel"></canvas>`;
  return panneauCiel(c, (minutes / 1440) * 100, ordonnee(p.hauteur),
    p.hauteur < -0.833, corps);
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

  const az = ((pl.azimut % 360) + 360) % 360;
  const x = Math.max(3, Math.min(97, (az - 55) / 250 * 100));
  const chaud = Math.max(0, Math.min(1, (12 - pl.hauteur) / 20));
  // L'angle de phase se déduit de la part éclairée, qui vaut (1 + cos i) / 2.
  const angleI = Math.acos(Math.max(-1, Math.min(1, 2 * phase.eclairee - 1))) / (Math.PI / 180);
  const angle = Astres.angleLimbe(maintenant, g.lat, g.lon);

  const corps = `<canvas class="ci-lune" id="ciLune" `
    + `data-phase="${angleI.toFixed(1)}" data-angle="${angle.toFixed(4)}" `
    + `data-eclairee="${phase.eclairee.toFixed(3)}" data-clarte="${c.clarte.toFixed(3)}" `
    + `data-chaud="${chaud.toFixed(3)}" role="img" aria-label="La Lune dans le ciel"></canvas>`;
  return panneauCiel(c, x, ordonnee(pl.hauteur), pl.hauteur < 0.125, corps);
}

/* Le bandeau de l'accueil. Même panneau que les deux autres, avec le temps
   qu'il fait peint par-dessus l'astre : un nuage passe devant le Soleil, non
   derrière. De jour le Soleil, de nuit la Lune, et sous une couche fermée ni
   l'un ni l'autre, seule reste la lueur diffuse à l'endroit où l'astre se
   tient. */
export function bandeauAccueil(g, maintenant, p, vent) {
  const ps = Astres.position("soleil", maintenant, g.lat, g.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const minutes = (maintenant - minuit) / 60000;
  const c = cielDe(ps.hauteur, minutes < 720);
  const voile = Temps.voileDe(p);
  const visible = voile < Temps.SEUIL_VOILE;

  let astre, x, y, sous, corps = "";
  if (ps.hauteur > -6) {
    x = (minutes / 1440) * 100;
    y = ordonnee(ps.hauteur);
    sous = ps.hauteur < Astres.SEUIL.soleil;
    astre = { sorte: "soleil", x: x / 100, y: y / 100 };
    if (visible) {
      corps = `<canvas class="ci-feu" id="ciFeu" data-chaud="${c.chaud.toFixed(3)}" `
        + `role="img" aria-label="Le Soleil dans le ciel"></canvas>`;
    }
  } else {
    const pl = Astres.position("lune", maintenant, g.lat, g.lon);
    const ph = Astres.phase(maintenant);
    const az = ((pl.azimut % 360) + 360) % 360;
    x = Math.max(3, Math.min(97, (az - 55) / 250 * 100));
    y = ordonnee(pl.hauteur);
    sous = pl.hauteur < Astres.SEUIL.lune;
    astre = { sorte: "lune", x: x / 100, y: y / 100 };
    if (visible) {
      const angleI = Math.acos(Math.max(-1, Math.min(1, 2 * ph.eclairee - 1))) / (Math.PI / 180);
      const chaud = Math.max(0, Math.min(1, (12 - pl.hauteur) / 20));
      corps = `<canvas class="ci-lune" id="ciLune" `
        + `data-phase="${angleI.toFixed(1)}" `
        + `data-angle="${Astres.angleLimbe(maintenant, g.lat, g.lon).toFixed(4)}" `
        + `data-eclairee="${ph.eclairee.toFixed(3)}" data-clarte="${c.clarte.toFixed(3)}" `
        + `data-chaud="${chaud.toFixed(3)}" role="img" aria-label="La Lune dans le ciel"></canvas>`;
    }
  }

  /* L'astre pâlit et se dilue sous une couche mince : le voile est porté par le
     panneau, la toile de l'astre n'a rien à en savoir. */
  const toile = `<canvas class="ci-temps" id="ciTemps" aria-hidden="true" `
    + Temps.attributs(p, c, vent, astre) + `></canvas>`;
  return panneauCiel(c, x, y, sous,
    corps && voile > 0 ? `<div class="ci-voile" style="--voile:${voile.toFixed(2)}">${corps}</div>`
      : corps, toile);
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
    ? `Soleil à ${Math.round(p.hauteur)}° au dessus de l'horizon`
    : p.hauteur >= -6 ? "Le jour se retire" : "Le Soleil est sous l'horizon";

  /* Course du jour, dans l'ordre où elle se vit. Ce qui est passé s'efface,
     ce qui vient est en couleur. */
  const chrono = [
    ["lueur", "Premières lueurs", [cr.civil.matin ? hm(cr.civil.matin.getTime()) : "—"],
      cr.civil.matin],
    ["lever", "Lever",
      [hm(lever), e.azimutLever === null ? null : { doux: cardinalDe(e.azimutLever) }],
      new Date(lever)],
    ["midi", "Midi solaire", [e.meridien ? hm(e.meridien.getTime()) : "—"], e.meridien],
    ["coucher", "Coucher",
      [hm(coucher), e.azimutCoucher === null ? null : { doux: cardinalDe(e.azimutCoucher) }],
      new Date(coucher)],
    ["lune", "Dernières lueurs", [cr.civil.soir ? hm(cr.civil.soir.getTime()) : "—"], cr.civil.soir],
    ["horloge", "Lumière du jour", [hhmm(duree)], null],
  ];

  const lignes = chrono.map(([sym, nom, parts, quand]) => {
    const passe = quand && quand < maintenant;
    const courant = prochain && quand && quand.getTime() === prochain[0].getTime();
    return `<div class="rangee${passe ? " passe" : ""}${courant ? " courant" : ""}">`
      + ico(sym, "") + `<span class="rangee-txt">${esc(nom)}</span>`
      + valeur(...parts) + `</div>`;
  }).join("");

  const mesures = `<div class="tm">`
    + `<div><i>Hauteur maximale</i>`
    + `<b>${e.hauteurMax === null ? "—" : `${Math.round(e.hauteurMax)}°`}</b>`
    + `<em>${e.meridien ? hm(e.meridien.getTime()) : ""}</em></div>`
    + `<div><i>Durée du jour</i><b>${hhmm(duree)}</b>`
    + `<em>${hm(lever)} à ${hm(coucher)}</em></div>`
    + `<div><i>Écart à la veille</i><b>${delta >= 0 ? "+" : "−"} ${Math.abs(delta)} min</b>`
    + `<em>${delta >= 0 ? "plus de lumière" : "moins de lumière"}</em></div>`
    + `</div>`;

  const cieux = [
    ["Crépuscule nautique", cr.nautique],
    ["Nuit noire", cr.astronomique],
  ].map(([n, v]) => `<div class="rangee"><span class="rangee-txt">${esc(n)}</span>`
    + (v.matin && v.soir
      ? valeur(hm(v.matin.getTime()), { doux: "et" }, hm(v.soir.getTime()))
      : valeur({ doux: "le Soleil ne descend pas si bas" }))
    + `</div>`).join("");

  return {
    titre: "Le soleil",
    pleinCadre: true,
    corps: `<div class="plein">${bandeauCiel(g, maintenant, e.meridien)}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>` : `<b>Le soleil</b>`)
      + `<em>${esc(etat)}</em></div></div>`

      + `<div class="ecran-corps">`
      + `<div class="section"><h2>Trajectoire</h2>`
      + `<div class="carte"><div class="carte-tete"><h3>Hauteur dans le ciel</h3>`
      + `<em>Maintenant ${hm(maintenant.getTime())}</em></div>`
      + trajectoire(courbe, enMinutes(lever), enMinutes(coucher), minutes)
      + `</div></div>`

      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte groupe-plat ch">${lignes}</div></div>`

      + `<div class="carte">${mesures}`
      + (passage ? `<p class="note">La durée du jour ${esc(passage.sens)} dix heures `
        + `le ${esc(jourLong(passage.date))}.</p>` : "")
      + `</div>`

      + `<div class="section"><h2>Fin et retour de la lumière</h2>`
      + `<div class="carte">${cieux}`
      + `<p class="note">Le crépuscule civil borne la lecture au dehors, le nautique `
      + `l'horizon en mer, la nuit noire l'absence de lueur solaire.</p></div></div>`
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

  const etat = `${p.nom}, ${Math.round(p.eclairee * 100)} % éclairée`;

  const aucun = [{ doux: "aucun ce jour" }];
  const chrono = [
    ["lever", "Lever", e.lever
      ? [hm(e.lever.getTime()), { doux: cardinalDe(e.azimutLever) }] : aucun, e.lever],
    ["meridien", "Passage au méridien",
      e.meridien ? [hm(e.meridien.getTime())] : aucun, e.meridien],
    ["coucher", "Coucher", e.coucher
      ? [hm(e.coucher.getTime()), { doux: cardinalDe(e.azimutCoucher) }] : aucun, e.coucher],
    ["culmination", "Hauteur maximale",
      [e.hauteurMax === null ? "—" : `${Math.round(e.hauteurMax)}°`], null],
    ["horloge", "Durée au-dessus de l'horizon", [duree === null ? "—" : hhmm(duree)], null],
  ];

  const lignes = chrono.map(([sym, nom, parts, quand]) => {
    const passe = quand && quand < maintenant;
    const courant = prochain && quand && quand.getTime() === prochain[0].getTime();
    return `<div class="rangee${passe ? " passe" : ""}${courant ? " courant" : ""}">`
      + ico(sym, "") + `<span class="rangee-txt">${esc(nom)}</span>`
      + valeur(...parts) + `</div>`;
  }).join("");

  const pct = Math.round(p.eclairee * 100);
  const sens = pct >= 99 ? "au plus plein" : pct <= 1 ? "au plus mince"
    : p.croissante ? "croissante" : "décroissante";

  const mesures = `<div class="tm">`
    + `<div><i>Part éclairée</i><b>${pct} %</b><em>${esc(sens)}</em></div>`
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
    return `<div>${Astres.dessinPhase(eclairee, /Premier/.test(x.nom), 18)}`
      + `<b>${court}</b><em>${esc(quand)}</em></div>`;
  }).join("") + `</div>`;

  return {
    titre: "La lune",
    pleinCadre: true,
    corps: `<div class="plein">${bandeauLune(g, maintenant, p)}`
      + `<div class="plein-titre">`
      + (prochain ? `<i>${esc(prochain[1])}</i><b>${hm(prochain[0].getTime())}</b>`
        : `<b>La lune</b>`)
      + `<em>${esc(etat)}</em></div></div>`

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

export function vueCommunes(ctx, rendre, majEtat) {
  const suivies = Reglages.suivies();
  const courante = Reglages.cleCourante();
  const pos = Reglages.position();
  const enPos = Reglages.enPosition();

  const rangeePosition = () => {
    const sous = pos?.commune || (pos ? "Position relevée" : "Relever la position");
    return `<div class="co co-pos" data-cle="${esc(Reglages.CLE_POSITION)}">`
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
    return `<div class="co" data-cle="${esc(c)}">`
      + `<button type="button" class="co-l" data-k="${k}"`
      + (ici ? ` aria-current="true"` : "")
      + `><span class="co-ic" data-ic></span>`
      + `<span class="co-t"><b>${esc(l.commune || "Commune")}</b>`
      + `<em data-bornes>${esc(l.codePostal || "")}</em></span>`
      + `<span class="co-d" data-deg><i class="ossature">00°</i></span>`
      /* La coche garde sa place sur toutes les rangées : sans quoi la colonne
         des températures se décalerait d'une rangée à l'autre. */
      + ico("coche", ici ? "co-coche" : "co-coche co-coche-vide")
      + `</button>`
      + `<button type="button" class="co-x" data-retirer="${esc(c)}">`
      + `Retirer<span class="co-hors">${esc(l.commune || "")} des communes suivies</span></button>`
      + `</div>`;
  };

  const liste = `<div class="carte co-liste" id="coListe">`
    + rangeePosition() + suivies.map(rangee).join("")
    + `<p class="champ-erreur co-err" id="coErr" hidden></p></div>`;

  const plein = suivies.length >= Reglages.MAX_SUIVIES;

  return {
    titre: "Communes",
    corps: liste
      + `<div class="carte"><div class="carte-tete"><h3>Ajouter</h3></div>`
      + `<div class="champ"><label for="rgQ">Nom de commune ou code postal</label>`
      + `<input class="rg-champ" id="rgQ" type="search" inputmode="search" autocomplete="off" `
      + `placeholder="Grenoble, 38000"${plein ? " disabled" : ""}></div>`
      + `<p class="champ-erreur" id="rgErr"${plein ? "" : " hidden"}>`
      + (plein ? `Dix communes suivies au plus. En retirer une pour en ajouter une autre.` : "")
      + `</p>`
      + `<div class="rg-res" id="rgRes"></div></div>`
      + `<p class="note">Ma position suit l'appareil et se relève à chaque ouverture. `
      + `Glisser une rangée vers la gauche pour retirer la commune. Le lieu courant `
      + `porte une coche.</p>`,

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
            if (icone) icone.innerHTML = icoTemps(icoCiel(a.code, a.jour), "");
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

      brancherRecherche(bloc, rendre, majEtat);
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
