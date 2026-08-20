/* Les vues de la feuille. Chacune rend un titre, un sous-titre facultatif, un
   corps et un branchement facultatif. */

import { nombreFr, hhmm, jourCourt, jourLong, esc, departementDe } from "./horloge.js";
import * as P from "./previsions.js";
import { ico, icoCiel, tempsDe } from "./icones.js";
import { conseilsHTML } from "./conseils.js";
import * as Ruban from "./ruban.js";
import { liste, moments } from "./ecritures.js";
import * as Reglages from "./reglages.js";
import * as Astres from "./astres.js";

/* ---------- Fragments communs ---------- */

const hm = ms => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const CARDINAUX = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
const cardinalDe = az => CARDINAUX[Math.round((((az % 360) + 360) % 360) / 45) % 8];

const rangees = lignes => lignes.map(([n, v]) =>
  `<div class="rangee"><span class="rangee-txt">${esc(n)}</span>`
  + `<span class="rangee-val"><b>${esc(v)}</b></span></div>`).join("");

/* ---------- L'écran du temps ---------- */

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

/* ---------- Le soleil ---------- */

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
  const maintenant = Date.now();
  const duree = d.daylight_duration[i];
  const veille = i > 0 ? d.daylight_duration[i - 1] : duree;
  const delta = Math.round((duree - veille) / 60);

  /* Les heures de lever et de coucher viennent d'Open-Meteo, qui fait foi ici.
     Les azimuts, le midi solaire et les crépuscules se calculent sur l'appareil :
     la source ne les porte pas. */
  const e = Astres.evenements("soleil", new Date(), g.lat, g.lon);
  const cr = Astres.crepuscules(new Date(), g.lat, g.lon);

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

  const course = [
    ["Lever", `${hm(lever)}${e.azimutLever === null ? "" : `, ${cardinalDe(e.azimutLever)}`}`],
    ["Coucher", `${hm(coucher)}${e.azimutCoucher === null ? "" : `, ${cardinalDe(e.azimutCoucher)}`}`],
    ["Midi solaire", e.meridien ? hm(e.meridien.getTime()) : "—"],
    ["Hauteur maximale", e.hauteurMax === null ? "—" : `${Math.round(e.hauteurMax)}°`],
    ["Durée du jour", hhmm(duree)],
    ["Écart à la veille", `${delta >= 0 ? "+" : "−"} ${Math.abs(delta)} min`],
  ];
  if (passage) course.push(["Seuil de dix heures", `${passage.sens} le ${jourLong(passage.date)}`]);

  const cieux = [
    ["Crépuscule civil", cr.civil],
    ["Crépuscule nautique", cr.nautique],
    ["Nuit noire", cr.astronomique],
  ].map(([n, v]) => [n, v.matin && v.soir
    ? `${hm(v.matin.getTime())} et ${hm(v.soir.getTime())}`
    : "le Soleil ne descend pas si bas"]);

  return {
    titre: "Le soleil",
    sous: g.commune || "",
    corps: `<div class="carte">${arcDuJour(lever, coucher, maintenant)}`
      + `<div class="aj-b"><div><b>${hm(lever)}</b><i>lever</i></div>`
      + `<div><b>${hm(coucher)}</b><i>coucher</i></div></div></div>`
      + `<div class="section"><h2>Course du jour</h2>`
      + `<div class="carte">${rangees(course)}</div></div>`
      + `<div class="section"><h2>Fin et retour de la lumière</h2>`
      + `<div class="carte">${rangees(cieux)}`
      + `<p class="note">Le crépuscule civil borne la lecture au dehors, le nautique `
      + `l'horizon en mer, la nuit noire l'absence de lueur solaire.</p></div></div>`,
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

  const jourEtHeure = d => `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}, `
    + `${hm(d.getTime())}`;

  const cycle = [
    ["Part éclairée", `${Math.round(p.eclairee * 100)} %`],
    ["Âge", `${nombreFr(p.age)} jours`],
    ["Sens", p.croissante ? "croissante" : "décroissante"],
    ["Lunaison en cours", `${nombreFr(l.duree)} jours`],
  ];

  const horizonLignes = [
    ["Lever", e.lever ? `${hm(e.lever.getTime())}, ${cardinalDe(e.azimutLever)}` : "aucun ce jour"],
    ["Coucher", e.coucher ? `${hm(e.coucher.getTime())}, ${cardinalDe(e.azimutCoucher)}` : "aucun ce jour"],
    ["Passage au méridien", e.meridien ? hm(e.meridien.getTime()) : "—"],
    ["Hauteur maximale", e.hauteurMax === null ? "—" : `${Math.round(e.hauteurMax)}°`],
    ["Durée au-dessus de l'horizon", e.duree === null ? "à cheval sur deux jours" : hhmm(e.duree)],
  ];

  return {
    titre: "La lune",
    sous: g.commune || "",
    corps: `<div class="ln-tete">${Astres.dessinPhase(p.eclairee, p.croissante)}`
      + `<div class="ln-dit"><p class="ln-nom">${esc(p.nom)}</p>`
      + `<p class="ln-part">${Math.round(p.eclairee * 100)} % de la face visible est éclairée</p>`
      + `<p class="ln-age">${nombreFr(p.age)} jours depuis la nouvelle lune</p></div></div>`

      + `<div class="section"><h2>Au-dessus de l'horizon</h2>`
      + `<div class="carte">${rangees(horizonLignes)}</div></div>`

      + `<div class="section"><h2>Cycle</h2>`
      + `<div class="carte">${rangees(cycle)}</div></div>`

      + `<div class="section"><h2>Prochaines phases</h2>`
      + `<div class="carte">`
      + rangees(phases.map(x => [x.nom, jourEtHeure(x.date)]))
      + `<p class="note">Positions calculées sur l'appareil, sans source distante. `
      + `Écart de l'ordre de la minute sur les heures, de quelques minutes sur les `
      + `instants de phase.</p></div></div>`,
  };
}

