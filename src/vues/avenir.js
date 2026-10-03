/* L'écran « À venir » : graphique, grandes lignes, journées, confiance. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { nombreFr, jourCourt, esc } from "../horloge.js";
import * as P from "../previsions.js";
import { ico, icoTemps, icoCiel, tempsDe, couleurT } from "../icones.js";
import { liste, moments, TRANCHES } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Ensemble from "../ensemble.js";
import * as Scenarios from "../scenarios.js";
import { angleFleche, TRACE_FLECHE } from "../fleche.js";
import { SEUILS, grandesLignes, conseilsHTML, tendanceSuivante } from "../conseils.js";
import { valeur, aide } from "./communs.js";

/* ---------- La table de la semaine ---------- */


/* L'état déplié de La semaine, jalon 17 : commun au graphique et à la liste,
   gardé le temps de la séance. */
let semaineEtendue = false;

export const basculerSemaine = () => (semaineEtendue = !semaineEtendue);

export const semaineEstEtendue = () => semaineEtendue;

function boutonSemaine(dispo) {
  if (semaineEtendue) return `<button type="button" class="sem-plus" data-semaine-plus aria-expanded="true">Voir moins</button>`;
  return dispo ? `<button type="button" class="sem-plus" data-semaine-plus aria-expanded="false">`
    + `Voir plus, la tendance jusqu'à cinq semaines</button>` : "";
}

function etatTendance(g, tend) {
  if (!semaineEtendue || tend?.length) return "";
  return `<p class="note sem-tend-etat">${Scenarios.tendanceEnEchec(g)
    ? "La tendance au-delà de seize jours n'a pas pu être lue." : "Lecture de la tendance…"}</p>`;
}

/* La charge quotidienne prolongée par les journées de tendance qui suivent sa
   dernière date, dans la même forme : la liste et le graphique les lisent
   comme les autres. Le symbole se tire de la part des scénarios pluvieux. */
export function etendreQuotidien(d, tend) {
  if (!tend?.length) return d;
  const dernier = d.time[d.time.length - 1];
  const plus = tend.filter(t => t.date > dernier);
  if (!plus.length) return d;
  const x = { ...d };
  const ajoute = (cle, f) => { x[cle] = [...(d[cle] || d.time.map(() => null)), ...plus.map(f)]; };
  ajoute("time", t => t.date);
  ajoute("temperature_2m_max", t => t.tx);
  ajoute("temperature_2m_min", t => t.tn);
  ajoute("precipitation_sum", t => t.mm);
  ajoute("precipitation_probability_max", t => t.pb);
  ajoute("weather_code", t => (t.pb >= 50 ? 61 : 2));
  for (const cle of ["wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant"]) {
    if (d[cle]) ajoute(cle, () => null);
  }
  return x;
}

