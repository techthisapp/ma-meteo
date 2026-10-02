/* « Mes lieux » et l'ajout d'un lieu : liste, glissement, ordre, recherche. Découpé de src/vues.js le 2 octobre 2026,
   docs/plan-decoupage-vues.md. */

import { esc } from "../horloge.js";
import * as P from "../previsions.js";
import { ico, icoCiel } from "../icones.js";
import { liste } from "../ecritures.js";
import * as Reglages from "../reglages.js";
import * as Astres from "../astres.js";
import * as Temps from "../temps.js";
import { cielDe } from "./astres.js";

/* ---------- Réglages et commune ---------- */

/* ---------- Communes suivies ----------

   Deux gestes séparent deux communes : le titre d'écran ouvre cette feuille,
   une rangée bascule. Chaque rangée porte le temps qu'il fait, sans quoi la
   liste ne serait qu'un répertoire de noms.

   La première rangée ne nomme pas un lieu mais l'appareil : Ma position relève
   la position et suit les déplacements. Elle est épinglée en tête et ne se
   retire pas. */

/* Le ciel d'un lieu, en deux couleurs, pour le fond de sa rangée. La hauteur du
   Soleil là-bas donne la teinte, le code de temps sensible la couvre et la
   plombe : la rangée porte le même ciel que l'accueil de ce lieu, en petit. Tout
   se calcule sur l'appareil, sans une requête de plus. */
function fondLieu(l, a) {
  const maintenant = new Date();
  const p = Astres.position("soleil", maintenant, l.lat, l.lon);
  const minuit = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const c = cielDe(p.hauteur, (maintenant - minuit) / 60000 < 720);
  return Temps.fond(c, Temps.depuis(a ? a.code : 0, null, null));
}

const styleFond = f => `--co-haut:${f.haut};--co-bas:${f.bas}`;

export function vueCommunes(ctx, rendre, majEtat) {
  const suivies = Reglages.suivies();
  const courante = Reglages.cleCourante();
  const pos = Reglages.position();
  const enPos = Reglages.enPosition();

  /* Chaque rangée porte le ciel de son lieu, la même image qu'en fond d'accueil
     là-bas : la liste se lit d'un coup d'œil, un bleu contre un gris. */
  const rangeePosition = () => {
    const sous = pos?.commune || (pos ? "Position relevée" : "Relever la position");
    const f = pos ? fondLieu(pos, null) : null;
    return `<div class="co co-pos" data-cle="${esc(Reglages.CLE_POSITION)}"`
      + (f ? ` style="${styleFond(f)}"` : ` data-plat`) + `>`
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
    const nom = l.commune || "Commune";
    /* Monter et descendre sont là pour le clavier et la synthèse vocale : au
       doigt, l'appui long suffit. Les boutons ne se voient qu'au focus, mais ils
       gardent leur taille de cible. */
    return `<div class="co" data-cle="${esc(c)}" style="${styleFond(fondLieu(l, null))}">`
      + `<span class="co-ordre">`
      + `<button type="button" class="co-o" data-monter="${esc(c)}" `
      + `aria-label="Monter ${esc(nom)}">${ico("chevron", "")}</button>`
      + `<button type="button" class="co-o" data-descendre="${esc(c)}" `
      + `aria-label="Descendre ${esc(nom)}">${ico("chevron", "")}</button></span>`
      + `<button type="button" class="co-l" data-k="${k}"`
      + (ici ? ` aria-current="true"` : "")
      + `><span class="co-ic" data-ic></span>`
      + `<span class="co-t"><b>${esc(nom)}</b>`
      + `<em data-bornes>${esc(l.codePostal || "")}</em></span>`
      + `<span class="co-d" data-deg><i class="ossature">00°</i></span>`
      /* La coche garde sa place sur toutes les rangées : sans quoi la colonne
         des températures se décalerait d'une rangée à l'autre. */
      + ico("coche", ici ? "co-coche" : "co-coche co-coche-vide")
      + `</button>`
      + `<button type="button" class="co-x" data-retirer="${esc(c)}">`
      + `Retirer<span class="co-hors">${esc(nom)} des lieux suivis</span></button>`
      + `</div>`;
  };

  const liste = `<div class="carte co-liste" id="coListe">`
    + rangeePosition() + suivies.map(rangee).join("")
    + `<p class="champ-erreur co-err" id="coErr" hidden></p></div>`;

  const plein = suivies.length >= Reglages.MAX_SUIVIES;

  return {
    titre: "Mes lieux",
    /* Ajouter ne vit plus au bas de la liste : c'est une action, elle se range
       dans la tête de feuille, à droite du titre. */
    action: `<button type="button" class="feuille-plus" data-feuille="ajout" `
      + `aria-label="Ajouter un lieu"${plein ? " disabled" : ""}>${ico("plus", "")}</button>`,
    corps: liste
      + `<p class="note">Ma position suit l'appareil et se relève à chaque ouverture. `
      + `Un appui long sur un lieu le déplace dans la liste. Glisser une rangée vers `
      + `la gauche pour la retirer. Le lieu courant porte une coche.</p>`
      + (plein ? `<p class="note">Dix lieux au plus. En retirer un pour en ajouter `
        + `un autre.</p>` : ""),

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
            /* Le ciel de la rangée n'est connu qu'une fois l'aperçu reçu : le
               marquage part d'un ciel dégagé, la couleur juste vient ici. Le
               symbole reste monochrome, un dessin bicolore posé sur un ciel
               peint ne se détacherait plus. */
            if (icone) icone.innerHTML = ico(icoCiel(a.code, a.jour), "");
            const f = fondLieu(l, a);
            el.style.setProperty("--co-haut", f.haut);
            el.style.setProperty("--co-bas", f.bas);
            el.removeAttribute("data-plat");
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

      brancherOrdre(bloc, cles => { Reglages.reordonnerSuivies(cles); rendre(); });

      for (const b of bloc.querySelectorAll("[data-monter],[data-descendre]")) {
        b.addEventListener("click", () => {
          const monte = b.hasAttribute("data-monter");
          Reglages.deplacerSuivie(monte ? b.dataset.monter : b.dataset.descendre, monte ? -1 : 1);
          rendre();
        });
      }
    },
  };
}

