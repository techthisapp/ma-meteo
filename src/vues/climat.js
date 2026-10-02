/* Le climat de la commune et la comparaison dans le temps et entre lieux. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { nombreFr, esc, cleJour } from "../horloge.js";
import * as P from "../previsions.js";
import { couleurEcart } from "../icones.js";
import * as Reglages from "../reglages.js";
import * as Comparaison from "../comparaison.js";
import * as Climat from "../climat.js";
import { conseilsHTML } from "../conseils.js";
import { poserRedimension, valeur } from "./communs.js";

/* ---------- Le climat de la commune ----------

   Quatre-vingts ans de relevés au même endroit, pour dire où la journée se
   place. Le module `climat.js` porte la source, la réduction et les seuils ; la
   feuille ne fait que lire et écrire.

   Elle se lit à l'ouverture et non au chargement de l'application : l'archive
   longue pèse cent soixante-six kilooctets, et c'est le prix d'une question
   qu'on ne pose pas tous les jours. */
/* La comparaison, jalon 14, dans la feuille du climat : une période face aux
   mêmes dates d'une autre année, puis face à d'autres lieux. Chaque carte
   choisit sa période, passée ou à venir, jamais les deux à la fois : le
   passé finit hier et se lit dans l'archive, l'avenir commence demain et se
   lit dans la prévision, demandé par Jérôme le 29 septembre 2026. Le choix
   tient le temps de la séance. */
/* La valeur par défaut s'écrit ici en toutes lettres : lue dans le module de
   la comparaison au chargement des vues, elle tombait dans un import circulaire
   et l'accueil ne s'affichait plus. Elle vaut Comparaison.PERIODE_DEFAUT. */
let periodeTemps = "7p";

let periodeLieux = "7p";

const selPeriode = (cls, p) => `<select class="cmp-periode ${cls}" aria-label="Période comparée">`
  + [["passe", "Passé"], ["avenir", "À venir"]].map(([sens, nom]) => `<optgroup label="${nom}">`
    + Comparaison.PERIODES.filter(x => x[2] === sens)
      .map(([v, l]) => `<option value="${v}"${v === p ? " selected" : ""}>${esc(l)}</option>`).join("")
    + `</optgroup>`).join("")
  + `</select>`;

/* Les étiquettes des jours sous un graphique de comparaison : le nom du jour
   sur une semaine, la date une semaine sur sept au-delà, alignée sur le
   dernier jour. */
function etiquettesJours(dates, x, aujourdhui, y) {
  const n = dates.length;
  return dates.map((d, k) => {
    if (n > 7 && (n - 1 - k) % 7 !== 0) return "";
    const t = new Date(`${d}T12:00`);
    const nom = d === aujourdhui ? "Auj."
      : n > 7 ? `${t.getDate()}/${t.getMonth() + 1}`
        : t.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
    /* La dernière étiquette d'une période longue s'aligne sur sa fin : centrée,
       elle débordait du bord droit. */
    const fin = n > 7 && k === n - 1 ? ` text-anchor="end"` : "";
    return `<text class="sg-j${d === aujourdhui ? " sg-a" : ""}"${fin} x="${(fin ? x(k) + 4 : x(k)).toFixed(1)}" y="${y}">${esc(nom)}</text>`;
  }).join("");
}

/* Une période face aux mêmes dates d'une autre année. Une période passée se
   lit dans l'archive, comme l'autre année ; une période à venir, dans la
   prévision. L'autre année vient toujours de l'archive, lue pour ces dates
   seulement. */