/* ---------- Réglages et commune ---------- */

/* ---------- Communes suivies ----------

   Deux gestes séparent deux communes : le titre d'écran ouvre cette feuille,
   une rangée bascule. Chaque rangée porte le temps qu'il fait, sans quoi la
   liste ne serait qu'un répertoire de noms. */

export function vueCommunes(ctx, rendre, majEtat) {
  const suivies = Reglages.suivies();
  const courante = Reglages.cleCourante();

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

  const liste = suivies.length
    ? `<div class="carte co-liste" id="coListe">${suivies.map(rangee).join("")}</div>`
    : `<div class="carte"><p class="vide">Aucune commune suivie pour le moment.</p></div>`;

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
      + `<div class="rg-res" id="rgRes"></div>`
      + `<button type="button" class="bouton-texte" id="rgGeo"${plein ? " disabled" : ""}>`
      + `${ico("cible", "")}<span>Utiliser ma position</span></button></div>`
      + `<p class="note">Glisser une rangée vers la gauche pour retirer la commune. `
      + `La commune courante porte une coche.</p>`,

    brancher(bloc) {
      /* Les températures arrivent après coup : la feuille s'ouvre tout de
         suite, l'ossature tient la place, un seul appel couvre la liste. */
      if (suivies.length) {
        P.apercus(suivies).then(({ par, age }) => {
          for (const el of bloc.querySelectorAll(".co")) {
            const l = suivies.find(x => Reglages.cleLieu(x) === el.dataset.cle);
            const a = par[`${l.lat},${l.lon}`];
            const deg = el.querySelector("[data-deg]");
            const bornes = el.querySelector("[data-bornes]");
            const icone = el.querySelector("[data-ic]");
            if (!a) { deg.textContent = "—"; continue; }
            deg.textContent = `${Math.round(a.t)}°`;
            icone.innerHTML = ico(icoCiel(a.code, a.jour), "");
            const cp = l.codePostal ? `${l.codePostal} · ` : "";
            bornes.textContent = a.tn === null ? cp.replace(" · ", "")
              : `${cp}${Math.round(a.tn)}° à ${Math.round(a.tx)}°`;
          }
          if (age !== null && age > 15 * 60 * 1000) {
            majEtat("Températures de la dernière lecture connue.");
          }
        });
      }

      // Bascule de commune : un appui, la feuille se ferme, la prévision suit.
      for (const b of bloc.querySelectorAll(".co-l")) {
        b.addEventListener("click", () => {
          const l = suivies[Number(b.dataset.k)];
          if (Reglages.cleLieu(l) === courante) { rendre({ fermer: true }); return; }
          Reglages.poserLieu(l);
          rendre({ recharger: true, fermer: true });
        });
      }

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

  for (const el of bloc.querySelectorAll(".co")) {
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

/* Recherche de commune et géolocalisation, communes à la feuille des communes. */
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

  const geo = bloc.querySelector("#rgGeo");
  geo.addEventListener("click", async () => {
    geo.disabled = true;
    majEtat("Recherche de la position…");
    try {
      const { lat, lon } = await Reglages.geolocaliser();
      const lieu = await Reglages.communeDe(lat, lon);
      if (!lieu) { majEtat("Aucune commune trouvée à cette position."); return; }
      majEtat("");
      poser(lieu);
    } catch (e) {
      majEtat(e.message);
    } finally {
      geo.disabled = false;
    }
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