export function vueSemaine() {
  const c = P.chargeCourante();
  const i = P.iJour();
  const g = Reglages.lire();
  if (!c || i < 0) return { titre: "À venir", corps: `<div class="carte"><p class="vide">Prévision indisponible.</p></div>` };

  /* La table commence aux journées écoulées que les heures couvrent, et non à
     aujourd'hui. La charge quotidienne en porte quatorze, les heures deux : une
     rangée plus ancienne n'aurait ni ses quatre moments ni ses bornes tirées de
     la même source que les autres, et se serait ouverte sur rien. */
  const debut = Math.max(0, i - P.JOURS_PASSES);
  /* Seize jours à venir depuis le 28 septembre 2026, jalon 13 : la charge
     quotidienne les porte, la vue les montre tous. */
  /* Jalon 17 : La semaine va aussi loin que les données portent. Par défaut,
     elle s'arrête au dernier jour dont la confiance est calculée, le quinzième
     avec ICON et ECMWF ; « Voir plus » déplie le seizième jour de la prévision
     puis la tendance de GFS jusqu'au trente-quatrième, dans le graphique comme
     dans la liste. */
  const nPrev = c.daily.time.length;
  const finPrev = Math.min(i + 16, nPrev);
  let lim = -1;
  for (let k = i; k < finPrev; k++) {
    if (Scenarios.jour(c.daily.time[k]) || Ensemble.journee(c.daily.time[k])) lim = k;
  }
  const finCourt = lim >= i ? lim + 1 : finPrev;
  const tend = semaineEtendue ? Scenarios.tendancePour(g) : null;
  const dd = etendreQuotidien(c.daily, tend);
  const fin = semaineEtendue ? Math.min(i + 35, dd.time.length) : finCourt;
  const plusDispo = lim >= i;
  const lignes = [];
  /* Une borne absente de la charge reste absente : `Math.min` et `Math.round`
     en faisaient zéro, l'échelle descendait à 0° et la rangée l'écrivait.
     Audit du 1er octobre 2026, constat 1.11. */
  const fini = v => (Number.isFinite(v) ? v : null);
  let tmin = Infinity, tmax = -Infinity;
  for (let k = debut; k < fin; k++) {
    const h = P.jourHoraire(dd.time[k]);
    const a = fini(h ? h.tn : dd.temperature_2m_min[k]), b = fini(h ? h.tx : dd.temperature_2m_max[k]);
    if (a !== null) tmin = Math.min(tmin, a);
    if (b !== null) tmax = Math.max(tmax, b);
  }
  if (!Number.isFinite(tmin) || !Number.isFinite(tmax)) { tmin = 0; tmax = 1; }
  const amp = Math.max(1, tmax - tmin);

  const maintenant = P.serieHoraire()?.t?.[0] ?? null;
  const heureCourante = new Date().getHours();
  const jours = [];

  for (let k = debut; k < fin; k++) {
    /* Les heures là où elles couvrent la journée entière, la charge quotidienne
       au-delà. Deux sources pour un seul jour font des contradictions dans une
       même feuille. */
    const h = P.jourHoraire(dd.time[k]);
    const tn = fini(h ? h.tn : dd.temperature_2m_min[k]);
    const tx = fini(h ? h.tx : dd.temperature_2m_max[k]);
    const bornes = tn !== null && tx !== null;
    const mm = h ? h.mm : dd.precipitation_sum[k];
    const pb = h ? h.pb : dd.precipitation_probability_max[k];
    const code = h ? h.code : dd.weather_code[k];

    /* Trois journées portent un nom propre, celles qu'on désigne par un mot
       plutôt que par une date : hier, aujourd'hui, demain. « Avant-hier » ne
       tient pas dans la colonne, qui fait soixante-quatre points, et le nom
       court y suffit comme il suffit après-demain. */
    const nom = k === i ? "Auj." : k === i + 1 ? "Demain"
      : k === i - 1 ? "Hier" : jourCourt(dd.time[k]);
    const date = new Date(`${dd.time[k]}T12:00`)
      .toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

    /* La plage du jour se pose sur l'échelle commune de la semaine : deux
       journées se comparent d'un coup d'œil, ce qu'une barre partant toujours
       de la gauche interdisait. */
    const gauche = ((tn - tmin) / amp) * 100;
    const large = Math.max(3, ((tx - tn) / amp) * 100);

    /* La pluie se lit sous le symbole, non dans une colonne à elle : la colonne
       repoussait la rangée sur trois lignes dès que la lame était écrite. */
    /* Une journée de tendance dit la part de ses scénarios pluvieux : une
       moyenne de pluie à cinq semaines, deux millimètres presque chaque jour,
       prêtait à la tendance une précision qu'elle n'a pas. */
    const eau = k >= nPrev ? (pb >= SEUILS.risque ? `${Math.round(pb)} %` : "")
      : mm >= SEUILS.lame ? `${nombreFr(mm)} mm` : pb >= SEUILS.risque ? `${Math.round(pb)} %` : "";

    const pointe = k === i && maintenant !== null
      ? `<u class="sem-pt" style="left:${(((maintenant - tmin) / amp) * 100).toFixed(1)}%"></u>`
      : "";

    const mo = P.momentsJour(dd.time[k]);
    const cle = `sm-${dd.time[k]}`;
    jours.push({ nom: k === i + 1 ? "Dem." : nom, tn, tx, mm, passe: k < i, auj: k === i, tend: k >= nPrev,
      /* Au-delà des sept premiers jours, le graphique ajoute le numéro du jour :
         la seconde semaine répétait « lun », « mar » sans dire laquelle. */
      num: k >= i + 7 ? Number(dd.time[k].slice(8, 10)) : null,
      pb, code, vent: dd.wind_speed_10m_max?.[k] ?? null,
      raf: dd.wind_gusts_10m_max?.[k] ?? null, dir: dd.wind_direction_10m_dominant?.[k] ?? null,
      long: k === i ? "aujourd'hui" : k === i + 1 ? "demain"
        : new Date(`${dd.time[k]}T12:00`).toLocaleDateString("fr-FR", { weekday: "long" }) });

    /* Le niveau de confiance se lit sur la ligne, sans déplier, demandé par
       Jérôme le 25 septembre 2026, jalon 12, lot 2. Il se pose sous la barre,
       où la colonne est la plus large, et la barre s'estompe à ses extrémités
       quand la confiance baisse. Les jours passés et ceux que les scénarios
       ne couvrent pas n'en portent pas. */
    /* Depuis le jalon 13, la confiance vient des scénarios quotidiens des deux
       modèles, mixte sur leur recouvrement, ECMWF seul jusqu'au quinzième jour ;
       à défaut, de l'ensemble horaire d'ICON, comme avant. */
    /* Une journée de tendance ne porte jamais de confiance : ses chiffres
       viennent de GFS, et une confiance d'ICON ou d'ECMWF parlerait d'autres
       données que les siennes. */
    const prevue = k >= i && k < nPrev;
    const sc = prevue ? Scenarios.jour(dd.time[k]) : null;
    const ens = !sc && prevue ? Ensemble.journee(dd.time[k]) : null;
    const accord = sc ? Scenarios.accordDe(sc.etendue) : ens ? Ensemble.accordDe(ens.etendue).nom : null;

    const corps = `<span class="j"><b>${esc(nom)}</b><em>${esc(date)}</em></span>`
      /* Le nom du ciel et les mots minimum et maximum, en texte lu par les
         lecteurs d'écran : le dessin est masqué et les bornes ne se
         nommaient pas. Audit du 1er octobre 2026, constat 4.4. */
      + `<span class="c">${icoTemps(icoCiel(code, true), "")}<span class="titre-lu">${esc(tempsDe(code)[1])}</span>`
      /* Les rafales fortes sur la ligne, jalon 12, lot 5, comme dans la bande :
         seulement à 40 km/h et plus depuis le 3 octobre 2026, le seuil commun, là où les heures les donnent, la charge
         quotidienne n'en portant pas. Et seulement quand la pluie n'occupe
         pas déjà la ligne : trois lignes sous le symbole faisaient dépasser
         la rangée de sa hauteur de deux lignes. Quand les deux se
         rencontrent, les rafales restent dans le volet, où chaque moment les
         dit. */
      + (eau ? `<em>${esc(eau)}</em>`
        : h?.raf >= P.SEUIL_RAFALE ? `<em class="sem-raf">raf. ${Math.round(h.raf)}</em>` : "") + `</span>`
      + `<span class="b"><span class="titre-lu">minimum</span><b class="sem-min">${tn === null ? "—" : `${Math.round(tn)}°`}</b>`
      + `<span class="sem-pc"><i class="sem-piste">`
      + (bornes ? `<s class="sem-plage${accord ? ` sem-${accord}` : ""}" `
        + `style="left:${gauche.toFixed(1)}%;`
        + `width:${large.toFixed(1)}%;`
        + `background:linear-gradient(90deg, ${couleurT(tn)}, ${couleurT(tx)})"></s>` : "")
      + pointe + `</i>`
      /* Trois mots qui tiennent seuls dans la largeur de la barre : « confiance
         moyenne » passait sur deux lignes. Le volet garde la phrase complète. */
      + (accord ? `<em class="sem-conf">${esc({ bonne: "fiable", moyenne: "à confirmer", faible: "incertain" }[accord])}</em>` : "")
      + `</span>`
      + `<span class="titre-lu">maximum</span><b class="sem-max">${tx === null ? "—" : `${Math.round(tx)}°`}</b></span>`;

    /* Une journée sans heures complètes ne s'ouvre pas, et ne porte alors pas
       de chevron : une cible qui ne mène à rien vaut moins qu'aucune cible. */
    /* Au-delà des sept jours d'heures, la journée n'a pas de moments ; si les
       scénarios la couvrent, elle se déplie sur sa seule phrase de confiance,
       pour que la comparaison des modèles se lise jusqu'au quinzième jour. */
    const phraseLoin = !mo && k >= i && k < nPrev ? confiance(dd.time[k]) : "";
    const tete = mo || phraseLoin
      ? `<button type="button" class="sem-r${mo ? "" : " sem-loin"}" data-jour="${esc(dd.time[k])}" `
        + `aria-expanded="false" aria-controls="${cle}">${corps}`
        + ico("chevron_bas", "sem-chev") + `</button>`
      : `<div class="sem-r sem-fixe">${corps}</div>`;

    /* Une journée écoulée s'efface, comme un moment passé dans un volet ou la
       part écoulée de la course du Soleil. Sans cela la table paraissait
       commencer avant-hier, et l'œil cherchait aujourd'hui. */
    /* Le week-end se repère d'un fond léger, jalon 12, lot 5 : c'est là qu'on
       cherche d'abord dans une semaine. Et le volet mène aux heures de la
       journée, dans le ruban calé sur elle. */
    const jourSem = new Date(`${dd.time[k]}T12:00`).getDay();
    const weekEnd = jourSem === 0 || jourSem === 6;
    lignes.push(`<div class="sem-j${k === i ? " sem-auj" : ""}`
      + `${k < i ? " sem-passe" : ""}${weekEnd ? " sem-we" : ""}${k >= nPrev ? " sem-tend" : ""}">${tete}`
      + (mo ? `<div class="md" id="${cle}" hidden>${volet(mo, k === i, heureCourante)}`
        + `${confiance(dd.time[k])}`
        + `<button type="button" class="sem-heures" data-jour-heures="${esc(dd.time[k])}">Voir les heures</button>`
        + `</div>`
        : phraseLoin ? `<div class="md md-loin" id="${cle}" hidden>${phraseLoin}</div>` : "")
      + `</div>`);
  }

  return {
    titre: "À venir",
    corps: grapheSemaine(jours, boutonSemaine(plusDispo)) + grandesLignesHTML(jours)
      + `<div class="carte sem-carte"><div class="sem">${lignes.join("")}</div>`
      + etatTendance(g, tend) + boutonSemaine(plusDispo)
      /* Jalon 20 : l'explication derrière le « i », les modèles dans les
         sources des réglages. */
      + aide(`La prévision est la plus fine sur les trois premiers jours.${tend?.length
        ? " Au-delà de seize jours, ce n'est qu'une tendance : la pluie y dit la part des scénarios pluvieux." : ""}`)
      + `</div>`,
    brancher(bloc) { brancherSemaine(bloc); },
  };
}