function brancherComparaison(cmp, bloc, g, c, date) {
  if (!cmp) return;
  const anneeCourante = Number(date.slice(0, 4));
  let annee = anneeCourante - 1;
  let jeton = 0;
  const tete = () => `<div class="carte-tete cmp-tete">${selPeriode("cmp-p-temps", periodeTemps)}`
    + `<span class="cmp-face">face à</span><select class="cmp-annee" aria-label="Année de comparaison">`
    + Array.from({ length: anneeCourante - 1940 }, (_, k) => anneeCourante - 1 - k)
      .map(a => `<option value="${a}"${a === annee ? " selected" : ""}>${a}</option>`).join("")
    + `</select></div>`;
  const cetteDe = async dates => {
    if (Comparaison.estPassee(periodeTemps)) return Comparaison.lireAnnee(g.lat, g.lon, dates, anneeCourante, anneeCourante);
    const [s0] = await Comparaison.lireLieux([{ lat: g.lat, lon: g.lon, nom: "" }], dates, false);
    return dates.map(t => s0.jours.find(j => j.date === t) || { date: t });
  };
  const brancher = () => {
    cmp.querySelector(".cmp-annee").addEventListener("change", e => { annee = Number(e.target.value); montrer(); });
    cmp.querySelector(".cmp-p-temps").addEventListener("change", e => { periodeTemps = e.target.value; montrer(); });
  };
  /* Un jeton écarte les réponses périmées : deux changements rapides
     pouvaient voir la réponse la plus lente arriver en dernier. */
  const montrer = async () => {
    const mien = ++jeton;
    const dates = Comparaison.datesDe(periodeTemps, date);
    cmp.hidden = false;
    cmp.innerHTML = tete() + `<p class="note">Lecture de ${annee}…</p>`;
    brancher();
    let cette = null, autre = null;
    try {
      [cette, autre] = await Promise.all([cetteDe(dates), Comparaison.lireAnnee(g.lat, g.lon, dates, annee, anneeCourante)]);
    } catch { cette = null; autre = null; }
    if (!bloc.isConnected || mien !== jeton) return;
    const b = cette && autre?.length ? Comparaison.bilan(cette, autre, annee, periodeTemps) : null;
    cmp.innerHTML = tete() + (b
      ? grapheComparaison(cette, autre, anneeCourante, annee, date, periodeTemps)
        + `<div class="conseils">${conseilsHTML([{ i: "thermo", g: 1, t: b.phrase }])}</div>`
        + `<p class="note">Trait plein : ${anneeCourante}, ${Comparaison.estPassee(periodeTemps)
          ? "relevés de l'archive jusqu'à hier" : "prévision"}. `
        + `Tirets : ${annee}, relevés de l'archive. Les barres de pluie vont par paires, ${anneeCourante} à gauche.</p>`
      : `<p class="note">La comparaison a besoin du réseau.</p>`);
    brancher();
  };
  montrer();
}

/* La comparaison entre lieux : la même période, la commune affichée et
   jusqu'à trois lieux suivis choisis par des pastilles, les trois premiers par
   défaut. Un tableau des moyennes et du cumul de pluie, les maximums de chaque
   lieu en couleur, et la phrase du plus chaud et du plus arrosé. Quatre
   couleurs franchement distinctes : le bleu de la pluie, trop proche de celui
   de l'accent, rendait deux lieux difficiles à séparer. */
const COULEURS_LIEUX = ["var(--accent)", "var(--ic-soleil)", "#3fa66b", "var(--ic-lune)"];

