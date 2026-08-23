/* Ce qui est à savoir des heures qui viennent.

   Une règle ne parle que si elle a quelque chose à dire. « Aucune lame annoncée
   d'ici demain 16 h » occupait la première ligne tous les jours de beau temps :
   une phrase qu'on lit cent fois pour n'y rien apprendre finit par cacher celles
   qui comptent. Le silence est l'état par défaut, et la section disparaît quand
   il n'y a rien.

   Chaque ligne porte sa portée, en heures. C'est elle qui donne son titre à la
   section : le lecteur sait jusqu'où porte ce qu'il lit, sans avoir à relire
   chaque phrase.

   Les seuils sont ceux du document de reprise, et ils sont uniques : le bandeau
   et cette section portaient dans « Mon jardin » deux jeux distincts pour le
   gel, la chaleur et le vent, si bien que le bandeau pouvait se taire sur un gel
   que la section annonçait, sur le même écran. */

import { nombreFr, heureTxt, esc } from "./horloge.js";
import { plagesDe, divergencePluie } from "./previsions.js";
import { ico } from "./icones.js";

export const SEUILS = {
  lame: 0.1,          // millimètres, seuil de mention unique
  risque: 5,          // pour cent, seuil de mention unique
  gel: 1,             // degrés
  rafale: 40,         // kilomètres par heure
  ventMoyen: 25,      // kilomètres par heure
  chaleur: 30,        // degrés
  humidite: 90,       // pour cent
  humiditeHeures: 4,  // heures consécutives
  humiditeTmin: 10,   // degrés
  humiditeTmax: 26,   // degrés
  uv: 7,              // indice
  alerteLame: 15,     // millimètres, alerte du bandeau
  risqueSeul: 40,     // pour cent, seuil d'une ligne de risque à elle seule
  couvert: 60,        // pour cent de couverture, seuil du ciel couvert
  tenue: 3,           // heures, durée qu'une bascule de ciel doit tenir
  bascule: 6,         // degrés, écart qui vaut un refroidissement ou un réchauffement
  ressenti: 5,        // degrés, écart entre le ressenti et la température
  pression: 6,        // hectopascals, variation qui annonce un changement
  astreProche: 3,     // heures, au-delà desquelles un lever ou un coucher n'est plus un fait
};

const ORAGE = [95, 96, 99];
const NEIGE = [71, 73, 75, 77, 85, 86];
const BROUILLARD = [45, 48];

// Quatre lignes au plus : au-delà, la section cesse d'être un résumé.
const LIGNES_MAX = 4;

