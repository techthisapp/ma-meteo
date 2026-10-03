/* Les feuilles de l'accueil : parapluie, activités, air, beau temps, ressenti, réglages. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { nombreFr, heureTxt, jourLong, esc } from "../horloge.js";
import * as P from "../previsions.js";
import { ico, icoCiel } from "../icones.js";
import { liste, moments } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Vig from "../vigilance.js";
import * as Parapluie from "../parapluie.js";
import * as Reponse from "../reponse.js";
import * as Activites from "../activites.js";
import * as BeauTemps from "../beautemps.js";
import * as Air from "../air.js";
import * as Atmo from "../atmo.js";
import * as Version from "../version.js";
import * as Justesse from "../justesse.js";
import { rangees, valeur, aide } from "./communs.js";

function justesseHTML() {
  const b = Justesse.bilan(Justesse.lire().lignes);
  const fr = n => String(n).replace(".", ",");
  const tete = `<div class="carte"><div class="carte-tete"><h3>Justesse des prévisions</h3></div>`;
  if (!b.jours) {
    return tete + `<p class="note">Aucun relevé encore : la justesse se mesure jour après jour sur cet appareil.</p></div>`;
  }
  const lignes = b.paliers.filter(p => p.ecart !== undefined).map(p =>
    `<div class="rangee"><span class="rangee-txt"><b>${esc(Justesse.nomEcheance(p.e).replace(/^./, c => c.toUpperCase()))}</b>`
    + `<span>${p.part2} % à 2° près, ${p.n} relevés${Math.abs(p.biais) >= 0.5 ? `, ${p.biais > 0 ? "trop chaude" : "trop fraîche"} de ${fr(Math.abs(p.biais))}°` : ""}</span></span>`
    + `<span class="rangee-val"><b>± ${fr(p.ecart)}°</b></span></div>`).join("");
  /* Sans phrase sur le délai, retirée à la demande de Jérôme le 27 septembre
     2026 : la carte donne les chiffres et la façon de les lire. */
  return tete + lignes
    + aide("Écart moyen entre la température annoncée et celle relevée, à 6 h et à 15 h.") + `</div>`;
}

/* ---------- Le rappel de parapluie ---------- */

/* Un fichier fabriqué sur l'appareil, remis au système. Aucun service dorsal
   n'intervient : le texte est construit ici, l'agenda du téléphone le lit. */