function brancherLieux(carte, bloc, g, date) {
  if (!carte) return;
  const cleG = Reglages.cleLieu(g);
  const nomDe = l => l.commune || l.nom || "Lieu";
  const autres = Reglages.suivies().filter(l => Reglages.cleLieu(l) !== cleG && Number.isFinite(l.lat));
  const tete = () => `<div class="carte-tete cmp-tete">${selPeriode("cmp-p-lieux", periodeLieux)}`
    + `<span class="cmp-face">ailleurs</span></div>`;
  if (!autres.length) {
    carte.hidden = false;
    carte.innerHTML = `<div class="carte-tete"><h3>Ailleurs</h3></div>`
      + `<p class="note">Suivez d'autres lieux pour les comparer à celui-ci.</p>`;
    return;
  }
  const choix = new Set(autres.slice(0, 3).map(Reglages.cleLieu));
  let jeton = 0;
  const puces = () => `<div class="cmp-puces">` + autres.map(l => {
    const c = Reglages.cleLieu(l), oui = choix.has(c);
    return `<button type="button" class="cmp-puce${oui ? " choisie" : ""}" data-cle="${esc(c)}" `
      + `aria-pressed="${oui}">${esc(nomDe(l))}</button>`;
  }).join("") + `</div>`;
  const brancher = () => {
    carte.querySelectorAll(".cmp-puce").forEach(b => b.addEventListener("click", () => {
      const c = b.dataset.cle;
      if (choix.has(c)) choix.delete(c);
      else if (choix.size < 3) choix.add(c);
      montrer();
    }));
    carte.querySelector(".cmp-p-lieux")?.addEventListener("change", e => { periodeLieux = e.target.value; montrer(); });
  };
  const montrer = async () => {
    const mien = ++jeton;
    const dates = Comparaison.datesDe(periodeLieux, date);
    const lieux = [{ lat: g.lat, lon: g.lon, nom: nomDe(g) },
      ...autres.filter(l => choix.has(Reglages.cleLieu(l))).map(l => ({ lat: l.lat, lon: l.lon, nom: nomDe(l) }))];
    carte.hidden = false;
    carte.innerHTML = tete() + puces() + `<p class="note">${lieux.length < 2
      ? "Choisissez au moins un lieu à comparer." : "Lecture des lieux…"}</p>`;
    brancher();
    if (lieux.length < 2) return;
    let series = null;
    try { series = await Comparaison.lireLieux(lieux, dates, Comparaison.estPassee(periodeLieux)); } catch { series = null; }
    if (!bloc.isConnected || mien !== jeton) return;
    const b = series ? Comparaison.bilanLieux(series, periodeLieux) : null;
    if (!b) {
      carte.innerHTML = tete() + puces() + `<p class="note">La comparaison a besoin du réseau.</p>`;
      brancher();
      return;
    }
    const couleur = nom => COULEURS_LIEUX[Math.max(0, lieux.findIndex(l => l.nom === nom))];
    const fort = (l, cle) => (b[cle] === l.nom ? "cmp-fort" : "");
    const tableau = `<table class="cmp-tab"><thead><tr><th></th><th>Max.</th><th>Min.</th><th>Pluie</th></tr></thead><tbody>`
      + b.lignes.map(l => `<tr><td><i class="cmp-pt" style="background:${couleur(l.nom)}"></i>${esc(l.nom)}</td>`
        + `<td class="${fort(l, "chaud")}">${nombreFr(l.tx)}°</td><td>${nombreFr(l.tn)}°</td>`
        + `<td class="${fort(l, "arrose")}">${Math.round(l.mm)} mm</td></tr>`).join("")
      + `</tbody></table>`;
    const libelle = Comparaison.PERIODES.find(([v]) => v === periodeLieux)[1].toLowerCase();
    carte.innerHTML = tete() + puces() + grapheLieux(series, lieux, date) + tableau
      + `<div class="conseils">${conseilsHTML([{ i: "thermo", g: 1, t: b.phrase }])}</div>`
      + `<p class="note">Maximums et minimums moyens des ${libelle}, ${Comparaison.estPassee(periodeLieux)
        ? "relevés de l'archive jusqu'à hier" : "prévision"} ; tous les lieux viennent d'une même source.</p>`;
    brancher();
  };
  montrer();
}

/* Les maximums de chaque lieu sur la période, une couleur par lieu, la
   commune affichée en trait plus épais. */
export function grapheLieux(series, lieux, aujourdhui) {
  const dates = series[0]?.jours.map(j => j.date) || [];
  const n = Math.max(1, dates.length);
  const L = 340, H = 132, col = (L - 8) / n, x = k => 4 + (k + 0.5) * col;
  const vals = series.flatMap(s => s.jours.map(j => j.tx)).filter(Number.isFinite);
  if (!vals.length) return "";
  const mn = Math.min(...vals), mx = Math.max(...vals), amp = Math.max(4, mx - mn);
  const y = t => 96 - ((t - mn) / amp) * 80;
  const traces = series.map((s, i) => `<polyline fill="none" stroke="${COULEURS_LIEUX[i]}" stroke-width="${i ? 1.8 : 2.8}" `
    + `stroke-linejoin="round" points="${s.jours.map((j, k) => (Number.isFinite(j.tx) ? `${x(k).toFixed(1)},${y(j.tx).toFixed(1)}` : "")).filter(Boolean).join(" ")}"/>`).join("");
  const resume = `Maximums de la période pour ${lieux.map(l => l.nom).join(", ")}.`;
  return `<svg class="sg cmp-lieux" viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(resume)}">${traces}`
    + etiquettesJours(dates, x, aujourdhui, H - 6) + `</svg>`;
}

