/* Les vues de la feuille. Chacune rend un titre, un sous-titre facultatif, un
   corps et un branchement facultatif. */

import { nombreFr, hhmm, jourCourt, jourLong, esc, departementDe } from "./horloge.js";
import * as P from "./previsions.js";
import { ico, icoCiel, tempsDe } from "./icones.js";
import { conseilsHTML } from "./conseils.js";
import * as Ruban from "./ruban.js";
import { liste, moments } from "./ecritures.js";
import * as Reglages from "./reglages.js";

/* ---------- La feuille du temps ---------- */

export function vueTemps(ctx, rendre) {
  const s = P.serieHoraire();
  const g = Reglages.lire();
  if (!s) {
    return {
      titre: "Le temps",
      sous: g.commune || "",
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
    sous: `${g.commune || ""}${g.commune ? ", " : ""}${nombreFr(s.t[0])}° et `
      + `${tempsDe(s.code[0])[1].toLowerCase()}`,
    icoSous: icoCiel(s.code[0], s.clair[0]),
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
    const tombe = k === i && h && h.passe >= 0.1 ? h.passe : 0;

    const nom = k === i ? "Aujourd'hui" : k === i + 1 ? "Demain" : jourCourt(d.time[k]);
    const date = new Date(`${d.time[k]}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const gauche = ((tn - tmin) / amp) * 100;
    const large = Math.max(4, ((tx - tn) / amp) * 100);
    const eau = mm >= 0.1
      ? `${nombreFr(mm)} mm${tombe ? `<span>dont ${nombreFr(tombe)}</span>` : ""}`
      : pb >= 5 ? `${Math.round(pb)} %` : "";

    lignes.push(`<tr><td class="j">${esc(nom)}<em>${esc(date)}</em></td>`
      + `<td class="c">${ico(icoCiel(code, true), "")}</td>`
      + `<td class="p">${eau}</td>`
      + `<td class="b"><b>${Math.round(tn)}°</b> <span>${Math.round(tx)}°</span>`
      + `<i class="barre" style="margin-left:${gauche.toFixed(1)}%;width:${large.toFixed(1)}%"></i></td></tr>`);
  }

  return {
    titre: "La semaine",
    sous: g.commune || "",
    corps: `<div class="carte"><table class="sem"><tbody>${lignes.join("")}</tbody></table>`
      + `<p class="note">Aujourd'hui et demain se résument des heures, les jours suivants de la `
      + `charge quotidienne. Une journée dont la série horaire ne porte pas ses vingt-quatre `
      + `heures ne se résume pas.</p></div>`,
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
    sous: g.commune || "",
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

/* ---------- La lumière ---------- */

/* ---------- La lumière ---------- */

const arcDuJour = (lever, coucher, maintenant) => {
  const W = 320, H = 108, sol = H - 26;
  const t = Math.max(0, Math.min(1, (maintenant - lever) / ((coucher - lever) || 1)));
  const pt = p => {
    const a = Math.PI * (1 - p);
    return [W / 2 + Math.cos(a) * (W / 2 - 14), sol - Math.sin(a) * (sol - 12)];
  };
  let d = `M${pt(0)[0].toFixed(1)},${pt(0)[1].toFixed(1)}`;
  for (let k = 1; k <= 40; k++) { const [x, y] = pt(k / 40); d += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
  const [ax, ay] = pt(t);
  const jour = maintenant >= lever && maintenant <= coucher;
  return `<svg class="aj" viewBox="0 0 ${W} ${H}" aria-hidden="true">`
    + `<path class="aj-plein" d="${d} L${pt(1)[0].toFixed(1)},${sol} L${pt(0)[0].toFixed(1)},${sol} Z"/>`
    + `<path class="aj-arc" d="${d}"/>`
    + `<line class="aj-sol" x1="8" y1="${sol}" x2="${W - 8}" y2="${sol}"/>`
    + (jour ? `<circle class="aj-astre" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="6"/>` : "")
    + `</svg>`;
};

export function vueLumiere() {
  const c = P.chargeCourante();
  const i = P.iJour();
  const g = Reglages.lire();
  if (!c || i < 0) return { titre: "La lumière", corps: `<div class="carte"><p class="vide">Indisponible.</p></div>` };

  const d = c.daily;
  const lever = new Date(d.sunrise[i]).getTime();
  const coucher = new Date(d.sunset[i]).getTime();
  const maintenant = Date.now();
  const duree = d.daylight_duration[i];
  const veille = i > 0 ? d.daylight_duration[i - 1] : duree;
  const delta = Math.round((duree - veille) / 60);

  const hm = ms => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

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

  const lignes = [
    ["Lever", hm(lever)],
    ["Coucher", hm(coucher)],
    ["Durée du jour", hhmm(duree)],
    ["Écart à la veille", `${delta >= 0 ? "+" : "−"} ${Math.abs(delta)} min`],
  ];
  if (passage) {
    lignes.push([`Seuil de dix heures`,
      `${passage.sens} le ${jourLong(passage.date)}`]);
  }

  return {
    titre: "La lumière",
    sous: g.commune || "",
    corps: `<div class="carte">${arcDuJour(lever, coucher, maintenant)}`
      + `<div class="aj-b"><div><b>${hm(lever)}</b><i>lever</i></div>`
      + `<div><b>${hm(coucher)}</b><i>coucher</i></div></div></div>`
      + `<div class="carte">`
      + lignes.map(([n, v]) => `<div class="lum-l"><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join("")
      + `</div>`,
  };
}

/* ---------- Réglages et commune ---------- */

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
      `<div class="carte"><div class="carte-tete"><h3>Commune</h3></div>`
      + `<div class="champ"><label for="rgQ">Nom de commune ou code postal</label>`
      + `<input class="rg-champ" id="rgQ" type="search" inputmode="search" autocomplete="off" `
      + `placeholder="Grenoble, 38000" value="${esc(g.commune || "")}"></div>`
      + `<div class="rg-res" id="rgRes"></div>`
      + `<button type="button" class="rg-geo" id="rgGeo">`
      + `${ico("cible", "")}<span>Utiliser ma position</span></button></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Écriture de l'écran Le temps</h3></div>`
      + `<div class="seg">` + Reglages.ECRITURES.map(([k, n]) =>
        `<button type="button" data-ecriture="${k}"${k === g.ecriture ? ' class="actif"' : ""}>${esc(n)}</button>`)
        .join("") + `</div></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Sources</h3></div>`
      + sources.map(([n, v]) => `<div class="rg-l">${esc(n)}<span>${esc(v)}</span></div>`).join("")
      + (g.lat !== null ? `<div class="rg-l">Coordonnées<span>${g.lat}, ${g.lon}</span></div>` : "")
      + `</div>`

      + `<p class="note">Aucun compte, aucune base de données, aucune donnée envoyée. `
      + `Les réglages restent sur cet appareil.</p>`,

    brancher(bloc) {
      const q = bloc.querySelector("#rgQ");
      const res = bloc.querySelector("#rgRes");
      let minuteur = null;

      const poser = lieu => {
        Reglages.poser({ commune: lieu.commune, codePostal: lieu.codePostal,
          lat: lieu.lat, lon: lieu.lon, poste: null });
        rendre({ recharger: true });
      };

      const chercher = async () => {
        const saisie = q.value.trim();
        if (saisie.length < 2) { res.innerHTML = ""; return; }
        const l = await Reglages.chercherCommune(saisie);
        if (!l.length) {
          res.innerHTML = `<p class="vide">Aucune commune ne correspond à cette saisie.</p>`;
          return;
        }
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

      bloc.querySelector("#rgGeo").addEventListener("click", async () => {
        majEtat("Recherche de la position…");
        try {
          const { lat, lon } = await Reglages.geolocaliser();
          const lieu = await Reglages.communeDe(lat, lon);
          if (!lieu) { majEtat("Aucune commune trouvée à cette position."); return; }
          majEtat("");
          poser(lieu);
        } catch (e) { majEtat(e.message); }
      });

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