function telechargerIcs(texte, nom) {
  const url = URL.createObjectURL(new Blob([texte], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Le jour d'un jeton, dit comme on le dirait. La clé du jour se construit en
   heure locale : `toISOString` bascule sur l'UTC et nommerait la veille passé
   vingt-deux heures en été. */
const cleLocale = (d = new Date()) => `${d.getFullYear()}-`
  + `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const jourDit = j => (j === cleLocale() ? "aujourd'hui" : jourLong(j));

export function vueParapluie(ctx, rendre, majEtat) {
  const j = ctx.jeton;
  if (!j) {
    return {
      titre: "Rappel",
      corps: `<p class="note">Aucune pluie gênante n'est attendue d'ici la fin de `
        + `la journée. Le rappel ne paraît que lorsqu'il y a lieu.</p>`,
    };
  }

  const [nom, objet] = Parapluie.OBJETS[j.objet];
  const capuche = j.objet === "capuche";
  const depart = Parapluie.departDe(j);
  const surAlerte = depart === j.alerte;
  const suite = Parapluie.periodesPluvieuses(
    P.serieHorizon(), Reglages.alertes(Parapluie.ALERTES_DEFAUT));
  const autres = suite.filter(p => p.cle !== j.cle).length;

  return {
    titre: nom,
    sous: `${jourDit(j.jour)}, pluie de ${Parapluie.pluieTxt(j)}`,
    corps:
      `<div class="carte">`
      + `<div class="rangee">${ico(j.objet, "")}`
      + `<span class="rangee-txt"><b>Prendre ${capuche ? "une" : "un"} ${esc(objet)}</b>`
      + `<span>${capuche
        ? `Au delà de ${Parapluie.RETOURNEMENT} km/h de rafale, un parapluie se retourne.`
        : `Les rafales restent sous ${Parapluie.RETOURNEMENT} km/h.`}</span></span></div>`
      + `<div class="rangee"><span class="rangee-txt">Pluie attendue</span>`
      + valeur(Parapluie.pluieTxt(j)) + `</div>`
      + `<div class="rangee"><span class="rangee-txt">Pluie la plus forte</span>`
      + valeur(`${nombreFr(j.mm)} mm`, { doux: "dans l'heure" }) + `</div>`
      + `<div class="rangee"><span class="rangee-txt">Rafales</span>`
      + valeur(`${j.raf} km/h`) + `</div>`
      + `</div>`

      + `<button type="button" class="bouton-plein" id="plAgenda">`
      + `Poser un rappel dans l'agenda</button>`
      + (autres ? `<button type="button" class="bouton-borde" id="plSemaine">`
        + `Poser les ${suite.length} rappels de l'horizon</button>` : "")
      + `<button type="button" class="bouton-borde" id="plPris">C'est pris</button>`

      + `<p class="note">Rappel à ${esc(Parapluie.heureDemie(depart))}, alarme ${Parapluie.AVANCE} minutes avant.</p>`
      + aide((surAlerte ? "Le rappel tombe à l'heure d'alerte de cette période : c'est en sortant qu'on prend un parapluie."
        : "L'heure d'alerte est passée : le rappel tombe au début de la pluie.")
        + " « C'est pris » le retire jusqu'à la prochaine pluie."),

    brancher(bloc) {
      const poser = (lot, fichier, dit) => {
        const texte = Parapluie.ics(lot, ctx.commune);
        if (!texte) { majEtat("Aucun rappel à poser."); return; }
        telechargerIcs(texte, fichier);
        majEtat(dit);
      };
      bloc.querySelector("#plAgenda").addEventListener("click", () =>
        poser(j, "rappel-parapluie.ics", "Rappel remis à l'agenda."));
      const sem = bloc.querySelector("#plSemaine");
      if (sem) {
        sem.addEventListener("click", () =>
          poser(suite, "rappels-parapluie.ics",
            `${suite.length} rappels remis à l'agenda.`));
      }
      bloc.querySelector("#plPris").addEventListener("click", () => {
        Reglages.prendreJeton(j.cle);
        rendre({ ecran: true });
      });
    },
  };
}

/* ---------- L'écran de questions ---------- */

/* Six questions ordinaires, une réponse chacune. Le moteur et les seuils vivent
   dans `activites.js` ; la feuille ne fait que les écrire.

   Une activité sans créneau le dit et donne sa raison : « aucun créneau » seul
   ne permet pas de décider autrement. */
export function vueActivites() {
  const s = P.serieHoraire(0, Activites.FENETRE, 8);
  const r = s ? Activites.repondre(s, P.bilanEau(Activites.SEUILS_ACT.arrosageJours)) : [];

  if (!r.length) {
    return {
      titre: "Quand faire quoi",
      corps: `<p class="note">La prévision horaire manque : les créneaux se cherchent `
        + `sur les quarante-huit heures qui viennent.</p>`,
    };
  }

  return {
    titre: "Quand faire quoi",
    sous: "Sur les 48 heures qui viennent",
    corps: `<div class="carte groupe-plat">`
      + r.map(a => `<div class="rangee${a.creneau ? "" : " act-sans"}">`
        + ico(a.symbole, "")
        + `<span class="rangee-txt"><b>${esc(a.nom)}</b>`
        + `<span>${esc(a.detail)}${a.partages ? ", scénarios partagés" : ""}</span></span>`
        + `<span class="rangee-val"><b>${esc(a.quand)}</b></span></div>`).join("")
      + `</div>`
      + aide("Chaque activité montre le premier créneau qui lui convient."),
  };
}

/* ---------- L'air qu'on respire ---------- */

/* L'indice officiel français et ses cinq sous-indices, quand la source a
   répondu. Le nom écrit est celui de la zone que la source rend, non celui de
   la commune choisie : le service rend parfois une agglomération ou une
   commune voisine, et un chiffre sous un mauvais nom vaudrait moins que pas de
   chiffre. La distance se dit dès qu'elle dépasse deux kilomètres. */