export function conseils(s, g) {
  if (!s) return [];
  const H = k => heureTxt(s.heure[k]);
  const dem = k => (s.jour[k] !== s.jour[0] ? "demain " : "") + H(k);

  /* La borne de fin est l'heure qui suit la dernière heure de la plage, et c'est
     son jour qui décide du mot « demain ». Le test portait sur la seule heure
     vingt-trois : une plage finissant à quatorze heures le lendemain s'écrivait
     « de 16 h à 14 h », une fin avant son début. */
  const fin = k => {
    const change = k + 1 < s.n
      ? s.jour[k + 1] !== s.jour[0]
      : s.jour[k] !== s.jour[0] || s.heure[k] === 23;
    return (change ? "demain " : "") + heureTxt((s.heure[k] + 1) % 24);
  };

  /* Une plage s'écrit avec le mot « demain » une seule fois. « De demain 03 h à
     demain 06 h » se lisait deux fois pour une seule journée. */
  const plage = (a, b) => {
    const debutDemain = s.jour[a] !== s.jour[0];
    const finTxt = fin(b);
    const finDemain = finTxt.startsWith("demain ");
    if (debutDemain && finDemain) {
      return `demain de ${H(a)} à ${finTxt.slice(7)}`;
    }
    return `de ${dem(a)} à ${finTxt}`;
  };

  const lignes = [];
  /* `h` est la portée de la ligne, en heures à partir de maintenant : c'est
     l'heure qui suit le dernier instant dont elle parle. La section en tire son
     titre. */
  const dire = (i, g, h, t) => lignes.push({ i, g, h: h + 1, t });
  const plagesCode = codes => plagesDe(s.n, k => codes.includes(s.code[k]));

  // 1. L'orage, qui passe avant tout le reste.
  const or = plagesCode(ORAGE);
  if (or.length) {
    dire("orage", 10, or[or.length - 1][1],
      `Orages annoncés ${plage(or[0][0], or[or.length - 1][1])}.`);
  }

  // 2. La neige, avec sa lame quand elle est mesurable.
  const ne = plagesCode(NEIGE);
  if (ne.length) {
    const mmNe = ne.reduce((a, [x, y]) => {
      let t = a; for (let k = x; k <= y; k++) t += s.mm[k]; return t;
    }, 0);
    dire("neige", 9.5, ne[ne.length - 1][1],
      `Neige annoncée ${plage(ne[0][0], ne[ne.length - 1][1])}`
      + (mmNe >= SEUILS.lame ? `, ${nombreFr(mmNe)} mm attendus.` : "."));
  }

  /* 3. La pluie. Elle ne parle que s'il en tombe, ou si les deux modèles ne
     s'accordent pas, ou si le risque est assez fort pour qu'on s'en soucie. */
  const pl = plagesDe(s.n, k => s.mm[k] >= SEUILS.lame);
  const tot = s.mm.reduce((a, b) => a + b, 0);
  const div = divergencePluie(s);

  if (div && !ne.length) {
    /* Quand les deux modèles ne s'accordent pas, c'est la ligne de pluie qui le
       dit : deux lignes, l'une affirmative et l'autre dubitative, se
       contrediraient à la lecture. */
    dire("goutte", 9, s.n - 1, div.bas < SEUILS.lame
      ? `Pluie incertaine, jusqu'à ${nombreFr(div.haut)} mm selon le modèle.`
      : `Pluie incertaine, de ${nombreFr(div.bas)} à ${nombreFr(div.haut)} mm `
        + `selon le modèle.`);
  } else if (pl.length && !ne.length) {
    dire("goutte", 9, pl[pl.length - 1][1],
      `Pluie ${pl.length > 1 ? "par intervalles " : ""}`
      + `${plage(pl[0][0], pl[pl.length - 1][1])}, ${nombreFr(tot)} mm attendus.`);
  } else if (!pl.length && !ne.length) {
    /* Sans lame annoncée, un risque fort mérite encore une ligne : c'est une
       information, alors qu'un risque de cinq pour cent n'en est pas une. */
    const rx = Math.round(Math.max(...s.pb));
    if (rx >= SEUILS.risqueSeul) {
      const kr = s.pb.indexOf(Math.max(...s.pb));
      dire("goutte", 7.5, kr, `Risque de pluie jusqu'à ${rx} % vers ${dem(kr)}.`);
    }
  }

  // 4. Le brouillard, qui décide d'une heure de départ.
  const br = plagesCode(BROUILLARD);
  if (br.length) {
    dire("brume", 7, br[br.length - 1][1],
      `Brouillard attendu ${plage(br[0][0], br[br.length - 1][1])}.`);
  }

  // 5. Le gel.
  const gel = plagesDe(s.n, k => s.t[k] <= SEUILS.gel);
  if (gel.length) {
    dire("alerte", 6, gel[gel.length - 1][1],
      `Gel probable ${plage(gel[0][0], gel[gel.length - 1][1])}, `
      + `jusqu'à ${nombreFr(Math.min(...s.t))} degrés.`);
  }

  // 6. Le vent. La règle regarde la rafale, non la seule moyenne.
  const gv = plagesDe(s.n, k => s.raf[k] >= SEUILS.rafale || s.v[k] >= SEUILS.ventMoyen);
  if (gv.length) {
    dire("vent", 5, gv[gv.length - 1][1],
      `Rafales à ${Math.round(Math.max(...s.raf))} km/h `
      + `${plage(gv[0][0], gv[gv.length - 1][1])}.`);
  }

  /* 7. La chaleur, et 8. le renversement de température. Les deux se décident
     ensemble : ils nommaient le même chiffre à la suite, « Jusqu'à 33 degrés
     vers demain 14 h » puis « Réchauffement de 8 degrés, 33° demain ». Quand
     c'est le cas, seul le renversement paraît : il dit le même maximum et, en
     plus, d'où l'on vient. */
  const mx = g && g.maxima;
  const bascule = mx ? Math.round(mx.demain) - Math.round(mx.aujourdhui) : 0;
  const renverse = mx && Math.abs(bascule) >= SEUILS.bascule;

  const tmax = Math.max(...s.t);
  if (tmax >= SEUILS.chaleur
    && !(renverse && Math.round(tmax) === Math.round(mx.demain))) {
    const kt = s.t.indexOf(tmax);
    dire("soleil", 4, kt, `Jusqu'à ${Math.round(tmax)} degrés vers ${dem(kt)}.`);
  }

  /* 8. Le renversement de température, d'un maximum de journée à l'autre. Une
     prévision qui annonce huit degrés de moins demain mérite mieux qu'un chiffre
     noyé dans un graphique.

     La règle coupait en deux la fenêtre de vingt-quatre heures et comparait les
     deux maximums, ce qui revenait à comparer un après-midi à une nuit : elle
     annonçait un refroidissement tous les jours de beau temps, et nommait « le
     plus chaud de demain » un relevé du petit matin, très en dessous du maximum
     réel du lendemain. Les deux maximums viennent maintenant des journées
     entières, à la même source que la table de la semaine. */
  if (renverse) {
    // La portée court jusqu'au bout de la journée de demain, `dire` ajoutant l'heure suivante.
    dire("thermo", 3.5, 47 - s.heure[0],
      `${bascule < 0 ? "Refroidissement" : "Réchauffement"} de ${Math.abs(bascule)} degrés `
      + `demain, ${Math.round(mx.demain)}° au plus chaud contre `
      + `${Math.round(mx.aujourdhui)}° aujourd'hui.`);
  }

  /* 9. Le ressenti, quand il s'écarte franchement de la température. C'est lui
     qui dit comment s'habiller, non le thermomètre. */
  let kr = 0;
  for (let k = 1; k < s.n; k++) {
    if (Math.abs(s.res[k] - s.t[k]) > Math.abs(s.res[kr] - s.t[kr])) kr = k;
  }
  const eRes = s.res[kr] - s.t[kr];
  if (Math.abs(eRes) >= SEUILS.ressenti) {
    dire("thermo", 3.2, kr,
      `Ressenti ${Math.round(s.res[kr])}° pour ${Math.round(s.t[kr])}° vers ${dem(kr)}.`);
  }

  // 10. L'air saturé sous une température douce.
  const mal = plagesDe(s.n, k =>
    s.hum[k] >= SEUILS.humidite && s.t[k] >= SEUILS.humiditeTmin && s.t[k] <= SEUILS.humiditeTmax)
    .filter(([a, b]) => b - a >= SEUILS.humiditeHeures);
  if (mal.length) {
    dire("goutte", 3, mal[0][1],
      `Air saturé ${plage(mal[0][0], mal[0][1])} sous une température douce. `
      + `Brouillard et rosée persistante possibles.`);
  }

  /* 11. La pression. Une baisse marquée annonce une dégradation, une hausse une
     amélioration : c'est la plus ancienne lecture du temps, et la seule qui
     porte au-delà de la fenêtre. */
  const dp = Math.round(s.pres[s.n - 1] - s.pres[0]);
  if (Math.abs(dp) >= SEUILS.pression) {
    dire("jauge", 2.5, s.n - 1, dp < 0
      ? `Pression en baisse de ${-dp} hPa, dégradation probable.`
      : `Pression en hausse de ${dp} hPa, amélioration probable.`);
  }

  /* 12. La bascule du ciel. Le premier passage d'un régime à l'autre qui tienne
     trois heures : « le ciel se dégage vers 16 h » vaut mieux qu'une courbe de
     couverture. */
  const couvert = k => s.nua[k] >= SEUILS.couvert;
  for (let k = 1; k < s.n; k++) {
    if (couvert(k) === couvert(0)) continue;
    let tient = true;
    for (let j = k; j < Math.min(k + SEUILS.tenue, s.n); j++) {
      if (couvert(j) !== couvert(k)) { tient = false; break; }
    }
    if (!tient) continue;
    dire(couvert(k) ? "nuage" : "soleil", 2, k,
      couvert(k) ? `Le ciel se couvre vers ${dem(k)}.` : `Le ciel se dégage vers ${dem(k)}.`);
    break;
  }

  /* 13. Le lever ou le coucher du Soleil, quand il tombe dans les trois heures.
     Au-delà, ce n'est plus un fait de la journée mais une donnée d'almanach, et
     l'écran du soleil est là pour cela. */
  if (g && g.evenement) {
    const dh = (g.evenement.date - Date.now()) / 3600000;
    if (dh > 0 && dh <= SEUILS.astreProche) {
      dire(g.evenement.lever ? "lever" : "coucher", 1.8, Math.ceil(dh),
        `${g.evenement.lever ? "Lever" : "Coucher"} du soleil `
        + `${heureTxt(g.evenement.date.getHours())} ${String(g.evenement.date.getMinutes())
          .padStart(2, "0")}.`);
    }
  }

  // 14. L'indice ultraviolet.
  const uvx = Math.max(...s.uv);
  if (uvx >= SEUILS.uv) {
    const ku = s.uv.indexOf(uvx);
    dire("soleil", 1, ku, `Indice UV ${Math.round(uvx)} vers ${dem(ku)}. Exposition à limiter.`);
  }

  return lignes.sort((a, b) => b.g - a.g).slice(0, LIGNES_MAX);
}

/* La portée d'une liste, en heures : c'est elle qui donne son titre à la
   section. Un titre qui annonce vingt-quatre heures alors que la dernière ligne
   s'arrête à seize promet plus qu'il ne tient. */
export const portee = lignes => Math.max(0, ...lignes.map(x => x.h || 0));

export function titrePortee(heures) {
  if (heures <= 0) return "À retenir";
  if (heures < 48) return `Dans les ${heures} prochaines heures`;
  // Arrondi au jour supérieur : le titre ne doit pas promettre moins que la
  // ligne la plus lointaine, et cinquante heures portent bien sur trois jours.
  const j = Math.max(2, Math.ceil(heures / 24));
  return `Dans les ${j} prochains jours`;
}

export const conseilsHTML = l => {
  if (!l || !l.length) return "";
  return l.map(x =>
    `<p class="cj-l">${ico(x.i, `cj-ic icv-${x.i}`)}<span>${esc(x.t)}</span></p>`).join("");
};
