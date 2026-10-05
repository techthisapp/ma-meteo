/* Le plein ciel, version 172, demande de Jérôme du 5 octobre 2026.

   Un toucher sur le Soleil ou sur la Lune, dans le ciel de l'accueil comme
   dans celui de l'écran Le ciel, ou sur la vignette de leur sous-ligne, ouvre
   l'astre en plein écran. Le ciel descend jusqu'en bas, l'astre grandit et
   glisse jusqu'à ce que son centre se pose près du bord gauche, à mi-hauteur,
   et les informations clés paraissent à droite, l'une après l'autre.

   L'astre est celui de l'application : la même toile, peinte par `feu.js` ou
   `relief.js` avec les mêmes données, posée en grand et ramenée par
   transformation à la place et à la taille du disque touché. Le dessin ne
   change pas en route, seule sa place change. Le ciel est le panneau touché,
   recopié sans ses astres ni ses nuages, et découpé à la taille du panneau au
   départ.

   Un toucher n'importe où, la croix, un glissement vers le bas ou la touche
   Échap referment l'écran par le chemin inverse. */

import * as Astres from "../astres.js";
import * as Feu from "../feu.js";
import * as Relief from "../relief.js";
import * as P from "../previsions.js";
import * as Reglages from "../reglages.js";
import { hhmm, esc, cleJour, heureMinute } from "../horloge.js";
import { hm, versCardinal } from "./communs.js";

/* La part du côté de la toile qu'occupe le rayon du disque, pour chaque
   dessin : 0,19 pour le grand Soleil, 0,155 pour la grande Lune, 0,47 pour les
   vignettes. */
const PART = { soleil: Feu.RAYON, lune: 0.155, vignette: 0.47 };

/* La place de l'astre ouvert : un rayon d'un cinquième de la hauteur de
   l'écran, borné par la largeur, et une part visible de 42 % de la largeur. */
export const RAYON_PLEIN = 0.21;
export const PART_VISIBLE = 0.42;

/* Le bord où l'astre se pose. Le Soleil et une Lune croissante se posent à
   gauche ; une Lune décroissante, éclairée de son côté gauche, se poserait à
   gauche en ne montrant que sa part sombre : elle se pose à droite, les
   informations passant à gauche. Vu dans le simulateur le 5 octobre 2026, un
   dernier croissant ouvert sur le bord gauche. */
export const cote = (sorte, nomPhase = "") =>
  (sorte === "lune" && /décroissante|Dernier/.test(nomPhase) ? "droite" : "gauche");

/* Les seuils de la lumière. L'heure dorée commence quand le Soleil descend
   sous six degrés ; l'heure bleue va de quatre à huit degrés sous l'horizon. */
export const DOREE = 6;
export const BLEUE = [-4, -8];