/* Le graphique de la comparaison dans le temps : maximums et minimums des deux
   périodes, trait plein pour la période en cours, tirets pour l'autre année,
   et la pluie en paires de barres. Sur une semaine, les jours à venir ont des
   points creux, ce sont des prévisions, et les maximums portent leur valeur ;
   au-delà de quinze jours, les points se taisent pour laisser lire la courbe. */
export function grapheComparaison(cette, autre, a1, a2, aujourdhui, periode = "7p") {
  const n = cette.length;
  const L = 340, H = 168, col = (L - 8) / n, x = k => 4 + (k + 0.5) * col;
  const vals = [...cette, ...autre].flatMap(j => [j?.tx, j?.tn]).filter(Number.isFinite);
  const mn = Math.min(...vals), mx = Math.max(...vals), amp = Math.max(4, mx - mn);
  const y = t => 100 - ((t - mn) / amp) * 76;
  const ligne = (l, cle, cls) => `<polyline class="${cls}" fill="none" points="`
    + l.map((j, k) => (Number.isFinite(j?.[cle]) ? `${x(k).toFixed(1)},${y(j[cle]).toFixed(1)}` : "")).filter(Boolean).join(" ") + `"/>`;
  const points = (cle, cls, dy) => (n > 15 ? "" : cette.map((j, k) => (!Number.isFinite(j[cle]) ? "" :
    `<circle class="${cls}${j.date > aujourdhui ? " cmp-prevu" : ""}" cx="${x(k).toFixed(1)}" cy="${y(j[cle]).toFixed(1)}" r="${n > 7 ? 2 : 2.8}"/>`
    + (dy && n <= 7 ? `<text class="sg-v" x="${x(k).toFixed(1)}" y="${(y(j[cle]) + dy).toFixed(1)}">${Math.round(j[cle])}°</text>` : ""))).join(""));
  const mmMax = Math.max(10, ...[...cette, ...autre].map(j => j?.mm || 0));
  const bw = Math.max(1.5, Math.min(8, col * 0.36));
  const barre = (j, k, dx, cls) => (!(j?.mm >= 0.1) ? "" : (() => {
    const h = Math.max(2, (j.mm / mmMax) * 26);
    return `<rect class="${cls}" x="${(x(k) + dx - bw / 2).toFixed(1)}" y="${(146 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(2, bw / 2).toFixed(1)}"/>`;
  })());
  const pluie = cette.map((j, k) => barre(j, k, -(bw / 2 + 0.6), "sg-pluie") + barre(autre[k], k, bw / 2 + 0.6, "cmp-pluie2")).join("");
  const b = Comparaison.bilan(cette, autre, a2, periode);
  const resume = b ? b.phrase.replace(/ ; /, ", ") : "";
  return `<svg class="sg cmp" viewBox="0 0 ${L} ${H}" role="img" aria-label="${esc(resume)}">`
    + pluie + ligne(autre, "tx", "cmp-max2") + ligne(autre, "tn", "cmp-min2")
    + ligne(cette, "tx", "sg-max") + ligne(cette, "tn", "sg-min")
    + points("tx", "sg-pmax", -7) + points("tn", "sg-pmin", 0)
    + etiquettesJours(cette.map(j => j.date), x, aujourdhui, H - 5) + `</svg>`;
}