function carteOfficielle(off) {
  if (!off) return "";
  const n = Atmo.niveauDe(off.code);
  const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);
  const lieu = off.zone ? esc(off.zone) : "la zone la plus proche";
  const loin = off.km >= 2 ? `, à ${nombreFr(off.km)} km` : "";
  return `<div class="carte"><div class="carte-tete"><h3>Indice ATMO officiel</h3></div>`
    + `<div class="rangee">`
    + `<span class="rangee-txt"><b>${lieu}</b><span>Aujourd'hui${loin}</span></span>`
    + valeur(majuscule(off.libelle || (n ? n.nom : "—")), { doux: String(off.code) })
    + `</div>`
    + Atmo.SOUS.map(([cle, nom, court]) => {
      const v = off.sous[cle];
      const m = Atmo.niveauDe(v);
      return `<div class="rangee">`
        + `<span class="rangee-txt"><b>${esc(nom)}</b><span>${esc(court)}</span></span>`
        + valeur(m ? majuscule(m.nom) : "—", { doux: v === null ? "" : String(v) })
        + `</div>`;
    }).join("")
    + aide("L'indice officiel retient le plus mauvais des cinq polluants : il peut être plus sévère que l'indice européen.")
    + `</div>`;
}

/* Ce qui entre dans les poumons, que le temps qu'il fait ne dit pas. L'indice
   européen et les quatre polluants qui le composent, puis les pollens en
   saison.

   Les seuils et les niveaux vivent dans `air.js`, avec leur origine. La feuille
   ne fait que les écrire, comme celle des activités et celle du beau temps. */
export function vueAir(ctx, rendre, majEtat) {
  const s = P.serieHoraire(0, 24, 8);
  const air = s ? Air.alignerSur(s) : null;

  /* L'indice officiel se lit après coup : le service met une vingtaine de
     secondes quand celui de Copernicus répond en une fraction. La feuille
     s'ouvre sans lui et se refait quand il arrive ; s'il ne vient pas, elle se
     lit telle quelle. */
  const off = Atmo.chargeCourante();
  if (!off && Number.isFinite(ctx?.lat)) {
    Atmo.charger({ lat: ctx.lat, lon: ctx.lon }).then(d => { if (d) rendre(); });
  }

  if (!air) {
    return {
      titre: "L'air qu'on respire",
      corps: `<p class="note">La source de l'air est muette. Elle couvre l'Europe `
        + `et rend quatre journées ; le reste de l'application n'en dépend pas.</p>`,
    };
  }

  const ici = air.aqi[0];
  const niv = Air.niveauDe(ici);
  const pr = Air.pire(air);
  const saison = Air.enSaison(air);
  const majuscule = t => t.charAt(0).toUpperCase() + t.slice(1);

  /* Le pire moment ne se dit que s'il dépasse le moment présent. Écrire « au
     plus haut, bon » sous un « maintenant, bon » ferait deux fois la même
     ligne. */
  const pireDit = pr && Number.isFinite(ici) && pr.indice > ici;

  /* La rangée ne porte pas de symbole : les deux se suivent dans la même carte
     et le même symbole écrit deux fois ne dirait rien de plus, quand son retrait
     aligne ces rangées sur celles des polluants juste en dessous. */
  const rangeeAir = (nom, sous, indice) => {
    const n = Air.niveauDe(indice);
    return `<div class="rangee">`
      + `<span class="rangee-txt"><b>${esc(nom)}</b><span>${esc(sous)}</span></span>`
      + valeur(majuscule(n.nom), { doux: String(indice) })
      + `</div>`;
  };

  const heureDe = k => heureTxt(s.heure[k]);

  return {
    titre: "L'air qu'on respire",
    sous: niv ? majuscule(niv.nom) : "",
    corps:
      `<div class="carte">`
      + rangeeAir("Maintenant", "Indice européen de qualité de l'air", ici)
      + (pireDit ? rangeeAir("Au plus haut",
        `Vers ${heureDe(pr.k)}, sur les vingt-quatre heures qui viennent`, pr.indice) : "")
      + `</div>`

      + `<div class="carte"><div class="carte-tete"><h3>Ce qui compose l'indice</h3></div>`
      + Air.POLLUANTS.map(([cle, nom, , court]) => `<div class="rangee">`
        + `<span class="rangee-txt"><b>${esc(nom)}</b><span>${esc(court)}</span></span>`
        + valeur(air[cle][0] === null ? "—" : `${nombreFr(air[cle][0])}`,
          { doux: "µg/m³" }) + `</div>`).join("")
      + aide(`L'indice suit le polluant le plus mal placé. Six niveaux par pas de vingt, de bon à extrêmement mauvais ; `
        + `au-delà de ${Air.DEGRADE}, l'accueil le signale.`) + `</div>`

      + carteOfficielle(off)

      + `<div class="carte"><div class="carte-tete"><h3>Les pollens</h3></div>`
      + (saison.length
        ? saison.map(p => `<div class="rangee">${ico("pollen", "")}`
          + `<span class="rangee-txt"><b>${esc(p.nom)}</b>`
          + `<span>${p.etat === "pic" ? `Au pic vers ${esc(heureDe(p.k))}` : "En saison"}`
          + `</span></span>`
          + valeur(nombreFr(p.valeur), { doux: "grains/m³" }) + `</div>`).join("")
        : `<p class="note">Aucun pollen en saison dans les vingt-quatre heures.</p>`)
      + aide("En saison dès 10 grains par mètre cube, au pic à 100 ; pour les graminées et l'ambroisie, 3 et 50.")
      + `</div>`,
  };
}