const deux = n => String(n).padStart(2, "0");
const duree = ms => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${deux(m % 60)}`;
};
// La direction s'écrit comme partout dans l'application, « au sud-est ».
const ou = az => versCardinal(az);

/* L'arc d'un passage : la part faite, de zéro au lever à un au coucher. */
const partDe = (de, a, t) => (de && a && a > de ? Math.max(0, Math.min(1, (t - de) / (a - de))) : null);

/* ---------- Le Soleil ---------- */

export function infosSoleil(maintenant, g) {
  const p = Astres.position("soleil", maintenant, g.lat, g.lon);
  const e = Astres.evenements("soleil", maintenant, g.lat, g.lon);

  /* Le lever et le coucher viennent d'Open-Meteo quand la charge les porte,
     comme sur l'écran du soleil, qui les tient pour la référence. */
  const c = P.chargeCourante();
  const i = P.iJour();
  const d = c && c.daily;
  const lever = d && i >= 0 && d.sunrise ? new Date(d.sunrise[i]) : e.lever;
  const coucher = d && i >= 0 && d.sunset ? new Date(d.sunset[i]) : e.coucher;
  const jour = d && i >= 0 && d.daylight_duration ? d.daylight_duration[i] : e.duree;
  const veille = d && i > 0 && d.daylight_duration ? d.daylight_duration[i - 1] : jour;
  const delta = jour !== null && veille !== null ? Math.round((jour - veille) / 60) : 0;

  const doree = Astres.passages(maintenant, g.lat, g.lon, DOREE, true).soir;
  const bleue = Astres.passages(maintenant, g.lat, g.lon, BLEUE[0], true).soir;
  const bleueFin = Astres.passages(maintenant, g.lat, g.lon, BLEUE[1], true).soir;

  const t = maintenant.getTime();
  const phrase = !lever || !coucher ? ""
    : t < lever ? `Lever dans ${duree(lever - t)}`
      : t < coucher ? `Encore ${duree(coucher - t)} de jour`
        : `Couché depuis ${duree(t - coucher)}`;

  /* L'indice UV le plus fort de la journée et son heure, sur la série horaire. */
  let uv = null;
  if (c && c.hourly && c.hourly.uv_index) {
    const cle = cleJour(maintenant);
    c.hourly.time.forEach((h, k) => {
      const v = c.hourly.uv_index[k];
      if (h.startsWith(cle) && Number.isFinite(v) && (!uv || v > uv.v)) uv = { v, h: Number(h.slice(11, 13)) };
    });
  }
  const motUv = v => (v < 3 ? "faible" : v < 6 ? "modéré" : v < 8 ? "fort" : v < 11 ? "très fort" : "extrême");

  return {
    sorte: "soleil",
    nom: "Le Soleil",
    grand: `${Math.round(p.hauteur)}`,
    sous: p.hauteur >= Astres.SEUIL.soleil
      ? `au-dessus de l'horizon, ${ou(p.azimut)}` : `sous l'horizon, ${ou(p.azimut)}`,
    arc: { de: lever, a: coucher, part: partDe(lever, coucher, t), phrase },
    lignes: [
      ["Midi solaire", e.hauteurMax === null ? "" : `${Math.round(e.hauteurMax)}° au plus haut`, e.meridien],
      ["Heure dorée", "lumière rasante", doree, "or"],
      ["Heure bleue", bleueFin ? `jusqu'à ${hm(bleueFin.getTime())}` : "après le coucher", bleue, "bleu"],
      ["Coucher", e.azimutCoucher === null ? "" : ou(e.azimutCoucher), coucher],
    ].filter(l => l[2]).sort((a, b) => a[2] - b[2]),
    duo: [
      [jour === null ? "—" : hhmm(jour),
        delta === 0 ? "de jour, comme hier" : `de jour, ${Math.abs(delta)} min de ${delta > 0 ? "plus" : "moins"} qu'hier`],
      uv ? [`UV ${Math.round(uv.v)}`, `${motUv(uv.v)}, au maximum à ${deux(uv.h)} h`] : null,
    ].filter(Boolean),
  };
}

/* ---------- La Lune ---------- */

/* Le passage en cours, ou le prochain : le dernier lever qui précède
   maintenant si la Lune est levée, le prochain sinon, et le coucher qui le
   suit. Les heures de la Lune reculent d'environ cinquante minutes par jour :
   un passage commence souvent un jour et finit le lendemain. */
export function passageLune(maintenant, g) {
  const jour = k => new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() + k, 12);
  const ev = [-1, 0, 1, 2].map(k => Astres.evenements("lune", jour(k), g.lat, g.lon));
  const leves = ev.map(e => e.lever).filter(Boolean).sort((a, b) => a - b);
  const couches = ev.map(e => e.coucher).filter(Boolean).sort((a, b) => a - b);
  const levee = Astres.position("lune", maintenant, g.lat, g.lon).hauteur > Astres.SEUIL.lune;
  const lever = levee ? [...leves].reverse().find(x => x <= maintenant) || null
    : leves.find(x => x > maintenant) || null;
  const coucher = couches.find(x => x > (lever || maintenant)) || null;
  const e = ev.find(x => x.meridien && lever && coucher && x.meridien > lever && x.meridien < coucher) || null;
  return { lever, coucher, meridien: e && e.meridien, hauteurMax: e && e.hauteurMax, levee,
    azimutCoucher: coucher ? Astres.position("lune", coucher, g.lat, g.lon).azimut : null };
}

