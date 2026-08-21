/* Ce que les vingt-quatre heures à venir demandent.

   Sept règles dans « Mon jardin », six ici : le créneau d'arrosage consultait le
   bilan hydrique du sol, qui est hors périmètre. Les six autres gardent leurs
   faits et perdent leurs verbes de jardin.

   Deux règles de composition sont conservées : trois lignes au plus, et la
   première parle toujours de pluie, qu'il en tombe ou non.

   Les seuils sont ceux du document de reprise, et ils sont uniques : le bandeau
   et cette feuille portaient dans « Mon jardin » deux jeux distincts pour le
   gel, la chaleur et le vent, si bien que le bandeau pouvait se taire sur un gel
   que la feuille annonçait, sur le même écran. */

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
};

export function conseils(s) {
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

  // 1. La pluie, toujours en premier.
  const pl = plagesDe(s.n, k => s.mm[k] >= SEUILS.lame);
  const tot = s.mm.reduce((a, b) => a + b, 0);
  const div = divergencePluie(s);

  if (div) {
    /* Quand les deux modèles ne s'accordent pas, c'est la ligne de pluie qui le
       dit : deux lignes, l'une affirmative et l'autre dubitative, se
       contrediraient à la lecture. */
    lignes.push({ i: "goutte", g: 9, t: div.bas < SEUILS.lame
      ? `Pluie incertaine, jusqu'à ${nombreFr(div.haut)} mm selon le modèle.`
      : `Pluie incertaine, de ${nombreFr(div.bas)} à ${nombreFr(div.haut)} mm `
        + `selon le modèle.` });
  } else if (pl.length) {
    lignes.push({ i: "goutte", g: 9, t:
      `Pluie ${pl.length > 1 ? "par intervalles " : ""}`
      + `${plage(pl[0][0], pl[pl.length - 1][1])}, ${nombreFr(tot)} mm attendus.` });
  } else {
    const rx = Math.round(Math.max(...s.pb));
    lignes.push({ i: "goutte", g: 9, t:
      `Aucune lame annoncée d'ici ${fin(s.n - 1)}.`
      + (rx >= SEUILS.risque
        ? ` Risque de pluie jusqu'à ${rx} % vers ${dem(s.pb.indexOf(Math.max(...s.pb)))}.`
        : "") });
  }

  // 2. Le gel.
  const gel = plagesDe(s.n, k => s.t[k] <= SEUILS.gel);
  if (gel.length) {
    lignes.push({ i: "alerte", g: 6, t:
      `Gel probable ${plage(gel[0][0], gel[gel.length - 1][1])}, `
      + `jusqu'à ${nombreFr(Math.min(...s.t))} degrés.` });
  }

  // 3. Le vent. La règle regarde la rafale, non la seule moyenne.
  const gv = plagesDe(s.n, k => s.raf[k] >= SEUILS.rafale || s.v[k] >= SEUILS.ventMoyen);
  if (gv.length) {
    lignes.push({ i: "vent", g: 5, t:
      `Rafales à ${Math.round(Math.max(...s.raf))} km/h `
      + `${plage(gv[0][0], gv[gv.length - 1][1])}.` });
  }

  // 4. La chaleur.
  const tmax = Math.max(...s.t);
  if (tmax >= SEUILS.chaleur) {
    lignes.push({ i: "soleil", g: 4, t:
      `Jusqu'à ${Math.round(tmax)} degrés vers ${dem(s.t.indexOf(tmax))}.` });
  }

  // 5. L'air saturé sous une température douce.
  const mal = plagesDe(s.n, k =>
    s.hum[k] >= SEUILS.humidite && s.t[k] >= SEUILS.humiditeTmin && s.t[k] <= SEUILS.humiditeTmax)
    .filter(([a, b]) => b - a >= SEUILS.humiditeHeures);
  if (mal.length) {
    lignes.push({ i: "goutte", g: 3, t:
      `Air saturé ${plage(mal[0][0], mal[0][1])} sous une température douce. `
      + `Brouillard et rosée persistante possibles.` });
  }

  // 6. L'indice ultraviolet.
  const uvx = Math.max(...s.uv);
  if (uvx >= SEUILS.uv) {
    lignes.push({ i: "soleil", g: 1, t:
      `Indice UV ${Math.round(uvx)} vers ${dem(s.uv.indexOf(uvx))}. Exposition à limiter.` });
  }

  // Trois lignes au plus, la première étant toujours celle de la pluie.
  return [lignes[0]].concat(lignes.slice(1).sort((a, b) => b.g - a.g).slice(0, 2));
}

export const conseilsHTML = s => {
  const l = conseils(s);
  if (!l.length) return "";
  return l.map(x =>
    `<p class="cj-l">${ico(x.i, "cj-ic")}<span>${esc(x.t)}</span></p>`).join("");
};
