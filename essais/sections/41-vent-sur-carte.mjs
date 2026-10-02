/* Le vent sur la carte. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Le vent sur la carte";
export const avecPage = true;

export default async T => {
  const { ctx, nav, etat, ok, brancherRoutes, ouvrirPage, onglet, ouvrirCarte } = T;
  etat.appelsGrille.length = 0;
  const [ctxVent, pgVent] = await ouvrirCarte({ ...FAIN, ventcarte: true, nappe: null }, 0);

  /* La règle du sens se lit sur la fonction : un vent de nord vient du nord et
     souffle vers le sud. C'est la faute la plus facile à commettre et la plus
     difficile à voir sur une image. */
  ok("le vent souffle vers où il va, non d'où il vient",
    await pgVent.evaluate(async () => {
      const V = await import("/src/vent.js");
      const n = V.composantes(0);        // vent de nord
      if (!(n.nord < -0.99)) return `vent de nord : composante ${n.nord.toFixed(2)}`;
      const o = V.composantes(270);      // vent d'ouest
      if (!(o.est > 0.99)) return `vent d'ouest : composante ${o.est.toFixed(2)}`;
      /* Le point avance : un vent de nord fait descendre la latitude, un vent
         d'ouest fait monter la longitude. */
      const p = V.avancerPoint(47, 2, 0, 100, 2000);
      if (!(p.lat < 47) || Math.abs(p.lon - 2) > 1e-6) return `point ${p.lat}, ${p.lon}`;
      const q = V.avancerPoint(47, 2, 270, 100, 2000);
      if (!(q.lon > 2) || Math.abs(q.lat - 47) > 1e-6) return `point ${q.lat}, ${q.lon}`;
      /* La longueur d'une traînée croît avec la force : c'est la seule chose qui
         distingue un vent léger d'un vent fort sur cette carte. */
      return V.longueurTrace(50) > V.longueurTrace(12) * 3 ? ""
        : `longueurs ${V.longueurTrace(12).toFixed(1)} et ${V.longueurTrace(50).toFixed(1)}`;
    }) === "");


  /* L'encre de la toile du vent : le nombre de points non transparents, sur un
     échantillon. La toile est transparente au départ, les particules la
     couvrent. */
  const encreVent = `async () => {
  const cv = document.getElementById("caToileVent");
  const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4 * 17) if (d[i] > 24) n++;
  return n;
}`;

  /* La fonction se pose dans la page par une évaluation de Playwright, qui
     échappe à la politique de sécurité de la page ; un `eval` dans la page y
     est refusé depuis la version 139. */
  const poserEncre = p => p.evaluate(`window.__encreVent = ${encreVent}`);
  await poserEncre(pgVent);
  ok("la couche allumée couvre sa toile de traînées",
    await pgVent.evaluate(async e => {
      await new Promise(r => setTimeout(r, 900));
      const n = await window.__encreVent();
      return n > 200 ? "" : `${n} points d'encre`;
    }, encreVent) === "");

  /* Version 140, demande de Jérôme du 2 octobre 2026 : la couleur des
     traînées suit la vitesse, et les particules sont plus denses. L'encre
     posée doit être celle d'un palier, et les paliers vont du calme à la
     tempête par des couleurs distinctes. */
  ok("les traînées prennent la couleur de leur vitesse, plus denses qu'avant",
    await pgVent.evaluate(async () => {
      const V = await import("/src/vent.js");
      if (V.couleurVent(5) === V.couleurVent(65) || V.couleurVent(25) === V.couleurVent(85)) return "paliers confondus";
      if (!(V.DENSITE > 1 / 200)) return `densité ${V.DENSITE}`;
      const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      const pal = V.PALIERS.map(([, c]) => rgb(c));
      const cv = document.getElementById("caToileVent");
      const d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
      let pleins = 0, justes = 0;
      for (let i = 0; i < d.length; i += 4 * 7) {
        if (d[i + 3] < 230) continue;
        pleins++;
        if (pal.some(c => Math.abs(c[0] - d[i]) + Math.abs(c[1] - d[i + 1]) + Math.abs(c[2] - d[i + 2]) < 30)) justes++;
      }
      if (pleins < 20) return `${pleins} points pleins`;
      return justes / pleins > 0.8 ? "" : `${justes} sur ${pleins} points à la couleur d'un palier`;
    }) === "");

  /* Les traînées suivent la direction du champ. La charge d'essai souffle du
     sud-sud-ouest, donc vers le haut et la droite de l'écran. Une traînée est une
     suite de points alignés : deux points distants de trois pixels dans cette
     direction sont encrés ensemble bien plus souvent que dans la direction
     perpendiculaire. */
  const penteDit = await pgVent.evaluate(async () => {
    const cv = document.getElementById("caToileVent");
    const ctx = cv.getContext("2d");
    const V = await import("/src/vent.js");
    await new Promise(r => setTimeout(r, 600));
    const l = cv.width, h = cv.height;
    const d = ctx.getImageData(0, 0, l, h).data;
    const encre = (x, y) => (x < 0 || y < 0 || x >= l || y >= h)
      ? false : d[(y * l + x) * 4 + 3] > 24;
    /* Le champ d'essai : direction autour de 205 degrés. */
    const c = V.composantes(205);
    const pas = 6;
    const dx = Math.round(c.est * pas), dy = Math.round(-c.nord * pas);
    const px = Math.round(-c.nord * pas), py = Math.round(-c.est * pas);
    let suivi = 0, travers = 0;
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < l; x += 3) {
        if (!encre(x, y)) continue;
        if (encre(x + dx, y + dy)) suivi++;
        if (encre(x + px, y + py)) travers++;
      }
    }
    if (suivi + travers < 100) return `trop peu de points : ${suivi} et ${travers}`;
    return suivi > travers * 1.6 ? ""
      : `les traînées ne suivent pas le champ : ${suivi} dans le sens, ${travers} en travers`;
  });
  ok("les traînées suivent la direction du champ", penteDit === "", penteDit);

  /* Les deux couches vivent de la même lecture : la grille porte la température,
     le vent et sa direction dans les mêmes quatre colonnes. Allumer la seconde ne
     coûte donc rien à la source. */
  const grilleDit = await pgVent.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    document.getElementById("caCouches").click(); await dodo(200);
    document.getElementById("caTemp").click(); await dodo(900);
    return document.getElementById("caTemp").getAttribute("aria-checked");
  });
  ok("les deux couches se partagent une seule lecture de la grille",
    etat.appelsGrille.length === 1 && grilleDit === "true",
    `${etat.appelsGrille.length} appels, température ${grilleDit}`);

  /* La toile du vent est posée devant celle de la carte : elle ne doit prendre
     aucun geste, sans quoi le doigt cesserait de déplacer la carte. */
  ok("la toile du vent ne prend pas les gestes",
    await pgVent.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      /* Le panneau des couches, laissé ouvert par le contrôle précédent, couvre
         le haut du cadre : il faut le refermer pour interroger la carte. Il a
         grandi d'une rangée avec la nappe de la qualité de l'air et atteint
         désormais le centre du cadre. */
      const ouvre = document.getElementById("caCouches");
      if (ouvre.getAttribute("aria-expanded") === "true") { ouvre.click(); await dodo(200); }
      const cv = document.getElementById("caToileVent");
      const s = getComputedStyle(cv);
      if (s.pointerEvents !== "none") return `pointer-events ${s.pointerEvents}`;
      const r = cv.getBoundingClientRect();
      const sous = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return sous && sous.id === "caToile" ? "" : `le doigt tombe sur ${sous && sous.id}`;
    }) === "");

  /* Un changement de cadrage efface les traînées : peintes à des places qui ne
     désignent plus le même endroit, elles seraient un souvenir de l'ancienne
     vue. */
  const cadrageDit = await pgVent.evaluate(async e => {
      const lu = window.__encreVent;
      const dodo = m => new Promise(r => setTimeout(r, m));
      const avant = await lu();
      document.getElementById("caToile").dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
      /* L'encre est relevée plusieurs fois de suite : le creux tombe quelque part
         dans les images qui suivent le changement de vue, et le guetter à un
         instant fixe reviendrait à jouer contre l'horloge. */
      let creux = Infinity;
      for (let k = 0; k < 24; k++) { creux = Math.min(creux, await lu()); await dodo(8); }
      await dodo(900);
      const apres = await lu();
      if (!(creux < avant / 4)) return `${avant} avant, creux à ${creux}`;
      return apres > creux * 3 ? "" : `la toile ne se repeuple pas : ${apres}`;
    }, encreVent);
  ok("un changement de cadrage efface les traînées", cadrageDit === "", cadrageDit);

  ok("la légende du vent nomme trois forces par des longueurs croissantes",
    await pgVent.evaluate(() => {
      const l = document.getElementById("caLegVent");
      if (l.hidden) return "la légende manque";
      const traits = [...l.querySelectorAll("i")].map(i => parseFloat(i.style.width));
      const mots = [...l.querySelectorAll(".ca-lv-r")].map(x => x.textContent.trim());
      if (traits.length !== 3) return `${traits.length} traits`;
      if (!(traits[0] < traits[1] && traits[1] < traits[2])) return `longueurs ${traits.join(", ")}`;
      return mots.join(",") === "léger,modéré,fort" ? "" : `mots ${mots.join(", ")}`;
    }) === "");

  /* Deux couches de la même source ne nomment cette source qu'une fois. */
  ok("la mention nomme la source une seule fois pour deux couches",
    await pgVent.evaluate(async () => {
      const c = document.getElementById("caCredit");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const deux = c.textContent;
      const n = (deux.match(/Open-Meteo/g) || []).length;
      if (n !== 1) return `${n} fois la source : ${deux}`;
      if (!/Température et vent/.test(deux)) return `mention ${deux}`;
      /* Le vent seul se nomme aussi : la mention suit les couches allumées. */
      document.getElementById("caSansNappe").click(); await dodo(600);
      const seul = c.textContent;
      document.getElementById("caTemp").click(); await dodo(600);
      return /Vent/.test(seul) && !/Température/.test(seul) ? ""
        : `mention du vent seul : ${seul}`;
    }) === "");

  /* Le vent se superpose : il ne fait pas partie du choix exclusif des nappes, et
     les deux se voient ensemble. */
  ok("le vent se pose sur une nappe sans l'éteindre",
    await pgVent.evaluate(async e => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      await dodo(400);
      const encre = await window.__encreVent();
      const temp = document.getElementById("caTemp").getAttribute("aria-checked");
      const vent = document.getElementById("caVent").getAttribute("aria-checked");
      if (temp !== "true" || vent !== "true") return `température ${temp}, vent ${vent}`;
      return encre > 200 ? "" : `${encre} points d'encre sous la nappe`;
    }, encreVent) === "");

  /* Le choix se garde d'une visite à l'autre. La garde éteint la couche avant de
     partir : le contexte d'essai l'ouvre allumée, et vérifier qu'elle l'est encore
     au retour ne dirait rien de ce qui a été écrit. */
  const gardeVentDit = await pgVent.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    const aller = async () => {
      document.querySelector('[data-onglet="accueil"]').click(); await dodo(400);
      document.querySelector('[data-onglet="carte"]').click(); await dodo(900);
      document.getElementById("caCouches").click(); await dodo(200);
    };
    document.getElementById("caVent").click(); await dodo(500);
    await aller();
    const r1 = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
    if (document.getElementById("caVent").getAttribute("aria-checked") !== "false") {
      return "la couche éteinte revient allumée";
    }
    if (r1.ventcarte !== false) return `réglage après extinction : ${JSON.stringify(r1.ventcarte)}`;
    document.getElementById("caVent").click(); await dodo(700);
    await aller();
    const r2 = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
    if (document.getElementById("caVent").getAttribute("aria-checked") !== "true") {
      return "la couche rallumée revient éteinte";
    }
    return r2.ventcarte === true ? "" : `réglage après rallumage : ${JSON.stringify(r2.ventcarte)}`;
  });
  ok("le choix du vent se garde", gardeVentDit === "", gardeVentDit);

  /* Éteinte, la couche n'anime rien et laisse sa toile vide : c'est le geste de
     qui ménage sa batterie, et il doit valoir quelque chose. */
  const eteintDit = await pgVent.evaluate(async e => {
      const V = await import("/src/vent.js");
      const dodo = m => new Promise(r => setTimeout(r, m));
      document.getElementById("caVent").click(); await dodo(500);
      const encre = await window.__encreVent();
      if (V.anime()) return "la boucle tourne encore";
      return encre === 0 ? "" : `${encre} points d'encre restants`;
    }, encreVent);
  ok("la couche éteinte n'anime rien et vide sa toile", eteintDit === "", eteintDit);

  await ctxVent.close();

  /* Sous mouvement réduit, la couche montre une image fixe : les traînées disent
     le champ, rien ne bouge. */
  const ctxVentFige = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    reducedMotion: "reduce",
  });
  await ctxVentFige.addInitScript(amorceGardee({ ...FAIN, ventcarte: true, nappe: null }, FIGE));
  await brancherRoutes(ctxVentFige);
  const pgVentFige = await ctxVentFige.newPage();
  await ouvrirPage(pgVentFige);
  await pgVentFige.locator('[data-onglet="carte"]').click();
  /* Une pause fixe, non l'attente du repos : la toile du vent change sans
     toucher au document, et l'erreur volontaire 181 laissait une encre qui
     s'effaçait après le repos. Relue trop tôt, la toile passait. */
  await pgVentFige.waitForTimeout(1200);
  const figeLu = async () => { await poserEncre(pgVentFige); return pgVentFige.evaluate(async e => {
    const V = await import("/src/vent.js");
    const lu = window.__encreVent;
    const encre = await lu();
    if (V.anime()) return "la boucle tourne sous mouvement réduit";
    return encre > 100 ? "" : `${encre} points d'encre`;
  }, encreVent); };
  const ventFigeDit = await figeLu();
  /* La carte rouverte trouve la grille déjà lue : elle arrive avant le cadrage
     d'ouverture, et le vent posé alors ne doit pas rester vide. À la première
     ouverture, l'ordre des arrivées dépend de la charge du poste, et l'erreur
     volontaire 181 n'était vue qu'un jour sur deux. */
  await pgVentFige.locator('[data-onglet="accueil"]').click();
  await pgVentFige.waitForTimeout(400);
  await pgVentFige.locator('[data-onglet="carte"]').click();
  await pgVentFige.waitForTimeout(1200);
  const ventFigeRouvert = await figeLu();
  ok("le mouvement réduit fige les particules sans les effacer", ventFigeDit === "" && ventFigeRouvert === "",
    `première ouverture « ${ventFigeDit} », carte rouverte « ${ventFigeRouvert} »`);
  await ctxVentFige.close();

  /* ---------- La pluie dans l'heure ---------- */
};