export function infosLune(maintenant, g) {
  const p = Astres.position("lune", maintenant, g.lat, g.lon);
  const ph = Astres.phase(maintenant);
  const pas = passageLune(maintenant, g);
  const t = maintenant.getTime();
  const pleine = Astres.prochainesPhases(maintenant).find(x => /Pleine/.test(x.nom));
  const nouvelle = Astres.prochainesPhases(maintenant).find(x => /Nouvelle/.test(x.nom));
  const jours = x => {
    const n = Math.round((x - maintenant) / 86400000);
    return n <= 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`;
  };
  const date = x => x.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

  const phrase = !pas.lever || !pas.coucher ? ""
    : t < pas.lever ? `Lever dans ${duree(pas.lever - t)}`
      : `Encore ${duree(pas.coucher - t)} au-dessus de l'horizon`;

  return {
    sorte: "lune",
    nom: "La Lune",
    grand: `${Math.round(ph.eclairee * 100)}`,
    unite: "%",
    sous: `${ph.nom.toLowerCase()}, `
      + (p.hauteur >= Astres.SEUIL.lune ? `à ${Math.round(p.hauteur)}° ${ou(p.azimut)}` : `sous l'horizon, ${ou(p.azimut)}`),
    arc: { de: pas.lever, a: pas.coucher, part: partDe(pas.lever, pas.coucher, t), phrase },
    lignes: [
      ["Lever", "", pas.lever],
      ["Passage au méridien", pas.hauteurMax === null ? "" : `${Math.round(pas.hauteurMax)}° au plus haut`, pas.meridien],
      ["Coucher", pas.azimutCoucher === null ? "" : ou(pas.azimutCoucher), pas.coucher],
    ].filter(l => l[2]),
    duo: [
      pleine ? [date(pleine.date), `pleine lune, ${jours(pleine.date)}`] : null,
      nouvelle ? [date(nouvelle.date), `nouvelle lune, ${jours(nouvelle.date)}`] : null,
    ].filter(Boolean),
  };
}

/* ---------- L'écran ---------- */

/* L'heure d'un instant, précédée du jour quand ce n'est pas aujourd'hui. */
const quand = (x, maintenant) => {
  const h = heureMinute(x);
  if (cleJour(x) === cleJour(maintenant)) return h;
  const lendemain = new Date(maintenant.getTime() + 86400000);
  if (cleJour(x) === cleJour(lendemain)) return `demain ${h}`;
  const veille = new Date(maintenant.getTime() - 86400000);
  return cleJour(x) === cleJour(veille) ? `hier ${h}` : h;
};

function arcSvg(arc, maintenant) {
  if (arc.part === null) return "";
  /* Une parabole de (10, 70) à (190, 70), sommet à (100, -14) : le point se
     place par le paramètre de la courbe, qui suit la part du passage. */
  const q = u => [(1 - u) * (1 - u) * 10 + 2 * (1 - u) * u * 100 + u * u * 190,
    (1 - u) * (1 - u) * 70 + 2 * (1 - u) * u * (-14) + u * u * 70];
  const [x, y] = q(arc.part);
  return `<svg class="pc-arc" viewBox="0 0 200 86" role="img" aria-label="${esc(arc.phrase)}">`
    + `<path d="M10 70 Q100 -14 190 70" class="pc-arc-tout"/>`
    + `<path d="M10 70 Q100 -14 190 70" class="pc-arc-fait" pathLength="1" style="--part:${arc.part.toFixed(3)}"/>`
    + `<line x1="0" y1="70" x2="200" y2="70" class="pc-arc-sol"/>`
    + `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" class="pc-arc-point"/>`
    + `<text x="10" y="84" text-anchor="start">${esc(quand(arc.de, maintenant))}</text>`
    + `<text x="190" y="84" text-anchor="end">${esc(quand(arc.a, maintenant))}</text>`
    + `</svg>`;
}

export function gabarit(inf, maintenant) {
  const t = maintenant.getTime();
  return `<div class="pc-infos">`
    + `<div class="pc-haut"><span class="pc-lbl">Maintenant, ${esc(heureMinute(maintenant))}</span>`
    + `<b class="pc-grand">${esc(inf.grand)}<sup>${inf.unite ? esc(` ${inf.unite}`) : "°"}</sup></b>`
    + `<em>${esc(inf.sous)}</em></div>`
    + (inf.arc.part === null ? "" : `<div class="pc-journee"><span class="pc-lbl">${inf.sorte === "lune" ? "Le passage" : "La journée"}</span>`
      + arcSvg(inf.arc, maintenant) + `<p>${esc(inf.arc.phrase)}</p></div>`)
    + `<div class="pc-lignes">` + inf.lignes.map(([nom, detail, x, teinte]) =>
      `<div class="pc-ligne${teinte ? ` pc-${teinte}` : ""}${x.getTime() < t ? " pc-passe" : ""}">`
      + `<span>${esc(nom)}${detail ? `<small>${esc(detail)}</small>` : ""}</span>`
      + `<b>${esc(quand(x, maintenant))}</b></div>`).join("") + `</div>`
    + `<div class="pc-duo">` + inf.duo.map(([b, em]) => `<div><b>${esc(b)}</b><em>${esc(em)}</em></div>`).join("")
    + `</div></div>`;
}

let ouvert = null;
export const estOuvert = () => ouvert !== null;

const calme = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* L'astre touché, ou rien. Le disque se reconnaît à la distance du toucher à
   son centre, non à sa toile : la toile du Soleil fait trois cents points pour
   un disque de cent quatorze, et sa couronne recouvre la moitié du ciel. Un
   bouton, un lien ou une cible de l'écran passent devant. */
export function astreTouche(ev) {
  const cible = ev.target;
  if (!(cible instanceof Element)) return null;
  const bouton = cible.closest("[data-plein-ciel]");
  if (bouton) {
    const sorte = bouton.dataset.pleinCiel;
    const cv = document.querySelector(sorte === "lune" ? "#ciLune" : "#ciFeu")
      || document.querySelector(sorte === "lune" ? "#ptLune" : "#ptSoleil");
    return cv ? { cv, sorte } : null;
  }
  if (cible.closest("button, a, input, select, label, [data-detail], [data-feuille]")) return null;
  const vignette = cible.closest(".pt-astre");
  if (vignette) return { cv: vignette, sorte: vignette.id === "ptLune" ? "lune" : "soleil" };
  for (const [id, sorte] of [["ciFeu", "soleil"], ["ciLune", "lune"]]) {
    const cv = document.getElementById(id);
    if (!cv || !cv.closest("#ecran")) continue;
    const r = cv.getBoundingClientRect();
    const rayon = r.width * PART[sorte];
    if (Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)) <= rayon * 1.3) {
      return { cv, sorte };
    }
  }
  return null;
}