/* Le graphique de tête de La semaine, jalon 12, lot 3 : la courbe des
   maximums et celle des minimums sur les dix jours, chaque point avec sa
   valeur, et la pluie en barres au pied. La liste garde ses barres : le
   graphique montre la tendance de la semaine, la barre situe chaque journée à
   côté de son nom. Les jours passés sont sur un fond atténué, aujourd'hui sur
   le même fond léger que la colonne « Maint. » de la bande horaire. Le dessin
   a une largeur fixe et une largeur d'affichage bornée, pour que ses textes ne
   grossissent pas en paysage, le défaut relevé sur le ruban. */
/* Les grandes lignes de la semaine, entre le graphique et la liste, dans la
   forme des conseils de l'accueil. */
function grandesLignesHTML(jours) {
  /* Les sept premiers jours seulement : au-delà, la prévision dit une tendance,
     et une grande ligne sur un jour lointain promettrait plus qu'elle ne sait. */
  const avenir = jours.filter(j => !j.passe);
  const l = grandesLignes(avenir.slice(0, 7).map(j => ({ ...j, nom: j.long })));
  /* La semaine suivante, en une ligne de tendance, après les grandes lignes. */
  const t = tendanceSuivante(avenir.slice(0, 7), avenir.slice(7, 14));
  if (t) l.push(t);
  return l.length ? `<div class="carte retenir sem-lignes"><div class="conseils">${conseilsHTML(l)}</div></div>` : "";
}