/* ---------- Où est le beau temps ---------- */

/* La feuille jumelle de l'écran de questions. L'une dit quand, l'autre dit où,
   et les deux rangées de l'accueil se lisent comme une paire.

   Deux échelles et deux coûts. Les lieux suivis à l'ouverture, une dizaine de
   points dans un appel ; cent kilomètres à la ronde sur appui, soixante-neuf
   points dans un autre. La grille ne part pas d'elle-même : elle répond à une
   question qu'on ne pose pas chaque matin.

   Le score, ses poids et ses seuils vivent dans `beautemps.js`. La feuille ne
   fait que les écrire, comme celle des activités. */
export function vueBeauTemps(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) {
    return {
      titre: "Où est le beau temps",
      corps: `<p class="note">Aucun lieu courant : la comparaison part d'ici.</p>`,
    };
  }

  const ici = { nom: g.commune || "Ici", lat: g.lat, lon: g.lon, ici: true };
  /* Les lieux suivis, le lieu courant en tête et sans doublon : il est presque
     toujours l'un d'eux, et sa rangée porte le repère de lieu. */
  const lieux = [ici, ...Reglages.suivies()
    .filter(l => l.lat !== g.lat || l.lon !== g.lon)
    .map(l => ({ nom: l.commune || "Commune", lat: l.lat, lon: l.lon, ici: false }))]
    .map(l => ({ ...l, km: BeauTemps.km(ici, l), cap: BeauTemps.azimut(ici, l) }));

  const points = BeauTemps.grille(ici);
  const S = BeauTemps.SEUILS_BEAU;

  return {
    titre: "Où est le beau temps",
    corps:
      `<div class="seg bt-jours">`
      + [["0", "Aujourd'hui"], ["1", "Demain"]].map(([k, n]) =>
        `<button type="button" data-jour="${k}"${k === "0" ? ' class="actif"' : ""}>`
        + `${esc(n)}</button>`).join("")
      + `</div>`

      + `<div class="carte" id="btLieux"><div class="carte-tete"><h3>Mes lieux</h3></div>`
      + `<p class="note">Lecture…</p></div>`

      + `<button type="button" class="bouton-borde bt-large" id="btLarge">`
      + `Chercher à ${S.rayon} km à la ronde</button>`
      + `<div class="carte" id="btGrille" hidden></div>`

      + aide(`Classement selon le soleil de la journée, corrigé par la pluie et la température, autour de ${S.agreable}°.`),

    brancher(bloc) {
      let j = 0;                       // la journée montrée, 0 aujourd'hui, 1 demain
      let dLieux = null, dGrille = null;
      const noms = new Map();          // « lat,lon » vers la commune, ou vide
      const demandes = new Set();
      const cle = l => `${l.lat},${l.lon}`;

      const carteLieux = bloc.querySelector("#btLieux");
      const carteGrille = bloc.querySelector("#btGrille");
      const bLarge = bloc.querySelector("#btLarge");

      /* Une rangée de classement. Le nom manquant d'un point de grille est
         remplacé par sa position, laquelle situe déjà : une rangée vide en
         attendant l'interface adresse ne dirait rien. */
      const rangee = l => {
        const nom = l.nom || noms.get(cle(l)) || "";
        const loin = l.km >= 1 ? BeauTemps.loinTxt(l) : "";
        const sous = [nom && loin, BeauTemps.journeeTxt(l)].filter(Boolean).join(" · ");
        return `<div class="rangee${l.ici ? " bt-ici" : ""}">`
          + ico(icoCiel(l.code, true), "")
          + `<span class="rangee-txt"><b>${esc(nom || loin || "Ici")}`
          + (l.ici ? ico("lieu", "bt-repere") : "") + `</b>`
          + `<span>${esc(sous)}</span></span>`
          + valeur(BeauTemps.soleilTxt(l.soleil), { doux: "de soleil" })
          + `</div>`;
      };

      const tete = t => `<div class="carte-tete"><h3>${esc(t)}</h3></div>`;

      const peindreLieux = () => {
        if (!dLieux) return;
        const cl = BeauTemps.classer(lieux, dLieux, j);
        carteLieux.innerHTML = tete("Mes lieux")
          + (cl.length ? cl.map(rangee).join("")
            : `<p class="note">La source n'a rien rendu pour ces lieux.</p>`)
          + (lieux.length < 2 ? `<p class="note">Ajoutez des lieux pour les comparer.</p>` : "");
      };

      /* Les points nommés sont ceux qui sont montrés, non la grille entière :
         soixante-neuf géocodages inverses pour cinq rangées lues coûteraient
         soixante-quatre appels pour rien. */
      const nommer = async liste => {
        const reste = liste.filter(l => !l.nom && !noms.has(cle(l)) && !demandes.has(cle(l)));
        if (!reste.length) return;
        reste.forEach(l => demandes.add(cle(l)));
        await Promise.all(reste.map(async l => {
          const c = await Reglages.communeDe(l.lat, l.lon);
          noms.set(cle(l), c?.commune || "");
        }));
        peindreGrille();
      };

      const peindreGrille = () => {
        if (!dGrille) return;
        const cl = BeauTemps.classer(points, dGrille, j);
        const iciG = BeauTemps.iciDans(cl);
        const mieux = BeauTemps.mieuxQuIci(cl, iciG);
        const montres = BeauTemps.retenir(cl);
        // Ici garde sa rangée même hors du haut du classement : c'est la
        // référence à laquelle les autres se comparent.
        if (iciG && !montres.includes(iciG)) montres.push(iciG);
        /* Le centre de la grille est le lieu courant, dont le nom est déjà
           connu : le demander à l'interface adresse coûterait un appel pour
           réapprendre ce que les réglages portent. */
        const rangees = montres.map(l => (l.ici ? { ...l, nom: ici.nom } : l));
        carteGrille.innerHTML = tete(`À ${S.rayon} km à la ronde`)
          + `<p class="note bt-verdict">${esc(mieux
            ? `Mieux ${BeauTemps.loinTxt(mieux)}.`
            : "Le beau temps est ici.")}</p>`
          + rangees.map(rangee).join("");
        nommer(rangees);
      };

      P.journees(lieux).then(({ liste, age }) => {
        dLieux = liste;
        peindreLieux();
        if (age === null) majEtat("Source indisponible : les lieux ne sont pas comparés.", { erreur: true });
      });

      for (const b of bloc.querySelectorAll("[data-jour]")) {
        b.addEventListener("click", () => {
          j = Number(b.dataset.jour);
          for (const x of bloc.querySelectorAll("[data-jour]")) x.classList.toggle("actif", x === b);
          peindreLieux();
          peindreGrille();
        });
      }

      bLarge.addEventListener("click", async () => {
        bLarge.disabled = true;
        bLarge.setAttribute("aria-busy", "true");
        const { liste, age } = await P.journees(points);
        bLarge.removeAttribute("aria-busy");
        if (age === null) {
          bLarge.disabled = false;
          majEtat("Source indisponible : la grille n'a pas pu être lue.", { erreur: true });
          return;
        }
        dGrille = liste;
        bLarge.hidden = true;
        carteGrille.hidden = false;
        peindreGrille();
      });
    },
  };
}