export function ouvrir(source, sorte) {
  if (ouvert || !source || !Reglages.situe()) return;
  const g = Reglages.lire();
  const maintenant = new Date();
  const inf = sorte === "lune" ? infosLune(maintenant, g) : infosSoleil(maintenant, g);

  const W = window.innerWidth, H = window.innerHeight;
  const rs = source.getBoundingClientRect();
  const vignette = source.classList.contains("pt-astre");
  const r0 = rs.width * (vignette ? PART.vignette : PART[sorte]);
  const x0 = rs.left + rs.width / 2, y0 = rs.top + rs.height / 2;

  const r1 = Math.min(H * RAYON_PLEIN, W * 0.55);
  const droite = cote(sorte, sorte === "lune" ? Astres.phase(maintenant).nom : "") === "droite";
  const x1 = droite ? W * (1 - PART_VISIBLE) + r1 : W * PART_VISIBLE - r1, y1 = H * 0.5;
  const taille = r1 / PART[sorte];

  /* Le ciel du panneau qui porte l'astre, sans ses astres ni ses nuages. */
  const panneau = source.closest(".plein") && source.closest(".plein").querySelector(".ci");
  const rp = panneau ? panneau.getBoundingClientRect() : { top: 0, left: 0, right: W, bottom: H * 0.4 };
  const ciel = panneau ? panneau.cloneNode(true) : document.createElement("div");
  ciel.querySelectorAll(".ci-astre, .ci-temps, .ci-sol, .ci-horizon, .ci-voile-haut, .ci-voile-bas")
    .forEach(n => n.remove());
  ciel.classList.add("pc-ciel");
  ciel.removeAttribute("id");
  if (!panneau) ciel.className = "ci pc-ciel";
  const debut = `inset(${Math.max(0, rp.top)}px ${Math.max(0, W - rp.right)}px ${Math.max(0, H - rp.bottom)}px ${Math.max(0, rp.left)}px)`;

  const cadre = document.createElement("div");
  cadre.className = `pc pc-${sorte}${droite ? " pc-droite" : ""}`;
  cadre.setAttribute("role", "dialog");
  cadre.setAttribute("aria-modal", "true");
  cadre.setAttribute("aria-label", inf.nom);
  cadre.style.setProperty("--pc-debut", debut);
  /* Les données du dessin viennent de la grande toile du panneau quand elle
     existe, de la toile touchée sinon : la vignette de la Lune ne porte ni la
     clarté du ciel ni sa teinte. */
  const modele = document.getElementById(sorte === "lune" ? "ciLune" : "ciFeu") || source;
  const donnees = Object.entries(modele.dataset)
    .map(([k, v]) => `data-${k.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}="${esc(v)}"`).join(" ");
  cadre.innerHTML = `<canvas class="pc-astre" ${donnees} data-dpr-max="1.5" aria-hidden="true" `
    + `style="width:${taille.toFixed(1)}px;height:${taille.toFixed(1)}px;`
    + `left:${(x1 - taille / 2).toFixed(1)}px;top:${(y1 - taille / 2).toFixed(1)}px;`
    + `--pc-depart:translate(${(x0 - x1).toFixed(1)}px, ${(y0 - y1).toFixed(1)}px) scale(${(r0 / r1).toFixed(4)})"></canvas>`
    + gabarit(inf, maintenant)
    + `<button type="button" class="pc-fermer" aria-label="Refermer">×</button>`
    + `<p class="pc-indication">Toucher ou glisser vers le bas pour refermer</p>`;
  cadre.prepend(ciel);
  document.body.appendChild(cadre);

  const toile = cadre.querySelector(".pc-astre");
  if (toile.dataset.clarte === undefined && sorte === "lune") toile.dataset.clarte = "0";
  if (toile.dataset.chaud === undefined) toile.dataset.chaud = "0";
  /* Une Lune sous l'horizon se peint rougie dans le panneau, où elle se tient
     au ras du sol. Ouverte, elle se montre pour elle-même : sans le
     rougissement, que seule l'épaisseur d'atmosphère donne. */
  if (sorte === "lune" && Astres.position("lune", maintenant, g.lat, g.lon).hauteur < 0) toile.dataset.chaud = "0";

  source.style.visibility = "hidden";
  if (sorte === "lune") Relief.poser(toile); else Feu.poser(toile);

  const retour = document.activeElement;
  ouvert = { cadre, source, sorte, retour };
  document.documentElement.classList.add("pc-actif");

  // Deux images : la première pose l'état de départ, la seconde lance le passage.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    cadre.classList.add("pc-ouvert");
    cadre.querySelector(".pc-fermer").focus({ preventScroll: true });
  }));

  brancher(cadre);
}