export function vueClimat(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) {
    return {
      titre: "Le climat d'ici",
      corps: `<p class="note">Aucun lieu courant : la comparaison part d'ici.</p>`,
    };
  }

  return {
    titre: "Le climat d'ici",
    sous: g.commune || "",
    corps:
      `<div class="carte" id="clJour"><p class="note">Lecture de l'archive…</p></div>`
      /* La comparaison dans le temps, jalon 14 : la semaine en cours face aux
         mêmes dates d'une autre année, l'an dernier par défaut. */
      + `<div class="carte" id="clComparer" hidden></div>`
      + `<div class="carte" id="clLieux" hidden></div>`
      + `<div class="carte" id="clRecords" hidden></div>`
      + `<div class="carte" id="clSaison" hidden></div>`
      + `<div class="carte" id="clBandes" hidden></div>`
      + `<p class="note" id="clSource">Réanalyse ERA5, servie par Open-Meteo. `
      + `L'archive d'une commune se lit une fois et se garde sur l'appareil.</p>`,

    brancher(bloc) {
      const jour = bloc.querySelector("#clJour");
      const recs = bloc.querySelector("#clRecords");
      const sais = bloc.querySelector("#clSaison");
      const band = bloc.querySelector("#clBandes");

      const dire = t => { jour.innerHTML = `<p class="note">${esc(t)}</p>`; };

      /* Le maximum du jour vient de la même source que la semaine et que
         l'accueil, la série horaire quand elle couvre la journée : deux écrans
         qui liraient deux sources pour le même chiffre finiraient par se
         contredire. */
      const c = P.chargeCourante();
      const iJ = P.iJour();
      const date = c && iJ >= 0 ? c.daily.time[iJ] : cleJour(new Date());
      const h = P.jourHoraire(date);
      const max = h ? h.tx
        : (c && iJ >= 0 ? c.daily.temperature_2m_max[iJ] : null);

      brancherComparaison(bloc.querySelector("#clComparer"), bloc, g, c, date);
      brancherLieux(bloc.querySelector("#clLieux"), bloc, g, date);

      (async () => {
        let d = null;
        try { d = await Climat.charger(g.lat, g.lon, date); }
        catch { d = null; }
        if (!bloc.isConnected) return;
        if (!d) { dire("L'archive a besoin du réseau."); return; }
        const b = Climat.bilan(d, date, max);
        if (!b) { dire("L'archive de ce lieu n'est pas lisible."); return; }

        /* 1. La journée d'aujourd'hui parmi les mêmes dates. */
        /* La date sans le nom du jour : la médiane porte sur toutes les
           journées du 10 septembre, quel que soit le jour de la semaine. */
        const dateLongue = new Date(`${date}T12:00`)
          .toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
        jour.innerHTML = `<div class="carte-tete"><h3>Aujourd'hui dans l'histoire</h3></div>`
          + (Number.isFinite(max) && b.percentile !== null
            ? `<div class="rangee"><span class="rangee-txt"><b>Maximum annoncé</b>`
              + `<span>${esc(Climat.motPercentile(b.percentile))}</span></span>`
              + valeur(Climat.degre(max), { doux: `${Math.round(b.percentile)} %` })
              + `</div>`
            : `<p class="note">Le maximum du jour n'est pas connu.</p>`)
          + (b.mediane !== null
            ? `<div class="rangee"><span class="rangee-txt"><b>Ordinaire de la date</b>`
              + `<span>Médiane des ${esc(dateLongue)} de ${b.an0} à ${b.anN}</span></span>`
              + valeur(Climat.degre(b.mediane)) + `</div>`
            : "");

        /* 2. Les records de la date. */
        if (b.records && b.records[0] !== null) {
          recs.hidden = false;
          recs.innerHTML = `<div class="carte-tete"><h3>Les records du jour</h3></div>`
            + `<div class="rangee"><span class="rangee-txt"><b>Le plus chaud</b>`
            + `<span>Maximum le plus élevé pour cette date</span></span>`
            + valeur(Climat.degre(b.records[0]), { doux: String(b.records[1]) }) + `</div>`
            + `<div class="rangee"><span class="rangee-txt"><b>La nuit la plus froide</b>`
            + `<span>Minimum le plus bas pour cette date</span></span>`
            + valeur(Climat.degre(b.records[2]), { doux: String(b.records[3]) }) + `</div>`;
        }

        /* 3. La saison contre la normale. Elle ne paraît que si l'année en
           cours a été lue : sans elle, il n'y a rien à comparer. */
        if (b.releve && b.normale) {
          const dT = Math.round((b.releve.temp - b.normale[0]) * 10) / 10;
          const dP = Math.round(b.releve.pluie - b.normale[1]);
          /* L'écart se dit dans la ligne de description et non à côté de la
             valeur. Les températures s'écrivent au degré rond partout dans
             l'application : « 21° » à côté de « normale 20° » et de « +0,6° »
             donnerait une soustraction qui ne tombe pas juste sous les yeux du
             lecteur. La comparaison se lit alors en toutes lettres, et le
             chiffre affiché reste celui de la règle commune. */
          const motT = Math.abs(dT) < 0.05 ? "dans la normale"
            : `${nombreFr(Math.abs(dT))}° ${dT > 0 ? "au-dessus" : "en dessous"} de la normale`;
          const motP = dP === 0 ? "comme la normale"
            : `${Math.abs(dP)} mm ${dP > 0 ? "de plus" : "de moins"} que la normale`;
          sais.hidden = false;
          sais.innerHTML = `<div class="carte-tete"><h3>${esc(b.saison.nom)} `
            + `${b.saisonEnCours ? "en cours" : "qui vient de finir"}</h3></div>`
            + `<div class="rangee"><span class="rangee-txt"><b>Température moyenne</b>`
            + `<span>${esc(motT)} ${Climat.NORMALE[0]} à ${Climat.NORMALE[1]}, `
            + `${esc(Climat.degre(b.normale[0]))}</span></span>`
            + valeur(Climat.degre(b.releve.temp)) + `</div>`
            + `<div class="rangee"><span class="rangee-txt"><b>Pluie tombée</b>`
            + `<span>${esc(motP)}, ${Math.round(b.normale[1])} mm</span></span>`
            + valeur(`${Math.round(b.releve.pluie)} mm`) + `</div>`;
        }

        /* 4. Les bandes de réchauffement, une bande par année. */
        if (b.bandes && b.montee) {
          band.hidden = false;
          const e = b.bandes.ecarts;
          const etendue = Math.max(Math.abs(b.bandes.mn), Math.abs(b.bandes.mx)) || 1;
          band.innerHTML = `<div class="carte-tete"><h3>Les bandes de réchauffement</h3></div>`
            + `<canvas class="cl-bandes" id="clToile" role="img" aria-label="`
            + `Une bande par année de ${b.an0} à ${b.anN}, du bleu au rouge selon `
            + `l'écart à la moyenne des trente premières années, de `
            + `${nombreFr(b.bandes.mn)} à ${nombreFr(b.bandes.mx)} degrés"></canvas>`
            + `<div class="cl-ans"><span>${b.an0}</span><span>${b.anN}</span></div>`
            + `<p class="note">La moyenne annuelle a `
            + `${b.montee.ecart >= 0 ? "monté" : "baissé"} de `
            + `${nombreFr(Math.abs(b.montee.ecart))}° des trente premières années aux `
            + `trente dernières. Chaque bande dit l'écart de son année à la moyenne `
            + `des trente premières.</p>`;

          const cv = band.querySelector("#clToile");
          const peindre = () => {
            const l = cv.clientWidth, ht = cv.clientHeight;
            if (!l || !ht) return;
            const r = Math.min(2, window.devicePixelRatio || 1);
            cv.width = Math.round(l * r); cv.height = Math.round(ht * r);
            const x = cv.getContext("2d");
            x.setTransform(r, 0, 0, r, 0, 0);
            const w = l / e.length;
            for (let k = 0; k < e.length; k++) {
              x.fillStyle = couleurEcart(e[k], etendue);
              /* Un demi-point de recouvrement : sans lui, l'arrondi laisse des
                 raies du fond entre deux bandes. */
              x.fillRect(k * w, 0, w + 0.5, ht);
            }
          };
          requestAnimationFrame(peindre);
          poserRedimension("climat", peindre);
        }
      })();
    },
  };
}