/* ---------- Ajouter un lieu ----------

   Une feuille à elle, poussée par le bouton de la tête de « Mes lieux ». Le
   champ occupait le bas de la liste et se faisait oublier ; il tient
   maintenant la page entière, et le clavier s'ouvre dessus. */

export function vueAjout(ctx, rendre, majEtat) {
  const plein = Reglages.suivies().length >= Reglages.MAX_SUIVIES;
  return {
    titre: "Ajouter un lieu",
    corps: `<div class="carte">`
      + `<div class="champ"><label for="rgQ">Nom de commune ou code postal</label>`
      + `<input class="rg-champ" id="rgQ" type="search" inputmode="search" autocomplete="off" `
      + `placeholder="Grenoble, 38000"${plein ? " disabled" : ""}></div>`
      + `<p class="champ-erreur" id="rgErr"${plein ? "" : " hidden"}>`
      + (plein ? `Dix lieux au plus. En retirer un pour en ajouter un autre.` : "")
      + `</p>`
      + `<div class="rg-res" id="rgRes"></div></div>`
      + `<p class="note">La recherche interroge l'interface adresse de data.gouv.fr, `
      + `sans compte ni clé.</p>`,
    brancher(bloc) {
      brancherRecherche(bloc, rendre, majEtat);
      // Le clavier s'ouvre sur le champ : la feuille n'existe que pour lui.
      const q = bloc.querySelector("#rgQ");
      if (q && !plein) requestAnimationFrame(() => q.focus());
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
/* Réordonner par appui long. Un déplacement avant la fin du délai annule la
   prise : le glissement de retrait garde donc son geste, et la liste n'a pas
   besoin d'un mode d'édition. Une fois la prise faite, la rangée capture le
   pointeur, ce qui met le glissement hors circuit pour la durée du
   déplacement. */
/* Le réordonnancement des lieux enregistrés, repris le 28 septembre 2026 à la
   demande de Jérôme. Trois défauts le rendaient pénible sur iPhone : après
   l'appui long, Safari prenait la main pour faire défiler la feuille et
   annulait le geste ; la rangée sautait d'une place à l'autre sans suivre le
   doigt ; une liste plus haute que l'écran ne se laissait pas parcourir.

   La rangée prise suit désormais le doigt, soulevée ; les autres glissent pour
   lui faire place ; la feuille défile d'elle-même quand le doigt approche de
   ses bords ; et le défilement natif est bloqué tant que la prise dure, par un
   écouteur unique sur le document, non passif, que les rendus successifs ne
   multiplient pas. */
let ordreEnCours = false;
if (typeof document !== "undefined") {
  document.addEventListener("touchmove", ev => { if (ordreEnCours) ev.preventDefault(); }, { passive: false });
}

function brancherOrdre(bloc, ordonner) {
  const liste = bloc.querySelector("#coListe");
  if (!liste) return;
  const DELAI = 300, SEUIL = 10, BORD = 64, VITESSE = 9, GLISSE = 180;
  const rangs = () => [...liste.querySelectorAll(".co:not(.co-pos)")];
  const defileur = () => {
    for (let n = liste.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return n;
    }
    return document.scrollingElement;
  };
  for (const el of rangs()) {
    let minuteur = null, x0 = 0, y0 = 0, prise = false, bouge = false;
    let prisePos = 0, dernierY = 0, auto = null, zone = null;
    const annuler = () => { clearTimeout(minuteur); minuteur = null; };
    const hautNaturel = () => {
      const t = el.style.transform;
      el.style.transform = "";
      const h = el.getBoundingClientRect().top;
      el.style.transform = t;
      return h;
    };
    const suivre = () => { el.style.transform = `translateY(${(dernierY - prisePos - hautNaturel()).toFixed(1)}px)`; };
    /* Les rangées voisines glissent vers leur nouvelle place au lieu d'y sauter. */
    const deplacer = (ref, avant) => {
      const autres = rangs().filter(f => f !== el);
      const avantR = new Map(autres.map(f => [f, f.getBoundingClientRect().top]));
      liste.insertBefore(el, avant ? ref : ref.nextSibling);
      bouge = true;
      for (const f of autres) {
        const d = avantR.get(f) - f.getBoundingClientRect().top;
        if (!d) continue;
        f.style.transition = "none";
        f.style.transform = `translateY(${d}px)`;
        f.getBoundingClientRect();
        f.style.transition = `transform ${GLISSE}ms ease-out`;
        f.style.transform = "";
      }
    };
    const placer = () => {
      for (const f of rangs()) {
        if (f === el) continue;
        const t = f.style.transform;
        f.style.transform = "";
        const b = f.getBoundingClientRect();
        f.style.transform = t;
        const milieu = b.top + b.height / 2;
        const apres = Boolean(f.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
        if (dernierY < milieu && apres) { deplacer(f, true); break; }
        if (dernierY > milieu && !apres) { deplacer(f, false); break; }
      }
      suivre();
    };
    const defiler = () => {
      auto = null;
      if (!prise) return;
      const r = zone === document.scrollingElement ? { top: 0, bottom: innerHeight } : zone.getBoundingClientRect();
      const pas = dernierY < r.top + BORD ? -VITESSE : dernierY > r.bottom - BORD ? VITESSE : 0;
      if (pas) {
        const avant = zone.scrollTop;
        zone.scrollTop += pas;
        if (zone.scrollTop !== avant) placer();
      }
      auto = requestAnimationFrame(defiler);
    };
    const lacher = () => {
      annuler();
      if (!prise) return;
      prise = false;
      ordreEnCours = false;
      cancelAnimationFrame(auto);
      el.style.transition = `transform ${GLISSE}ms ease-out`;
      el.style.transform = "";
      liste.classList.remove("co-ordonne");
      setTimeout(() => {
        el.classList.remove("co-prise");
        el.style.transition = "";
        for (const f of rangs()) { f.style.transition = ""; f.style.transform = ""; }
        if (bouge) ordonner(rangs().map(x => x.dataset.cle));
      }, GLISSE);
    };
    el.addEventListener("pointerdown", ev => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      x0 = ev.clientX; y0 = ev.clientY; dernierY = ev.clientY; bouge = false;
      minuteur = setTimeout(() => {
        minuteur = null;
        prise = true;
        ordreEnCours = true;
        prisePos = dernierY - el.getBoundingClientRect().top;
        zone = defileur();
        el.classList.add("co-prise");
        liste.classList.add("co-ordonne");
        try { el.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà relâché */ }
        if (navigator.vibrate) navigator.vibrate(8);
        suivre();
        auto = requestAnimationFrame(defiler);
      }, DELAI);
    });
    el.addEventListener("pointermove", ev => {
      if (!prise) {
        if (minuteur !== null
          && (Math.abs(ev.clientX - x0) > SEUIL || Math.abs(ev.clientY - y0) > SEUIL)) annuler();
        dernierY = ev.clientY;
        return;
      }
      ev.preventDefault();
      dernierY = ev.clientY;
      placer();
    });
    el.addEventListener("pointerup", lacher);
    el.addEventListener("pointercancel", lacher);
    // Un appui long n'est pas un appui : il ne doit pas basculer de lieu.
    el.addEventListener("click", ev => {
      if (bouge) { ev.preventDefault(); ev.stopPropagation(); bouge = false; }
    }, true);
    // Ni ouvrir le menu contextuel du système.
    el.addEventListener("contextmenu", ev => { if (prise || minuteur !== null) ev.preventDefault(); });
  }
}

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