export function fermer() {
  if (!ouvert) return;
  const { cadre, sorte, retour } = ouvert;
  ouvert = null;
  cadre.classList.remove("pc-ouvert");
  cadre.classList.add("pc-ferme");
  const fin = () => {
    if (!cadre.isConnected) return;
    cadre.remove();
    document.documentElement.classList.remove("pc-actif");
    /* Le rendu a pu refaire l'écran entre-temps : la toile d'origine se
       retrouve par son identifiant plutôt que par la référence gardée. */
    const ici = document.getElementById(sorte === "lune" ? "ciLune" : "ciFeu");
    document.querySelectorAll("#ciFeu, #ciLune, #ptSoleil, #ptLune").forEach(n => { n.style.visibility = ""; });
    if (sorte === "lune") Relief.poser(ici); else Feu.poser(ici);
    if (retour && retour.isConnected && typeof retour.focus === "function") retour.focus({ preventScroll: true });
  };
  if (calme()) { fin(); return; }
  setTimeout(fin, 900);
}

/* Toucher, croix, Échap et glissement vers le bas. Un glissement se reconnaît
   à quatre-vingts points vers le bas, plus vertical qu'horizontal ; un toucher
   qui n'a pas bougé de plus de dix points referme aussi. */
function brancher(cadre) {
  let depart = null;
  cadre.addEventListener("pointerdown", ev => { depart = { x: ev.clientX, y: ev.clientY }; });
  cadre.addEventListener("pointerup", ev => {
    if (!depart) return;
    const dx = ev.clientX - depart.x, dy = ev.clientY - depart.y;
    depart = null;
    if ((dy > 80 && dy > Math.abs(dx)) || Math.hypot(dx, dy) < 10) fermer();
  });
  cadre.addEventListener("pointercancel", () => { depart = null; });
  cadre.querySelector(".pc-fermer").addEventListener("click", ev => { ev.stopPropagation(); fermer(); });
  cadre.querySelector(".pc-fermer").addEventListener("pointerup", ev => ev.stopPropagation());
}

window.addEventListener("keydown", ev => { if (ev.key === "Escape" && ouvert) fermer(); });