/* ---------- Le ressenti personnel ---------- */

/* Deux personnes ne sentent pas le même froid. Un retour en un geste, trop
   chaud ou trop froid, déplace le conseil d'habillement de la réponse du matin,
   et rien d'autre : les degrés écrits viennent de la source. */
export function vueRessenti(ctx, rendre, majEtat) {
  const b = Reglages.biais();
  const r = ctx.reponse;
  const dit = b === 0 ? "Aucune correction"
    : `${b > 0 ? "+" : "−"}${Math.abs(b)} degré${Math.abs(b) > 1 ? "s" : ""}`;

  return {
    titre: "Mon ressenti",
    sous: dit,
    corps:
      (r ? `<div class="carte"><div class="carte-tete"><h3>Conseil du jour</h3></div>`
        + `<p class="rs-phrase">${esc(r.texte)}</p></div>` : "")

      + `<div class="carte"><div class="carte-tete"><h3>La dernière fois</h3></div>`
      + `<div class="rs-geste">`
      + `<button type="button" class="bouton-borde" data-biais="1">J'ai eu trop chaud</button>`
      + `<button type="button" class="bouton-borde" data-biais="-1">J'ai eu trop froid</button>`
      + `</div>`
      + (b !== 0 ? `<button type="button" class="bouton-texte" id="rsZero">`
        + `Revenir à zéro</button>` : "")
      + aide(`Chaque appui décale le conseil d'habillement d'un degré, jusqu'à ${Reponse.BIAIS_MAX} degrés. `
        + "Les températures affichées ne changent pas.")
      + `</div>`,

    brancher(bloc) {
      for (const x of bloc.querySelectorAll("[data-biais]")) {
        x.addEventListener("click", () => {
          const avant = Reglages.biais();
          const apres = Reglages.poserBiais(avant + Number(x.dataset.biais), Reponse.BIAIS_MAX);
          if (apres === avant) { majEtat(`Correction bornée à ${Reponse.BIAIS_MAX} degrés.`); return; }
          rendre({ dessous: true });
        });
      }
      const z = bloc.querySelector("#rsZero");
      if (z) {
        z.addEventListener("click", () => {
          Reglages.poserBiais(0, Reponse.BIAIS_MAX);
          rendre({ dessous: true });
        });
      }
    },
  };
}