export function grapheSemaine(jours, basDeCarte = "") {
  const n = jours.length;
  if (n < 2) return "";
  /* Trois bandes depuis le 28 septembre 2026 : les températures, puis le vent,
     puis la pluie avec sa quantité écrite. Le vent a sa bande à lui : des
     kilomètres par heure ne se lisent pas sur l'échelle des degrés. Il se dit
     par les rafales du jour et la flèche de sa direction dominante, la vitesse
     moyenne la plus forte à défaut de rafales. */
  const avecVent = jours.some(j => Number.isFinite(j.raf ?? j.vent));
  /* Au-delà de dix journées, les colonnes gardent une largeur fixe et le
     graphique défile sous le doigt, ouvert sur les premiers jours : seize jours
     tassés dans la largeur de l'écran mêleraient leurs étiquettes. */
  const defile = n > 10;
  /* Quarante-deux points par colonne : à trente-quatre, « sam 24 » et « dim 25 »
     se touchaient. */
  const COL = 42;
  const L = defile ? 8 + n * COL : 340, H = avecVent ? 214 : 176, bord = 4, col = (L - 2 * bord) / n;
  const x = k => bord + (k + 0.5) * col;
  /* Seules les bornes connues entrent dans l'échelle ; une borne absente ne
     se trace pas et coupe la ligne. Audit, constat 1.11. */
  const connues = cle => jours.map(j => j[cle]).filter(Number.isFinite);
  const mn = connues("tn").length ? Math.min(...connues("tn")) : 0;
  const mx = connues("tx").length ? Math.max(...connues("tx")) : 1;
  const amp = Math.max(4, mx - mn);
  const haut = 24, bas = 96;
  const y = t => bas - ((t - mn) / amp) * (bas - haut);
  const pied = H - 20, pluieMax = 20;
  const ventDe = j => (Number.isFinite(j.raf) ? j.raf : Number.isFinite(j.vent) ? j.vent : null);
  const vHaut = 124, vBas = 150;
  const vMax = Math.max(30, ...jours.map(j => ventDe(j) ?? 0));
  const yv = v => vBas - (v / vMax) * (vBas - vHaut);
  const fonds = jours.map((j, k) => (j.passe || j.auj || j.tend)
    ? `<rect class="sg-${j.auj ? "auj" : j.tend ? "tend" : "passe"}" x="${(x(k) - col / 2 + 1).toFixed(1)}" y="2" `
      + `width="${(col - 2).toFixed(1)}" height="${H - 4}" rx="10"/>` : "").join("");
  const ligne = (cle, cls) => {
    const troncons = [[]];
    jours.forEach((j, k) => {
      if (Number.isFinite(j[cle])) troncons[troncons.length - 1].push(`${x(k).toFixed(1)},${y(j[cle]).toFixed(1)}`);
      else if (troncons[troncons.length - 1].length) troncons.push([]);
    });
    return troncons.filter(t => t.length > 1)
      .map(t => `<polyline class="${cls}" fill="none" points="${t.join(" ")}"/>`).join("");
  };
  const points = (cle, cls, dy) => jours.map((j, k) => !Number.isFinite(j[cle]) ? "" :
    `<circle class="${cls}" cx="${x(k).toFixed(1)}" cy="${y(j[cle]).toFixed(1)}" r="2.6"/>`
    + `<text class="sg-v${j.passe ? " sg-p" : ""}" x="${x(k).toFixed(1)}" y="${(y(j[cle]) + dy).toFixed(1)}">`
    + `${Math.round(j[cle])}°</text>`).join("");
  const pluie = jours.map((j, k) => {
    if (!(j.mm >= SEUILS.lame)) return "";
    const h = Math.max(2, Math.min(1, j.mm / 10) * pluieMax);
    /* La quantité se lit au-dessus de la barre, en millimètres. */
    const q = j.tend ? "" : j.mm >= 10 ? String(Math.round(j.mm)) : nombreFr(Math.round(j.mm * 10) / 10);
    return `<rect class="sg-pluie${j.passe ? " sg-p" : ""}" x="${(x(k) - col * 0.2).toFixed(1)}" `
      + `y="${(pied - h).toFixed(1)}" width="${(col * 0.4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`
      + `<text class="sg-mm${j.passe ? " sg-p" : ""}" x="${x(k).toFixed(1)}" y="${(pied - h - 3).toFixed(1)}">${q}</text>`;
  }).join("");
  const vent = !avecVent ? "" : `<polyline class="sg-vent" fill="none" points="`
    + jours.map((j, k) => (ventDe(j) === null ? "" : `${x(k).toFixed(1)},${yv(ventDe(j)).toFixed(1)}`)).filter(Boolean).join(" ")
    + `"/>` + jours.map((j, k) => {
      const v = ventDe(j);
      if (v === null) return "";
      const fl = Number.isFinite(j.dir)
        ? `<g transform="translate(${(x(k) - 11).toFixed(1)},${(yv(v) - 15).toFixed(1)}) scale(0.72)">`
          + `<g transform="rotate(${angleFleche(j.dir)} 7 7)">${TRACE_FLECHE}</g></g>` : "";
      return `<circle class="sg-pvent" cx="${x(k).toFixed(1)}" cy="${yv(v).toFixed(1)}" r="2"/>`
        + `<text class="sg-kmh${j.passe ? " sg-p" : ""}" x="${(x(k) + 4).toFixed(1)}" y="${(yv(v) - 6).toFixed(1)}">${Math.round(v)}</text>`
        + `<g class="sg-fl${j.passe ? " sg-p" : ""}">${fl}</g>`;
    }).join("");
  const noms = jours.map((j, k) =>
    `<text class="sg-j${j.passe ? " sg-p" : ""}${j.auj ? " sg-a" : ""}" x="${x(k).toFixed(1)}" y="${H - 5}">`
    + `${esc(j.num ? `${j.nom} ${j.num}` : j.nom)}</text>`).join("");
  const avenir = jours.filter(j => !j.passe);
  const total = avenir.reduce((a, j) => a + (j.mm || 0), 0);
  const rafMax = Math.max(0, ...avenir.map(j => ventDe(j) ?? 0));
  const txAvenir = avenir.map(j => j.tx).filter(Number.isFinite);
  const resume = (txAvenir.length ? `De ${Math.round(Math.min(...txAvenir))} à `
    + `${Math.round(Math.max(...txAvenir))} degrés au plus chaud` : "Températures inconnues")
    + (total >= SEUILS.lame ? `, ${nombreFr(total)} millimètres de pluie en tout` : ", sans pluie")
    + (avecVent && rafMax > 0 ? `, vent jusqu'à ${Math.round(rafMax)} kilomètres par heure.` : ".");
  return `<div class="carte sem-graphe"><div class="bande-tete"><h3>${avecVent ? "Températures, vent et pluie" : "Températures et pluie"}</h3></div>`
    + (defile ? `<div class="sg-defil">` : "")
    + `<svg class="sg${defile ? " sg-large" : ""}" viewBox="0 0 ${L} ${H}"`
    + (defile ? ` width="${L}" height="${H}"` : "") + ` role="img" aria-label="${esc(resume)}">`
    + fonds + pluie + vent + ligne("tx", "sg-max") + ligne("tn", "sg-min")
    + points("tx", "sg-pmax", -7) + points("tn", "sg-pmin", 14) + noms
    + `</svg>` + (defile ? `</div>` : "") + aide(avecVent ? "Rafales en kilomètres par heure, pluie en millimètres." : "Pluie en millimètres.") + `${basDeCarte}</div>`;
}

