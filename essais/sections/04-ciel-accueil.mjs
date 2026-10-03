/* Le ciel de l'accueil. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */

export const titre = "Le ciel de l'accueil";
export const avecPage = true;

export default async T => {
  const { pg, nav, ok, onglet, ecranCiel } = T;
  /* Le bandeau de l'accueil suit la grammaire du soleil et de la lune : plein
     cadre, titre posé dans le ciel, barre de tête déshabillée. Ce qui lui est
     propre, c'est le temps qu'il fait, peint devant l'astre. */
  ok("le ciel de l'accueil occupe toute la largeur", await pg.evaluate(() => {
    const ci = document.querySelector("#ecran .ci");
    if (!ci) return false;
    const b = ci.getBoundingClientRect();
    return b.left <= 0.5 && Math.abs(b.right - window.innerWidth) < 0.5 && b.top <= 0.5;
  }));
  ok("la barre de tête se déshabille sur le ciel de l'accueil",
    await pg.locator("#nav.sur-ciel").count() === 1);
  ok("le temps est peint sur une toile",
    await pg.locator("canvas#ciTemps").count() === 1);
  ok("la toile du temps couvre le panneau", await pg.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    const ci = document.querySelector("#ecran .ci");
    if (!cv || !ci) return false;
    const a = cv.getBoundingClientRect(), b = ci.getBoundingClientRect();
    return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
  }));
  /* Le temps passe devant l'astre : un nuage cache le Soleil, non l'inverse. La
     toile vient donc après lui dans l'ordre du document, et au-dessus par sa
     couche. */
  ok("le temps se peint devant l'astre", await pg.evaluate(() => {
    const ci = document.querySelector("#ecran .ci");
    const cv = document.getElementById("ciTemps");
    const as = ci && ci.querySelector(".ci-astre");
    if (!ci || !cv) return false;
    if (!as) return true;
    const apres = as.compareDocumentPosition(cv) & Node.DOCUMENT_POSITION_FOLLOWING;
    return Boolean(apres) && Number(getComputedStyle(cv).zIndex) >= 1;
  }));
  /* Les quatre mesures portent sur la journée civile, non sur l'heure en cours.
     « Indice UV 0 » à dix heures du soir ne dit rien d'une journée montée à sept.
     Le jeu figé donne sept d'indice au plus contre cinq à neuf heures, et
     quatre-vingt-dix-huit pour cent d'humidité au plus contre quatre-vingts. */
  const jour = await pg.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll(".bd-m")].map(e =>
      [e.querySelector("i").textContent.trim(), e.querySelector("b").textContent.trim()])));
  /* Depuis le 3 octobre 2026, décision de Jérôme : les heures à venir jusqu'à
     minuit, et non plus la journée civile, dont la nuit passée portait
     l'humidité à 98 %. */
  const portees = await pg.evaluate(() => [...document.querySelectorAll(".bd-m em")].map(e => e.textContent));
  ok("les mesures portent sur les heures à venir jusqu'à minuit, et le disent",
    jour["Indice UV"] === "7" && jour["Humidité"] === "89 %" && jour["Vent"] === "23 km/h"
    && portees.filter(t => /d'ici minuit/.test(t)).length >= 7,
    JSON.stringify({ jour, portees }));
  /* Chaque mesure dit sur quoi elle porte : un chiffre de journée présenté comme
     un relevé d'instant se lirait de travers. */
  ok("chaque mesure dit sa portée", await pg.evaluate(() =>
    [...document.querySelectorAll(".bd-m")].every(e => (e.querySelector("em") || {}).textContent)));

  /* Le renversement de température se juge d'un maximum de journée à l'autre. La
     règle coupait en deux la fenêtre de vingt-quatre heures, ce qui revenait à
     comparer un après-midi à une nuit : elle annonçait un refroidissement tous les
     jours de beau temps, et nommait « le plus chaud de demain » un relevé du petit
     matin. La charge d'essai a deux journées de même chaleur : rien ne doit se
     dire. */
  ok("aucun renversement annoncé quand demain vaut aujourd'hui", await pg.evaluate(() =>
    [...document.querySelectorAll(".conseils .cj-l")]
      .filter(e => /Refroidissement|Réchauffement/.test(e.dataset.phrase || e.textContent))
      .map(e => e.dataset.phrase || e.textContent).join(" | ")) === "",
    await pg.evaluate(() => [...document.querySelectorAll(".conseils .cj-l")]
      .map(e => (e.dataset.phrase || e.textContent).trim()).join(" | ")));

  /* Le Soleil et la Lune partagent le ciel dès qu'ils sont levés tous les deux.
     À neuf heures du matin la Lune est à quarante degrés sous l'horizon : le
     Soleil est seul, et rien ne doit tenir sa place. */
  ok("de jour, Lune couchée, le Soleil est seul",
    await pg.locator("canvas#ciFeu").count() === 1
    && await pg.locator("#ecran canvas#ciLune").count() === 0,
    `${await pg.locator("canvas#ciFeu").count()} soleil, ${await pg.locator("#ecran canvas#ciLune").count()} lune`);

  /* Les deux astres se placent par leur azimut, dans un même repère. Le Soleil
     suivait l'heure, ce qui le posait ailleurs que là où il est : à neuf heures
     il tombait au milieu du panneau alors qu'il est à l'est-nord-est. La même
     règle sur les deux écrans donne la même place au même instant. */
  const placeAccueil = await pg.evaluate(() =>
    document.querySelector("#ecran .ci-astre").style.getPropertyValue("--ax"));
  await ecranCiel(pg, "soleil");
  const placeSoleil = await pg.evaluate(() =>
    document.querySelector("#ecran .ci-astre").style.getPropertyValue("--ax"));
  await onglet("accueil");
  /* Les deux lectures se font à quelques secondes d'écart, sur une horloge qui
     avance : quand une minute tombe entre elles, le Soleil a bougé d'un dixième
     de point, 15,8 contre 15,9 le 30 septembre 2026. Trois dixièmes de
     tolérance, l'avancée d'une à deux minutes, gardent la garde juste. */
  ok("le Soleil est à la même place sur les deux écrans",
    Math.abs(parseFloat(placeAccueil) - parseFloat(placeSoleil)) <= 0.3 && parseFloat(placeAccueil) < 30,
    `${placeAccueil} contre ${placeSoleil}`);

  /* La règle de choix, éprouvée sur des cas que la charge d'essai ne porte pas :
     une Lune neuve en plein jour, deux astres qui se frôlent. */
  const choix = await pg.evaluate(async () => {
    const V = await import("/src/vues.js");
    const cas = [
      ["jour, Lune levée et écartée", { hauteur: 17, azimut: 270 }, { hauteur: 22, azimut: 191 }, 0.37, true, true],
      ["jour, Lune sous l'horizon", { hauteur: 22, azimut: 95 }, { hauteur: -43, azimut: 67 }, 0.33, true, false],
      ["nuit, Lune levée", { hauteur: -12, azimut: 300 }, { hauteur: 11, azimut: 200 }, 0.57, false, true],
      ["nuit, Lune couchée", { hauteur: -30, azimut: 20 }, { hauteur: -20, azimut: 60 }, 0.5, false, true],
      ["jour, Lune neuve", { hauteur: 27, azimut: 130 }, { hauteur: 58, azimut: 170 }, 0.10, true, false],
      ["jour, astres qui se frôlent", { hauteur: 39, azimut: 220 }, { hauteur: 16, azimut: 205 }, 0.25, true, false],
    ];
    const fautes = [];
    for (const [nom, ps, pl, ecl, soleil, lune] of cas) {
      const v = V.astresVus(ps, pl, ecl);
      if (v.soleil !== soleil || v.lune !== lune) {
        fautes.push(`${nom} : soleil ${v.soleil}, lune ${v.lune}`);
      }
    }
    return fautes.join(" | ");
  });
  ok("le ciel choisit ses astres", choix === "", choix);

  ok("la toile du temps porte des pixels", await pg.evaluate(() => {
    const cv = document.getElementById("ciTemps");
    const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 3; i < d.length; i += 400) if (d[i] > 8) return true;
    return false;
  }));
  ok("le ciel bouge d'une image à l'autre", await pg.evaluate(async () => {
    const cv = document.getElementById("ciTemps");
    const lire = () => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const a = lire();
    await new Promise(r => setTimeout(r, 700));
    const b = lire();
    let som = 0, n = 0;
    for (let i = 0; i < b.length; i += 16) { som += Math.abs(b[i] - a[i]); n++; }
    return som / n > 0.5;
  }));

  /* Le passage de la prévision au dessin. La couverture décide de la forme du
     ciel, le code décide de la précipitation, et la couche décide de ce qui reste
     visible de l'astre. */
  const cielsRendus = await pg.evaluate(async () => {
    const T = await import("/src/temps.js");
    const cas = {
      clair: T.depuis(0, 4, 0), eclaircies: T.depuis(2, 45, 0), couvert: T.depuis(3, 97, 0),
      brume: T.depuis(45, 88, 0), pluie: T.depuis(63, 94, 2.1), averse: T.depuis(81, 74, 4.6),
      orage: T.depuis(95, 98, 7.4), neige: T.depuis(73, 90, 1.8),
      secours: T.depuis(63, null, null),
    };
    const voiles = {};
    for (const [n, p] of Object.entries(cas)) voiles[n] = T.voileDe(p);
    return { cas, voiles, seuil: T.SEUIL_VOILE };
  });
  const cr = cielsRendus;
  ok("un ciel clair n'a ni couche ni précipitation",
    cr.cas.clair.nappe === 0 && cr.cas.clair.lame === 0 && cr.cas.clair.cumulus < 0.1);
  ok("des éclaircies portent des cumulus, sans couche",
    cr.cas.eclaircies.nappe === 0 && cr.cas.eclaircies.cumulus > 0.3);
  ok("un ciel couvert porte une couche fermée",
    cr.cas.couvert.nappe > 0.9 && cr.cas.couvert.cumulus < 0.3);
  /* Sous une couche fermée, plus aucune masse isolée : celle qui restait se
     lisait comme un ballon suspendu devant le plafond. Sous une couche partielle,
     elles subsistent, c'est le ciel d'averse. */
  ok("sous une couche fermée il ne reste aucune masse isolée",
    cr.cas.couvert.cumulus === 0 && cr.cas.averse.cumulus > 0.4,
    `${cr.cas.couvert.cumulus} | ${cr.cas.averse.cumulus}`);
  ok("une averse garde ses cumulus sous une couche partielle",
    cr.cas.averse.cumulus > 0.4 && cr.cas.averse.nappe > 0.1 && cr.cas.averse.nappe < 0.7);
  ok("la pluie, l'averse, l'orage et la neige portent une lame",
    ["pluie", "averse", "orage", "neige"].every(n => cr.cas[n].lame > 0));
  ok("la neige tombe en neige, la pluie en pluie",
    cr.cas.neige.genre === "neige" && cr.cas.pluie.genre === "pluie");
  ok("l'orage est marqué comme tel", cr.cas.orage.orage === true && cr.cas.clair.orage === false);
  ok("le brouillard est un voile, non une averse",
    cr.cas.brume.brouillard > 0 && cr.cas.brume.lame === 0);
  /* La charge de secours ne porte que le code : une pluie ne peut pas tomber d'un
     ciel vide, la couverture se déduit donc du code. */
  ok("sans couverture nuageuse, le code en tient lieu",
    cr.cas.secours.nappe > 0.5 && cr.cas.secours.lame > 0);
  ok("sous une couche fermée l'astre n'est plus dessiné",
    cr.voiles.couvert >= cr.seuil && cr.voiles.pluie >= cr.seuil
    && cr.voiles.orage >= cr.seuil);
  ok("sous un ciel dégagé l'astre garde toute sa lumière",
    cr.voiles.clair === 0 && cr.voiles.eclaircies < cr.seuil);
};