/* Le choix d'une heure, au pas de la demi-heure. Un menu déroulant plutôt qu'un
   champ d'heure : le champ natif propose la minute, précision que la source
   horaire n'a pas, et son clavier diffère d'un système à l'autre. */
const optionsHeure = (de, a, valeur) => {
  let o = "";
  for (let h = de; h <= a; h += 0.5) {
    o += `<option value="${h}"${h === valeur ? " selected" : ""}>`
      + `${esc(Parapluie.heureDemie(h))}</option>`;
  }
  return o;
};

export function vueReglages(ctx, rendre, majEtat) {
  const g = Reglages.lire();
  const c = P.chargeCourante();
  const al = Reglages.alertes(Parapluie.ALERTES_DEFAUT);
  const per = Parapluie.periodes(al);
  const ALERTES = [["Première alerte", 0], ["Seconde alerte", 1]];

  /* Toutes les sources, en un seul endroit depuis le jalon 20 : les écrans ne
     les citent plus, décision de Jérôme du 3 octobre 2026. Chacune une fois,
     rangée par sujet. Les services qui reçoivent le lieu affiché y sont tous,
     audit du 1er octobre 2026, constat 2.1. */
  const sources = [
    ["Prévision", "Open-Meteo, avec AROME de Météo-France sur les deux premiers jours ; confiance par les "
      + "scénarios d'ICON et d'ECMWF ; tendance au-delà de seize jours par GFS"],
    /* Un service muet le dit ici aussi, audit, constat 2.6. */
    ["Vigilance, pluie dans l'heure", (() => {
      const l = Vig.etatLecture();
      if (!l.muette) return "Météo-France";
      return `Météo-France ; vigilance non lue${l.depuis ? ` depuis le ${l.depuis.toLocaleDateString("fr-FR",
        { day: "numeric", month: "long" })} à ${heureTxt(l.depuis.getHours())}` : ""}, le service ne répond pas`;
    })()],
    ["Climat d'ici", "réanalyse ERA5 de Copernicus, par Open-Meteo"],
    ["Air et pollens", "Copernicus, par Open-Meteo ; indice officiel d'Atmo France"],
    ["Eau", "restrictions VigiEau ; nappes, rivières, étiage ONDE et température de l'eau par Hub'eau ; "
      + "sol estimé par Open-Meteo, sur le principe de l'indicateur du BRGM"],
    ["Mer et plages", "mer par Open-Meteo, marées estimées ; eaux de baignade de l'Agence européenne de l'environnement"],
    ["Neige", "stations OpenSkiMap, © contributeurs OpenStreetMap, licence ODbL ; neige par Open-Meteo"],
    ["Durées de route", "serveur public de démonstration OSRM"],
    ["Communes", "interfaces adresse et découpage administratif de data.gouv.fr"],
    ["Couches de la carte", "pluie RainViewer ; foudre et nuages EUMETSAT ; feux du système européen d'information sur les feux de forêt"],
    /* Le fond est embarqué : ces sources ne reçoivent rien, elles sont citées
       pour leurs licences. Jalon 19, lot 2. */
    ["Fond de la carte", "contours et cours d'eau de l'IGN, Natural Earth, relief d'après les altitudes Terrarium de Mapzen, "
      + "villes de geo.api.gouv.fr"],
    ["Le ciel", "Soleil, Lune et étoiles calculés sur l'appareil ; étoiles du catalogue HYG, figures de d3-celestial"],
  ];

  /* L'ordre des cartes, jalon 20 : les réglages qu'on touche d'abord, puis
     l'application et les données, les sources en dernier. La section du
     rappel automatique sur iPhone est retirée, décision de Jérôme. */
  return {
    titre: "Réglages",
    corps:
      `<div class="carte"><div class="carte-tete"><h3>Heures d'alerte</h3></div>`
      + ALERTES.map(([n, i]) => `<div class="rangee">`
        /* La dernière période finit à minuit, non à « 24 h » : c'est ainsi
           qu'on dit la fin d'une journée. */
        + `<span class="rangee-txt"><b>${esc(n)}</b><span>couvre `
        + `${esc(Parapluie.heureDemie(per[i][0]))} à `
        + `${per[i][1] === 24 ? "minuit" : esc(Parapluie.heureDemie(per[i][1]))}</span></span>`
        + `<span class="rangee-val rg-fen">`
        + `<select class="rg-h" data-alerte="${i}" `
        + `aria-label="${esc(n)} de la journée">`
        + optionsHeure(0, 23.5, al[i]) + `</select>`
        + `</span></div>`).join("")
      + aide("Les moments où l'on veut être prévenu de la pluie. Chaque alerte annonce la pluie "
        + "jusqu'à la suivante, la dernière jusqu'à minuit.") + `</div>`

      + `<div class="carte"><div class="carte-tete"><h3>Heure par heure</h3></div>`
      + `<div class="seg">` + Reglages.ECRITURES.map(([k, n]) =>
        `<button type="button" data-ecriture="${k}"${k === g.ecriture ? ' class="actif"' : ""}>${esc(n)}</button>`)
        .join("") + `</div></div>`

      + `<div class="carte"><div class="carte-tete"><h3>Pollens suivis</h3></div>`
      + Air.POLLENS.map(p => {
        const suivi = Reglages.pollenSuivi(p.cle);
        return `<button type="button" class="rangee rg-bascule" role="switch" `
          + `aria-checked="${suivi}" data-pollen="${esc(p.cle)}">`
          + `<span class="rangee-txt"><b>${esc(p.nom)}</b>`
          + `<span>saison à partir de ${p.saison} grains/m³</span></span>`
          + ico("coche", suivi ? "rg-coche" : "rg-coche rg-coche-vide") + `</button>`;
      }).join("")
      + aide("Un pollen retiré ne s'annonce plus sur l'accueil ; la feuille de l'air le montre toujours.") + `</div>`

      /* La justesse des prévisions, jalon 6 préparé au jalon 12, lot 7 : ce que
         le journal a déjà mesuré, par échéance, avec le nombre de jours
         relevés, pour que le lecteur sache si les chiffres sont assis. */
      + justesseHTML()

      /* La version, et la recherche d'une plus récente à la demande. */
      + `<div class="carte"><div class="carte-tete"><h3>Application</h3></div>`
      + `<div class="rangee"><span class="rangee-txt">Version</span>`
      + `<span class="rangee-val" id="rgVersion">${Version.numero()}</span></div>`
      /* Les deux boutons des réglages s'alignent sur le texte des rangées,
         3 octobre 2026 : le bouton bordé, sans bord sur la surface de la
         carte, se lisait décalé et laissait un vide sous lui. */
      + `<div class="rangee rg-maj"><button type="button" class="bouton-texte rg-b" id="rgChercher">`
      + `Rechercher une mise à jour</button><span class="note" id="rgMaj" role="status"></span></div>`
      + `</div>`

      + `<div class="carte"><div class="carte-tete"><h3>Données de cet appareil</h3></div>`
      + `<p class="note" id="rgDonnees">Aucun compte. Les réglages, les lieux suivis et les données gardées `
      + `restent sur cet appareil.</p>`
      + (g.lat !== null ? `<div class="rangee"><span class="rangee-txt">Coordonnées du lieu</span>`
        + `<span class="rangee-val">${esc(`${g.lat}, ${g.lon}`)}</span></div>` : "")
      + `<div class="rangee"><button type="button" class="bouton-texte rg-b" id="rgEffacer">`
      + `Effacer les données de cet appareil</button></div>`
      + aide("Pour lire la météo, les services de la carte « Sources » reçoivent les coordonnées du lieu "
        + "affiché, arrondies à un kilomètre environ en mode position. Le fond de la carte et le ciel ne reçoivent rien.")
      + `</div>`

      + `<div class="carte"><div class="carte-tete"><h3>Sources</h3></div>`
      /* Le sujet au-dessus, ses sources dessous, 3 octobre 2026 : en deux
         colonnes, « Vigilance, pluie dans l'heure » tenait sur trois lignes
         et les sources se tassaient à droite. */
      + sources.map(([n, v]) => `<div class="rangee rg-src"><span class="rangee-txt"><b>${esc(n)}</b>`
        + `<span>${esc(v)}</span></span></div>`).join("")
      + `</div>`,

    brancher(bloc) {
      /* Efface tout ce que l'application garde sur l'appareil : réglages, lieux
         suivis, dernier relevé de position, prévisions et caches. La copie hors
         ligne de l'application elle-même reste. Audit du 1er octobre 2026,
         constat 2.3. */
      bloc.querySelector("#rgEffacer")?.addEventListener("click", () => {
        if (!confirm("Effacer les réglages, les lieux suivis, la dernière position et les données gardées sur cet appareil ?")) return;
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith("mameteo.")) localStorage.removeItem(k);
        } catch { /* stockage indisponible */ }
        location.reload();
      });
      const chercher = bloc.querySelector("#rgChercher");
      const dit = bloc.querySelector("#rgMaj");
      if (chercher) {
        chercher.addEventListener("click", async () => {
          dit.textContent = "Recherche…";
          const p = await Version.publiee();
          if (p === null) { dit.textContent = "La recherche n'a pas abouti, hors ligne peut-être."; return; }
          if (p <= Version.numero()) { dit.textContent = "Cette version est la plus récente."; return; }
          dit.innerHTML = `La version ${p} est disponible. `
            + `<button type="button" class="bouton-plein" id="rgRecharger">Recharger</button>`;
          dit.querySelector("#rgRecharger").addEventListener("click", () => location.reload());
        });
      }
      for (const b of bloc.querySelectorAll("[data-ecriture]")) {
        b.addEventListener("click", () => {
          Reglages.poserEcriture(b.dataset.ecriture);
          for (const x of bloc.querySelectorAll("[data-ecriture]")) {
            x.classList.toggle("actif", x === b);
          }
        });
      }

      /* Une seconde alerte qui passerait avant la première est refusée par les
         réglages. Le menu revient alors à la valeur en vigueur, plutôt que de
         montrer un état que rien n'enregistre. La feuille se refait ensuite,
         chaque rangée disant la période que son alerte couvre. */
      const menus = [...bloc.querySelectorAll(".rg-h")];
      for (const m of menus) {
        m.addEventListener("change", () => {
          const i = Number(m.dataset.alerte);
          const v = [...Reglages.alertes(Parapluie.ALERTES_DEFAUT)];
          v[i] = Number(m.value);
          Reglages.poserAlertes(v);
          const apres = Reglages.alertes(Parapluie.ALERTES_DEFAUT);
          if (apres[i] !== Number(m.value)) {
            for (const x of menus) x.value = String(apres[Number(x.dataset.alerte)]);
            majEtat("La seconde alerte vient après la première.", { erreur: true });
          } else {
            rendre({ dessous: true });
          }
        });
      }

      /* Le profil d'allergies. L'écran de dessous se refait avec la feuille :
         un pollen retiré peut faire disparaître une ligne de l'accueil, et la
         voir partir sous la feuille est ce qui dit que le réglage a pris. */
      for (const b of bloc.querySelectorAll("[data-pollen]")) {
        b.addEventListener("click", () => {
          Reglages.basculerPollen(b.dataset.pollen);
          rendre({ dessous: true });
        });
      }
    },
  };
}