/* L'accord des scénarios sur une journée, écrit en toutes lettres sous ses
   quatre moments. Un chiffre de dispersion ne se lit pas : « six degrés
   d'étendue » ne dit rien à qui n'a pas l'habitude, quand « les scénarios sont
   partagés, de 18 à 27 degrés au plus chaud » dit à la fois l'accord et ce
   qu'il recouvre.

   La ligne ne paraît que sur les journées que l'ensemble couvre entières : il
   porte sept jours annoncés et aucun jour écoulé, la table en demande neuf. */
function confiance(date) {
  const p = phraseConfiance(Scenarios.jour(date));
  if (p) return p;
  return confianceHoraire(date);
}

/* Les deux modèles, jalon 13 : la fourchette de chacun, et s'ils s'accordent.
   Au-delà de sept jours, ECMWF parle seul, et la phrase le dit. */
export function phraseConfiance(s) {
  if (s) {
    const f = r => `de ${Math.round(r.p10)} à ${Math.round(r.p90)}°`;
    const nom = Scenarios.accordDe(s.etendue);
    if (s.source === "mixte") {
      const accord = s.ecart >= 2 ? `s'écartent de ${Math.round(s.ecart)}°` : "s'accordent";
      return `<p class="md-sc">Confiance ${esc(nom)} : ICON et ECMWF ${accord}, `
        + `ICON ${f(s.icon)}, ECMWF ${f(s.ecmwf)} au plus chaud.</p>`;
    }
    const seul = s.source === "ecmwf" ? "ECMWF" : "ICON";
    return `<p class="md-sc">Confiance ${esc(nom)} : ${seul} seul${s.source === "ecmwf" ? " au-delà de sept jours" : ""}, `
      + `${f(s.reunis)} au plus chaud.</p>`;
  }
  return "";
}

function confianceHoraire(date) {
  const j = Ensemble.journee(date);
  if (!j) return "";
  const a = Ensemble.accordDe(j.etendue);
  return `<p class="md-sc">Confiance ${esc(a.nom)} : ${esc(a.phrase)}, `
    + `de ${Math.round(j.mini)} à ${Math.round(j.maxi)}° au plus chaud.</p>`;
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
