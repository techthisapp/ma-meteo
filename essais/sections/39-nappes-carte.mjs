/* Les nappes de la carte. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, NUAGES_DERNIER, FOUDRE_PAS, FOUDRE_DERNIER, heureService } from "../faux-services.mjs";

export const titre = "Les nappes de la carte";
export const avecPage = true;

export default async T => {
  const { ctx, etat, ok, onglet, reposer } = T;
  /* Les cartes de cette section s'ouvrent sans le fond enrichi : leurs
     contrôles lisent la couleur des nappes en des points précis. */
  const ouvrirCarte = (r, f) => T.ouvrirCarte(r, f, { sansFond: true });
  etat.appelsGrille.length = 0;
  /* La pluie est allumée au départ et se pose désormais par-dessus la nappe :
     les contrôles qui lisent la couleur d'une nappe l'éteignent d'abord, sans
     quoi ils mesureraient la couleur de la pluie. */
  const [ctxNap, pgNap] = await ouvrirCarte({ ...FAIN, pluiecarte: false }, 0);

  ok("la nappe ne demande rien tant qu'elle n'est pas choisie",
    etat.appelsGrille.length === 0, `${etat.appelsGrille.length} appels`);

  ok("le panneau des couches s'ouvre et se ferme",
    await pgNap.evaluate(async () => {
      const b = document.getElementById("caCouches");
      const p = document.getElementById("caPanneau");
      const dodo = m => new Promise(r => setTimeout(r, m));
      if (!p.hidden) return "le panneau est ouvert à l'arrivée";
      b.click(); await dodo(200);
      if (p.hidden) return "l'appui n'ouvre pas le panneau";
      if (b.getAttribute("aria-expanded") !== "true") return "le bouton ne dit pas qu'il est ouvert";
      document.getElementById("caToile").dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }));
      await dodo(200);
      return p.hidden ? "" : "un appui sur la carte ne referme pas le panneau";
    }) === "");

  /* Le panneau en tuiles, posé le 10 septembre 2026. En liste, sept entrées
     prenaient la moitié du cadre ; en tuiles de trois par rangée, neuf tiennent
     dans un tiers. Le nom reste sur chaque tuile, et la légende garde le nom
     entier quand la tuile porte un nom court. */
  const tuiles = await pgNap.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    const p = document.getElementById("caPanneau");
    if (p.hidden) { document.getElementById("caCouches").click(); await dodo(200); }
    const cadre = document.querySelector(".ca-cadre").getBoundingClientRect();
    const pan = p.getBoundingClientRect();
    /* Chaque tuile reçoit son appui : rien ne la couvre, ni légende ni
       chronologie. Le pied de la carte, qui les porte, est remonté sous le
       panneau le temps de la mesure : selon l'écran et les couches allumées,
       il le rejoint ou non. */
    const pied = document.querySelector(".ca-pied");
    const avantPied = pied.getAttribute("style") || "";
    pied.style.top = "0";
    const atteintes = [...p.querySelectorAll(".ca-ch")].every(b => {
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return y > window.innerHeight || b.contains(document.elementFromPoint(x, y));
    });
    pied.setAttribute("style", avantPied);
    const toutesVues = [...p.querySelectorAll(".ca-ch")].every(b => {
      const r = b.getBoundingClientRect();
      return r.left >= pan.left - 1 && r.right <= pan.right + 1 && r.top >= pan.top - 1 && r.bottom <= pan.bottom + 1;
    }) && p.scrollHeight <= p.clientHeight + 1;
    /* Les nappes vont par familles depuis la version 154, une ligne chacune ;
       les superpositions gardent leur grille. */
    const familles = [...p.querySelectorAll(".ca-fam")].map(f =>
      new Set([...f.querySelectorAll(".ca-ch")].map(b => Math.round(b.getBoundingClientRect().top))).size);
    const rangees = [...p.querySelectorAll(".ca-grille")].map(g => ({
      defile: g.scrollWidth > g.clientWidth + 1,
      tops: new Set([...g.querySelectorAll(".ca-ch")].map(b => Math.round(b.getBoundingClientRect().top))).size }));
    const outils = document.querySelector(".ca-outils").getBoundingClientRect();
    const fond = getComputedStyle(p).backgroundColor;
    const ch = [...p.querySelectorAll(".ca-ch")].map(b => {
      const r = b.getBoundingClientRect();
      const svg = b.querySelector("svg"), sp = b.querySelector("span");
      return { id: b.id, top: Math.round(r.top), left: Math.round(r.left), largeur: Math.round(r.width),
        /* Un mot coupé se voit à une ligne de plus que de mots. */
        deborde: sp ? (sp.scrollWidth > r.width + 1
          || Math.round(sp.getBoundingClientRect().height / parseFloat(getComputedStyle(sp).lineHeight || 14))
            > sp.textContent.trim().split(/\s+/).length) : false,
        nom: sp ? sp.textContent.trim() : "",
        icoSous: !!(svg && sp && svg.getBoundingClientRect().bottom <= sp.getBoundingClientRect().top + 1) };
    });
    document.getElementById("caToile").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }));
    await dodo(200);
    return { hauteurCadre: cadre.height, hauteur: pan.height, gauche: pan.left,
      droite: pan.right, largeurEcran: window.innerWidth, tuiles: ch, rangees,
      outilsGauche: outils.left, fond, toutesVues, atteintes, familles };
  });

  /* Le panneau ouvert devait laisser à la carte la plus grande part du cadre,
     seuil aux deux cinquièmes. Jérôme a levé cette règle le 2 octobre 2026 :
     un panneau plus haut où toutes les tuiles se voient vaut mieux qu'une
     rangée à faire défiler. Il doit seulement tenir dans le cadre. */
  ok("le panneau ouvert tient dans le cadre de la carte",
    tuiles.hauteur > 0 && tuiles.hauteur <= tuiles.hauteurCadre - 16,
    `${Math.round(tuiles.hauteur)} sur ${Math.round(tuiles.hauteurCadre)}`);

  /* Version 140, demandes de Jérôme du 2 octobre 2026 : toutes les tuiles se
     voient sans rien faire défiler, aucun nom ne déborde ni ne se coupe au
     milieu d'un mot, le panneau laisse libre la colonne des commandes et
     laisse paraître la carte à travers un fond à moitié transparent. */
  ok("toutes les tuiles du panneau se voient d'un coup, sans nom coupé, et reçoivent leur appui",
    tuiles.rangees.length === 1 && tuiles.rangees.every(r => !r.defile) && tuiles.toutesVues && tuiles.atteintes
    && tuiles.familles.length === 7 && tuiles.familles.every(n => n === 1)
    && tuiles.tuiles.every(t => t.largeur >= 60 && !t.deborde),
    JSON.stringify({ rangees: tuiles.rangees, familles: tuiles.familles, toutesVues: tuiles.toutesVues, atteintes: tuiles.atteintes,
      etroites: tuiles.tuiles.filter(t => t.largeur < 60).map(t => t.id),
      deborde: tuiles.tuiles.filter(t => t.deborde).map(t => t.id) }));
  const alpha = Number((/[,/]\s*(0?\.\d+)\)$/.exec(tuiles.fond) || [])[1]);
  ok("le panneau laisse libre la colonne des commandes et son fond est à moitié transparent",
    tuiles.droite <= tuiles.outilsGauche && alpha > 0 && alpha <= 0.6,
    `${Math.round(tuiles.droite)} contre ${Math.round(tuiles.outilsGauche)}, fond ${tuiles.fond}`);

  ok("chaque tuile porte son nom sous son icône",
    tuiles.tuiles.every(t => t.nom.length > 0 && t.icoSous),
    tuiles.tuiles.filter(t => !t.nom || !t.icoSous).map(t => t.id).join(" "));

  ok("le panneau reste dans l'écran",
    tuiles.gauche >= 0 && tuiles.droite <= tuiles.largeurEcran,
    `de ${Math.round(tuiles.gauche)} à ${Math.round(tuiles.droite)} sur ${tuiles.largeurEcran}`);

  /* Une seule nappe à la fois, mais la pluie n'en est plus une depuis le
     19 septembre 2026 : elle se lit en même temps qu'une température ou une
     qualité de l'air, et sa chronologie reste. */
  ok("une seule nappe à la fois",
    await pgNap.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      const lu = id => document.getElementById(id).getAttribute("aria-checked");
      document.getElementById("caTemp").click(); await dodo(900);
      if (lu("caTemp") !== "true") return "la température ne se marque pas";
      document.getElementById("caUV").click(); await dodo(700);
      if (lu("caUV") !== "true") return "l'indice ultraviolet ne se marque pas";
      if (lu("caTemp") !== "false") return "la température reste marquée sous l'indice";
      document.getElementById("caTemp").click(); await dodo(700);
      return "";
    }) === "");

  /* Dans les deux sens : allumer la pluie sous une nappe déjà choisie, et
     choisir une nappe sous une pluie déjà allumée. Le second sens est celui que
     l'usage rencontre, et le premier réglage ne l'éprouvait pas. */
  ok("la pluie se lit en même temps qu'une nappe",
    await pgNap.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      const lu = id => document.getElementById(id).getAttribute("aria-checked");
      document.getElementById("caPluie").click(); await dodo(900);
      if (lu("caPluie") !== "true") return "la pluie ne s'allume pas";
      if (lu("caTemp") !== "true") return "la température s'est éteinte sous la pluie";
      if (document.getElementById("caTemps").hidden) return "la chronologie n'est pas là";
      document.getElementById("caUV").click(); await dodo(900);
      if (lu("caUV") !== "true") return "l'indice ultraviolet ne se marque pas";
      if (lu("caPluie") !== "true") return "la pluie s'est éteinte sous une nappe choisie";
      document.getElementById("caTemp").click(); await dodo(700);
      if (lu("caPluie") !== "true") return "la pluie s'est éteinte au second choix";
      document.getElementById("caPluie").click(); await dodo(500);
      return "";
    }) === "");

  ok("la nappe choisie demande sa grille une seule fois",
    etat.appelsGrille.length === 1, `${etat.appelsGrille.length} appels`);

  /* La charge d'essai fait descendre la température du sud au nord. La nappe se
     lit donc au pixel : le sud du pays doit être plus chaud, donc plus rouge, que
     le nord. La rampe va du bleu au rouge, c'est l'écart des composantes qui
     parle, non leur valeur. */
  const nappeDit = await pgNap.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      const C = await import("/src/carte.js");
      /* La rampe encode la valeur dans la teinte, du bleu 214 au rouge 8 : c'est
         elle qui se lit, non les composantes. Le fond gris de la carte n'a pas de
         teinte, sa saturation le dit. */
      const teinte = (r, g, b) => {
        const [x, y, z] = [r, g, b].map(v => v / 255);
        const mx = Math.max(x, y, z), mn = Math.min(x, y, z), d = mx - mn;
        if (d < 1e-6) return { h: null, s: 0 };
        let h = mx === x ? ((y - z) / d) % 6 : mx === y ? (z - x) / d + 2 : (x - y) / d + 4;
        h *= 60; if (h < 0) h += 360;
        return { h, s: d / (1 - Math.abs(mx + mn - 1)) };
      };
      const lire = (la, lo) => {
        const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
        const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
        return teinte(d[0], d[1], d[2]);
      };
      const sud = lire(43.6, 1.4), nord = lire(50.3, 3.0);
      if (sud.h === null || nord.h === null) return "un point du pays n'est pas teinté";
      if (!(sud.h < nord.h - 4)) {
        return `le sud n'est pas plus chaud : teintes ${sud.h.toFixed(0)} et ${nord.h.toFixed(0)}`;
      }
      /* La nappe s'arrête au pays : un point en pleine mer rend la même couleur
         nappe allumée et nappe éteinte. Le comparer à une teinte écrite d'avance
         ne dirait rien, le fond de la carte étant lui-même bleuté. */
      const dodo = m => new Promise(r => setTimeout(r, m));
      const cru = (la, lo) => {
        const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
        const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
        return `${d[0]},${d[1]},${d[2]}`;
      };
      const merAvec = cru(44.0, -4.5);
      document.getElementById("caSansNappe").click(); await dodo(500);
      const merSans = cru(44.0, -4.5);
      const terreSans = cru(43.6, 1.4);
      document.getElementById("caTemp").click(); await dodo(700);
      if (merAvec !== merSans) return `la nappe déborde en mer : ${merAvec} contre ${merSans}`;
      return terreSans === cru(43.6, 1.4) ? "la nappe ne change rien sur terre" : "";
    });
  ok("la nappe étale la valeur de ses points", nappeDit === "", nappeDit);

  ok("la mention de la source paraît avec la nappe",
    await pgNap.evaluate(async () => {
      const c = document.getElementById("caCredit");
      const dodo = m => new Promise(r => setTimeout(r, m));
      const avec = /Température/.test(c.textContent)
        && c.querySelector('a[href*="open-meteo.com"]') !== null;
      document.getElementById("caSansNappe").click(); await dodo(300);
      const sans = !/Température/.test(c.textContent);
      document.getElementById("caTemp").click(); await dodo(600);
      if (!avec) return "la mention manque quand la nappe est allumée";
      return sans ? "" : "la mention reste quand la nappe est éteinte";
    }) === "");

  ok("la légende porte la rampe et ses graduations",
    await pgNap.evaluate(async () => {
      const l = document.getElementById("caLegende");
      const dodo = m => new Promise(r => setTimeout(r, m));
      if (l.hidden) return "la légende manque sous la nappe";
      const g = [...document.querySelectorAll("#caGrads span")].map(x => x.textContent);
      if (g.length < 3) return `${g.length} graduations`;
      if (!/°/.test(g[0])) return `graduation sans unité : ${g[0]}`;
      const fond = getComputedStyle(document.getElementById("caRampe")).backgroundImage;
      if (!/gradient/.test(fond)) return "la rampe n'est pas un dégradé";
      document.getElementById("caSansNappe").click(); await dodo(400);
      const partie = document.getElementById("caLegende").hidden;
      document.getElementById("caTemp").click(); await dodo(600);
      return partie ? "" : "la légende reste sans nappe";
    }) === "");

  /* Version 140 : la légende tient en deux lignes basses, le titre à côté de
     la rampe et les graduations dessous. Elle prenait le pied de la carte. */
  const legendeTaille = await pgNap.evaluate(() => {
    const l = document.getElementById("caLegende").getBoundingClientRect();
    const t = document.getElementById("caLegTitre").getBoundingClientRect();
    const r = document.getElementById("caRampe").getBoundingClientRect();
    return { h: Math.round(l.height), meme: Math.abs((t.top + t.bottom) / 2 - (r.top + r.bottom) / 2) < 8 };
  });
  ok("la légende de la nappe est basse, son titre sur la ligne de la rampe",
    legendeTaille.h > 0 && legendeTaille.h <= 38 && legendeTaille.meme, JSON.stringify(legendeTaille));

  /* Jalon 18, lot 1 : la nappe des restrictions d'eau. Elle teinte la Côte-d'Or,
     en crise, et laisse le Cantal, sans arrêté, tel qu'il est sans nappe ; sa
     légende nomme ses quatre classes et la mention cite VigiEau. */
  const restrictionsDit = await pgNap.evaluate(async () => {
    const C = await import("/src/carte.js");
    const cv = document.getElementById("caToile"), ctx = cv.getContext("2d");
    const dodo = m => new Promise(r => setTimeout(r, m));
    const cru = (la, lo) => {
      const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
      const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
      return `${d[0]},${d[1]},${d[2]}`;
    };
    document.getElementById("caSansNappe").click(); await dodo(500);
    const sans = { dijon: cru(47.25, 4.75), cantal: cru(45.05, 2.6) };
    document.getElementById("caEau").click(); await dodo(900);
    const avec = { dijon: cru(47.25, 4.75), cantal: cru(45.05, 2.6) };
    const r = { teinte: avec.dijon !== sans.dijon, cantal: avec.cantal === sans.cantal,
      titre: document.getElementById("caLegTitre").textContent,
      grads: [...document.querySelectorAll("#caGrads span")].map(x => x.textContent).join(" "),
      mention: !!document.querySelector('#caCredit a[href="https://vigieau.gouv.fr"]') };
    document.getElementById("caTemp").click(); await dodo(700);
    return r;
  });
  ok("la nappe des restrictions d'eau teinte les départements en restriction, et eux seuls",
    restrictionsDit.teinte && restrictionsDit.cantal && etat.appelsVigieau.length >= 1, JSON.stringify({ ...restrictionsDit, appels: etat.appelsVigieau.length }));
  /* Les deux classes extrêmes depuis la version 153 : les quatre ne tenaient
     pas sous la rampe. */
  ok("sa légende nomme les classes extrêmes, et la mention cite VigiEau",
    restrictionsDit.titre === "Restrictions d'eau, en vigueur" && restrictionsDit.grads === "Vigilance Crise" && restrictionsDit.mention,
    JSON.stringify(restrictionsDit));

  /* Jalon 18, lot 3 : les prévisions des villes sur la carte. Les étiquettes se
     posent sans se chevaucher, le sélecteur s'ouvre sur le moment en cours, et le
     lendemain donne le minimum et le maximum. */
  const previAvant = await pgNap.evaluate(() => document.getElementById("caPrevi")?.getAttribute("aria-checked"));
  if (previAvant !== "true") await pgNap.locator("#caPrevi").evaluate(b => b.click());
  await pgNap.waitForFunction(() => document.querySelectorAll(".ca-pv:not([hidden])").length > 0, null, { timeout: 8000 }).catch(() => {});
  const previsDit = await pgNap.evaluate(() => {
    const vis = [...document.querySelectorAll(".ca-pv:not([hidden])")];
    const r = vis.map(e => e.getBoundingClientRect());
    let chevauche = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
      if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) chevauche++;
    return { vus: vis.length, chevauche, paris: vis.find(e => e.title === "Paris")?.querySelector("b")?.textContent || "",
      moment: document.querySelector('#caMoments button[aria-pressed="true"]')?.dataset.moment || "",
      selecteur: !document.getElementById("caMoments").hidden,
      mention: /Prévisions Open-Meteo/.test(document.getElementById("caCredit")?.textContent || "") };
  });
  await pgNap.locator('#caMoments button[data-moment="demain"]').evaluate(b => b.click());
  await pgNap.waitForTimeout(300);
  const previsDemain = await pgNap.evaluate(() => [...document.querySelectorAll(".ca-pv:not([hidden])")].find(e => e.title === "Paris")?.querySelector("b")?.textContent || "");
  await pgNap.locator("#caPrevi").evaluate(b => b.click());
  await pgNap.waitForTimeout(300);
  const previsEteint = await pgNap.evaluate(() => ({ pv: document.querySelectorAll(".ca-pv").length, selecteur: !document.getElementById("caMoments").hidden }));
  ok("les prévisions des villes se posent sur la carte sans se chevaucher, au moment en cours",
    previsDit.vus >= 8 && previsDit.chevauche === 0 && previsDit.paris === "13°" && previsDit.moment === "matin" && previsDit.selecteur && previsDit.mention,
    JSON.stringify(previsDit));
  /* Jalon 18, lot 3 : la mer et la neige sur la carte, avec les prévisions aussi
     allumées. La neige et la mer passent d'abord ; un domaine sans neige ne porte
     pas d'étiquette ; aucune étiquette n'en chevauche une autre ; le sélecteur des
     moments se retire derrière le panneau ouvert. */
  for (const id of ["#caPrevi", "#caPlages", "#caNeige"]) {
    if (await pgNap.evaluate(i => document.querySelector(i)?.getAttribute("aria-checked"), id) !== "true") await pgNap.locator(id).evaluate(b => b.click());
  }
  await pgNap.waitForFunction(() => document.querySelectorAll(".ca-pv-mer:not([hidden])").length > 0
    && document.querySelectorAll(".ca-pv-neige").length > 0, null, { timeout: 8000 }).catch(() => {});
  const carteDit = await pgNap.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    const vis = [...document.querySelectorAll(".ca-pv:not([hidden])")];
    const r = vis.map(e => e.getBoundingClientRect());
    let chevauche = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++)
      if (r[i].left < r[j].right && r[j].left < r[i].right && r[i].top < r[j].bottom && r[j].top < r[i].bottom) chevauche++;
    const res = { mer: vis.filter(e => e.classList.contains("ca-pv-mer")).length, neige: vis.filter(e => e.classList.contains("ca-pv-neige")).length,
      zero: [...document.querySelectorAll(".ca-pv-neige")].some(e => /\b0 cm/.test(e.textContent)), chevauche,
      mention: /Stations OpenSkiMap/.test(document.getElementById("caCredit")?.textContent || "")
        && /Prévisions, mer, neige Open-Meteo/.test(document.getElementById("caCredit")?.textContent || "") };
    document.getElementById("caCouches").click(); await dodo(250);
    res.sousPanneau = getComputedStyle(document.getElementById("caMoments")).visibility === "hidden";
    document.getElementById("caCouches").click(); await dodo(200);
    return res;
  });
  for (const id of ["#caPlages", "#caNeige"]) await pgNap.locator(id).evaluate(b => b.click());
  await pgNap.waitForTimeout(200);
  ok("la mer et la neige se posent sur la carte avant les prévisions, sans chevauchement, sources citées",
    carteDit.mer >= 6 && carteDit.neige >= 1 && !carteDit.zero && carteDit.chevauche === 0 && carteDit.mention && carteDit.sousPanneau,
    JSON.stringify(carteDit));
  ok("le lendemain donne le minimum et le maximum, et l'interrupteur éteint retire tout",
    previsDemain === "10° 20°" && previsEteint.pv === 0 && !previsEteint.selecteur, JSON.stringify({ previsDemain, previsEteint }));

  /* La vigilance ne peut pas teinter le fond sous une nappe qui le couvre. Elle
     passe alors en liseré par-dessus : le bord du département porte la couleur du
     niveau, son intérieur garde celle de la nappe. */
  ok("la vigilance passe en liseré sous une nappe pleine",
    await pgNap.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      const C = await import("/src/carte.js");
      const G = await import("/src/geographie.js");
      const dodo = m => new Promise(r => setTimeout(r, m));
      await dodo(400);
      const vue = { lat: 46.4, lon: 2.2, z: 5.13 };
      const ecran = (la, lo) => C.surEcran(vue, la, lo, cv.clientWidth, cv.clientHeight);
      const px = p => ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
      /* Deux mesures, et la seconde est celle qui compte. Le bord de la Gironde,
         en vigilance rouge dans la charge, porte la couleur du niveau. Et
         l'intérieur du département garde la couleur de la nappe : il se compare à
         un point de même latitude en Dordogne, que rien ne signale, où la nappe
         vaut à peu de chose près la même valeur. Un remplissage passerait la
         première mesure, il ne passe pas la seconde. */
      const anneau = G.anneauxDe("33")[0];
      let borde = false;
      for (let i = 0; i < anneau.length; i += 2) {
        const d = px(ecran(anneau[i + 1], anneau[i]));
        if (d[0] > 150 && d[0] - d[2] > 70) { borde = true; break; }
      }
      if (!borde) return "aucun point du bord ne porte la couleur du niveau";
      const dedans = px(ecran(44.8, -0.6)), voisin = px(ecran(44.8, 0.6));
      const ecart = Math.abs(dedans[0] - voisin[0]) + Math.abs(dedans[1] - voisin[1])
        + Math.abs(dedans[2] - voisin[2]);
      return ecart < 24 ? ""
        : `l'intérieur du département ne porte pas la nappe, écart ${ecart}`;
    }) === "");

  /* Le choix se garde d'une visite à l'autre, comme celui de la pluie. */
  ok("le choix de nappe se garde",
    await pgNap.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      document.querySelector('[data-onglet="accueil"]').click(); await dodo(400);
      document.querySelector('[data-onglet="carte"]').click(); await dodo(900);
      const t = document.getElementById("caTemp").getAttribute("aria-checked");
      const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
      if (t !== "true") return "la température n'est pas rendue au retour";
      return r.nappe === "temp" ? "" : `réglage gardé : ${JSON.stringify(r.nappe)}`;
    }) === "");

  /* La grille se lit dans l'ordre demandé, du sud au nord et d'ouest en est, et
     l'interpolation rend la valeur d'un point quelconque. Hors de l'emprise, elle
     ne rend rien : une nappe qui prolongerait sa dernière valeur jusqu'au bord de
     la vue inventerait une donnée. */
  ok("la nappe interpole entre ses points et s'arrête à son emprise",
    await pgNap.evaluate(async () => {
      const N = await import("/src/nappe.js");
      const p = N.points();
      if (p.length !== N.COLS * N.RANGS) return `${p.length} points`;
      const champ = new Float32Array(p.length);
      for (let i = 0; i < p.length; i++) champ[i] = p[i][0];   // la latitude elle-même
      const m = N.valeurA(champ, 46.0, 2.0);
      if (Math.abs(m - 46.0) > 0.01) return `interpolation fausse : ${m}`;
      if (N.valeurA(champ, 60, 2) !== null) return "une valeur est rendue hors emprise";
      if (N.valeurA(champ, 46, 30) !== null) return "une valeur est rendue hors emprise";
      return "";
    }) === "");

  /* ---------- L'indice ultraviolet ----------

     Il se prend sur la journée, non sur l'instant. Mesuré le 7 septembre 2026 à
     23 h 15 sur les 380 points : l'indice du moment vaut zéro partout, quand le
     maximum du jour va de 0,95 à 6,7. Une nappe entièrement à zéro la moitié du
     temps n'apprend rien, et les quatre mesures de l'accueil appliquent déjà cette
     règle. */
  ok("la nappe d'indice ultraviolet retient la journée en cours",
    await pgNap.evaluate(async () => {
      const N = await import("/src/nappe.js");
      if (N.rangDuJour(["2026-08-17", "2026-08-18"], "2026-08-18") !== 1) return "la date du jour n'est pas trouvée";
      if (N.rangDuJour(["2026-08-17", "2026-08-18"], "2026-09-01") !== 0) return "une date absente ne retombe pas sur la première";
      /* La date locale est celle de l'appareil, non celle du temps universel : le
         service ignore le fuseau automatique sur une requête à plusieurs
         coordonnées, et la journée serait décalée de deux heures en été. */
      const t = new Date("2026-08-18T00:30:00+02:00");
      if (N.dateLocale(t) !== "2026-08-18") return `date locale ${N.dateLocale(t)}`;
      /* La lecture retient bien la valeur du jour : la charge d'essai porte 1 la
         veille et huit et quelques le jour même. */
      const faux = N.points().map(([la, lo]) => ({
        current: { time: "2026-08-18T09:00", temperature_2m: 20, wind_speed_10m: 10, wind_direction_10m: 200 },
        daily: { time: ["2026-08-17", "2026-08-18"], uv_index_max: [1, 8 - (la - 41) * 0.42] },
      }));
      const d = N.lire(faux, "2026-08-18");
      return d.uv[0] > 7 ? "" : `valeur retenue ${d.uv[0]}`;
    }) === "");

  ok("la grille demande la colonne de journée et deux journées",
    await pgNap.evaluate(async () => {
      const N = await import("/src/nappe.js");
      const u = new URL(N.adresse());
      const q = u.searchParams;
      if (q.get("daily") !== "uv_index_max") return `daily ${q.get("daily")}`;
      if (q.get("forecast_days") !== "2") return `forecast_days ${q.get("forecast_days")}`;
      /* L'indice n'est pas demandé deux fois : il a quitté les colonnes de
         l'instant en même temps qu'il entrait dans celles de la journée. */
      return /uv_index/.test(q.get("current")) ? "l'indice reste demandé sur l'instant" : "";
    }) === "");

  /* La charge d'essai fait descendre l'indice du sud au nord, comme la
     température, mais avec sa propre rampe : c'est bien la valeur d'UV qui est
     peinte, non celle qui était là avant. */
  const uvDit = await pgNap.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    document.getElementById("caCouches").click(); await dodo(200);
    document.getElementById("caUV").click(); await dodo(900);
    const cv = document.getElementById("caToile");
    const ctx = cv.getContext("2d");
    const C = await import("/src/carte.js");
    const teinte = (r, g, b) => {
      const [x, y, z] = [r, g, b].map(v => v / 255);
      const mx = Math.max(x, y, z), mn = Math.min(x, y, z), d = mx - mn;
      if (d < 1e-6) return null;
      let h = mx === x ? ((y - z) / d) % 6 : mx === y ? (z - x) / d + 2 : (x - y) / d + 4;
      h *= 60; if (h < 0) h += 360;
      return h;
    };
    /* L'écart brut entre le canal le plus fort et le plus faible, non la
       saturation au sens de HSL : celle-ci se divise par la clarté, si bien que
       la nappe composée à soixante-deux pour cent sur un fond clair rend deux
       valeurs très différentes à deux centièmes l'une de l'autre. L'écart brut
       suit ce que l'œil lit comme vivacité. */
    const vivacite = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
    const pixel = (la, lo) => {
      const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
      return ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
    };
    const lire = (la, lo) => { const d = pixel(la, lo); return teinte(d[0], d[1], d[2]); };
    if (document.getElementById("caTemp").getAttribute("aria-checked") !== "false") {
      return "la température reste marquée sous l'indice";
    }
    const sud = lire(43.6, 1.4), nord = lire(50.3, 3.0);
    if (sud === null || nord === null) return "un point du pays n'est pas teinté";
    /* La rampe monte du violet au fuchsia : plus l'indice est fort, plus la
       teinte est haute, l'inverse de l'échelle chaude qu'elle a remplacée. */
    if (!(sud > nord + 4)) {
      return `le sud n'est pas plus exposé : teintes ${sud.toFixed(0)} et ${nord.toFixed(0)}`;
    }
    /* L'ordre ne suffit pas à dire quelle rampe a servi : celle de la température
       décroît elle aussi. La teinte peinte est donc comparée à celle que la rampe
       de l'indice donne pour la valeur de la charge, laquelle descend de huit au
       sud du domaine à raison de 0,42 par degré de latitude. */
    const I = await import("/src/icones.js");
    for (const [la, teintePeinte] of [[43.6, sud], [50.3, nord]]) {
      const attendue = I.teinteUV(8 - (la - 41) * 0.42);
      if (Math.abs(teintePeinte - attendue) > 20) {
        return `teinte ${teintePeinte.toFixed(0)} là où la rampe de l'indice donne ${attendue.toFixed(0)}`;
      }
    }
    /* La rampe de l'indice monte en intensité, non en teinte seule : la nappe doit
       passer à la carte une saturation qui suit la valeur, sans quoi un indice
       faible et un indice fort se peignent aussi vifs l'un que l'autre. Une
       saturation fixe rendue à la carte passait inaperçue de toutes les autres
       gardes, épreuve 5 du 13 septembre 2026. */
    const ds = pixel(43.6, 1.4), dn = pixel(50.3, 3.0);
    const vSud = vivacite(ds[0], ds[1], ds[2]), vNord = vivacite(dn[0], dn[1], dn[2]);
    if (!(vSud > vNord + 15)) {
      return `la nappe ne monte pas en intensité : vivacités ${vSud} au sud et ${vNord} au nord`;
    }
    return "";
  });
  ok("la nappe d'indice ultraviolet teinte selon sa propre rampe", uvDit === "", uvDit);

  /* La rampe de l'indice, mesurée le 12 septembre 2026 : sur cinquante-quatre
     points de France et sept jours, l'indice va de 1,2 à 6,3 et ne dépasse pas 8.
     La rampe doit donc séparer les valeurs de cette plage, et le faire par
     l'intensité, la teinte ne parcourant que cinquante degrés de roue entre le
     violet et le fuchsia. */
  const rampeUV = await pgNap.evaluate(async () => {
    const I = await import("/src/icones.js");
    const lu = v => (I.couleurUV(v).match(/hsl\((\d+) (\d+)% (\d+)%/) || []).slice(1).map(Number);
    return { deux: lu(2), cinq: lu(5), cinqSix: [lu(5), lu(6)],
      plage: [I.teinteUV(0), I.teinteUV(9)],
      arrets: [...document.querySelectorAll("#caGrads span")].map(e => e.textContent) };
  });
  ok("la rampe de l'indice monte en intensité avec la valeur",
    rampeUV.cinq[1] > rampeUV.deux[1] + 10 && rampeUV.cinq[2] < rampeUV.deux[2] - 5,
    `à 2 ${rampeUV.deux.join("/")}, à 5 ${rampeUV.cinq.join("/")}`);

  ok("elle va du violet au fuchsia, sans traverser le vert ni le rouge",
    rampeUV.plage.every(h => h >= 245 && h <= 340),
    rampeUV.plage.map(h => h.toFixed(0)).join(" à "));

  /* Deux valeurs voisines de la plage française doivent se distinguer : c'est ce
     que des arrêts posés à 0, 3, 6, 8 puis 11 ne faisaient pas, la France entière
     tombant dans le premier intervalle. */
  ok("la légende porte les arrêts de la plage utile, non ceux de l'échelle entière",
    rampeUV.arrets.join(" ") === "0 2 4 6 8", rampeUV.arrets.join(" "));

  /* Un jour donné, l'essentiel du pays se tient entre 5 et 6 : c'est là que la
     rampe doit séparer, faute de quoi la carte paraît unie. Le premier réglage
     n'y mettait que six degrés de roue et deux centièmes de clarté. */
  ok("elle sépare les valeurs où se serre le pays, de 5 à 6",
    (() => {
      const [a, b] = rampeUV.cinqSix;
      return (b[0] - a[0]) >= 12 && (a[2] - b[2]) >= 6;
    })(), rampeUV.cinqSix.map(c => c.join("/")).join(" puis "));

  ok("la légende dit sur quoi la nappe porte",
    await pgNap.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      const t = () => document.getElementById("caLegTitre").textContent;
      const uv = t();
      if (!/maximum du jour/.test(uv)) return `légende de l'indice : ${uv}`;
      document.getElementById("caTemp").click(); await dodo(900);
      const temp = t();
      if (!/maintenant/.test(temp)) return `légende de la température : ${temp}`;
      /* Les graduations suivent la nappe : celles de l'indice sont les seuils de
         l'Organisation mondiale de la santé, celles de la température des degrés. */
      const g = [...document.querySelectorAll("#caGrads span")].map(x => x.textContent);
      return g.some(x => /°/.test(x)) ? "" : `graduations ${g.join(", ")}`;
    }) === "");

  /* La grille est gardée un quart d'heure, la cadence du produit. Les bascules des
     contrôles précédents ont éteint et rallumé la nappe plusieurs fois : aucune
     n'a redemandé la grille. */
  ok("rallumer la nappe ne redemande pas la grille",
    etat.appelsGrille.length === 1, `${etat.appelsGrille.length} appels`);

  /* ---------- La qualité de l'air sur la carte ----------

     Quatrième nappe, et la première qui vienne d'un autre service : les analyses
     européennes de Copernicus, sur les mêmes points que celle de la prévision.
     Elle a donc sa lecture, sa garde et sa mention.

     La charge d'essai fait monter l'indice du sud au nord, l'inverse de la
     température et de l'indice ultraviolet : une nappe peinte avec la mauvaise
     grille se voit à sa pente avant même de comparer les teintes. */
  ok("la grille de l'air n'est pas demandée tant que sa nappe ne l'est pas",
    etat.appelsGrilleAir.length === 0, `${etat.appelsGrilleAir.length} appels`);

  const airCarteDit = await pgNap.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    document.getElementById("caAir").click(); await dodo(1200);
    const cv = document.getElementById("caToile");
    const ctx = cv.getContext("2d");
    const C = await import("/src/carte.js");
    const teinte = (r, g, b) => {
      const [x, y, z] = [r, g, b].map(v => v / 255);
      const mx = Math.max(x, y, z), mn = Math.min(x, y, z), d = mx - mn;
      if (d < 1e-6) return null;
      let h = mx === x ? ((y - z) / d) % 6 : mx === y ? (z - x) / d + 2 : (x - y) / d + 4;
      h *= 60; if (h < 0) h += 360;
      return h;
    };
    const lire = (la, lo) => {
      const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
      const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
      return teinte(d[0], d[1], d[2]);
    };
    if (document.getElementById("caTemp").getAttribute("aria-checked") !== "false") {
      return "la température reste marquée sous l'air";
    }
    const sud = lire(43.6, 1.4), nord = lire(50.3, 3.0);
    if (sud === null || nord === null) return "un point du pays n'est pas teinté";
    /* L'indice monte vers le nord dans la charge : la teinte y descend vers le
       rouge. Les deux autres nappes vont dans l'autre sens. */
    if (!(nord < sud - 20)) {
      return `le nord n'est pas plus chargé : teintes ${sud.toFixed(0)} et ${nord.toFixed(0)}`;
    }
    const I = await import("/src/icones.js");
    for (const [la, peinte] of [[43.6, sud], [50.3, nord]]) {
      const attendue = I.teinteAQI(Math.round(8 + (la - 41) * 4.2));
      if (Math.abs(peinte - attendue) > 20) {
        return `teinte ${peinte.toFixed(0)} là où la rampe de l'air donne ${attendue.toFixed(0)}`;
      }
    }
    return "";
  });
  ok("la nappe de la qualité de l'air teinte selon sa propre rampe",
    airCarteDit === "", airCarteDit);

  /* La tuile dit « Air », la légende dit « Qualité de l'air » : le nom court
     n'est que pour tenir dans une tuile de trois par rangée. */
  ok("la légende garde le nom entier quand la tuile porte le court",
    await pgNap.evaluate(() => {
      const tuile = document.querySelector("#caAir span").textContent.trim();
      const leg = document.getElementById("caLegTitre").textContent.trim();
      if (tuile !== "Air") return `tuile « ${tuile} »`;
      if (!/^Qualité de l'air, /.test(leg)) return `légende « ${leg} »`;
      return "";
    }) === "");

  /* Elle vit sur son propre service : allumer cette nappe ne redemande pas la
     grille de la prévision. Et sa grille à elle est gardée trois heures, la
     cadence des analyses : la quitter et y revenir ne la redemande pas.

     La première écriture de cette garde comptait les appels après un seul
     allumage. Rien ne l'aurait fait tomber, la garde de mémoire n'étant jamais
     sollicitée : elle éteint donc la nappe, en choisit une autre, puis revient. */
  await pgNap.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    document.getElementById("caSansNappe").click(); await dodo(300);
    document.getElementById("caTemp").click(); await dodo(600);
    /* Quitter la carte et y revenir : la vue se rebâtit et perd sa grille, seule
       la garde du module empêche alors une seconde lecture. Rallumer la nappe
       sans partir ne l'éprouverait pas, la vue gardant sa lecture pour elle. */
    document.querySelector('[data-onglet="accueil"]').click(); await dodo(400);
    document.querySelector('[data-onglet="carte"]').click(); await dodo(900);
    document.getElementById("caCouches").click(); await dodo(200);
    document.getElementById("caAir").click(); await dodo(900);
  });
  ok("la nappe d'air lit sa grille et non celle de la prévision",
    etat.appelsGrilleAir.length === 1 && etat.appelsGrille.length === 1,
    `air ${etat.appelsGrilleAir.length}, prévision ${etat.appelsGrille.length}`);

  ok("l'adresse de la grille d'air demande l'indice européen sur tous les points",
    await pgNap.evaluate(async () => {
      const N = await import("/src/nappe.js");
      const u = new URL(N.adresseAir());
      if (!/air-quality-api/.test(u.hostname)) return `hôte ${u.hostname}`;
      const q = u.searchParams;
      if (q.get("current") !== "european_aqi") return `current ${q.get("current")}`;
      if (q.get("hourly")) return "des heures sont demandées";
      const n = decodeURIComponent(q.get("latitude")).split(",").length;
      return n === N.points().length ? "" : `${n} points`;
    }) === "");

  /* La source propre se nomme, et ne se fond pas avec celle du vent : deux
     services différents sous une seule mention diraient l'un pour l'autre. */
  /* Les tuiles de l'indice officiel se posent par-dessus l'interpolation de
     Copernicus : celle-ci couvre l'Europe, celles-là séparent bien mieux les
     zones sur la France. Mesuré le 14 septembre 2026 sur cinq villes, l'indice
     officiel prenait les valeurs 2, 3, 3, 3 et 4 quand l'indice européen restait
     entre 25 et 34, soit une seule classe. */
  ok("les tuiles de l'indice officiel se demandent avec la nappe",
    etat.appelsAirTuiles.length > 0
    && etat.appelsAirTuiles.every(u => /layers=ind%3Aind_atmo_tile|layers=ind:ind_atmo_tile/.test(u)),
    `${etat.appelsAirTuiles.length} tuiles`);

  /* Et elles se posent : servies pleines, elles doivent couvrir l'interpolation,
     dont la teinte varie du nord au sud quand la leur est unie. */
  ok("et elles se posent par-dessus l'interpolation",
    await (async () => {
      etat.airTuilesPleines = true;
      const [ctxAt, pgAt] = await ouvrirCarte({ ...FAIN, nappe: "air", pluiecarte: false }, 0);
      /* Une pause fixe : la toile lue ensuite change sans toucher au document, et
         l'attente du repos rendait la main avant qu'elle soit peinte. */
      await pgAt.waitForTimeout(1400);
      const dit = await pgAt.evaluate(async () => {
        const C = await import("/src/carte.js");
        const cv = document.getElementById("caToile");
        const ctx = cv.getContext("2d");
        const lu = (la, lo) => {
          const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
          return [...ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data].slice(0, 3);
        };
        const jaune = c => c[0] > 200 && c[1] > 190 && c[2] < 140;
        const pts = [lu(43.6, 1.4), lu(50.3, 3.0), lu(46.4, 2.2)];
        return pts.filter(jaune).length >= 2 ? "" : JSON.stringify(pts);
      });
      await ctxAt.close();
      etat.airTuilesPleines = false;
      return dit;
    })() === "");

  /* Sans date, le service rend son pas par défaut, à deux jours dans le futur et
     moins couvrant : 2868 points peints contre 5027 pour le jour même. */
  ok("chaque tuile de l'indice porte sa date",
    etat.appelsAirTuiles.length > 0
    && etat.appelsAirTuiles.every(u => /[?&]time=\d{4}-\d\d-\d\d/.test(u)),
    etat.appelsAirTuiles.find(u => !/[?&]time=/.test(u)) || "toutes datées");

  ok("elles se demandent en projection de Mercator",
    etat.appelsAirTuiles.every(u => /crs=EPSG:3857/.test(u)),
    etat.appelsAirTuiles[0] || "aucune tuile");

  ok("la nappe d'air nomme sa source, le vent gardant la sienne",
    await pgNap.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      const c = document.getElementById("caCredit");
      if (!/Copernicus/.test(c.textContent)) return `mention ${c.textContent}`;
      if (/Qualité de l'air <a/.test(c.innerHTML)) return "la nappe d'air renvoie à Open-Meteo";
      document.getElementById("caVent").click(); await dodo(600);
      const deux = c.textContent;
      document.getElementById("caVent").click(); await dodo(300);
      if (!/Copernicus/.test(deux)) return `avec le vent : ${deux}`;
      return /Vent/.test(deux) ? "" : `le vent ne se nomme pas : ${deux}`;
    }) === "");

  ok("la légende de l'air porte les bornes des niveaux européens",
    await pgNap.evaluate(async () => {
      const t = document.getElementById("caLegTitre").textContent;
      if (!/Qualité de l'air, maintenant/.test(t)) return `titre ${t}`;
      const g = [...document.querySelectorAll("#caGrads span")].map(x => x.textContent);
      return g.join(",") === "0,20,40,60,80" ? "" : `graduations ${g.join(", ")}`;
    }) === "");

  /* Le choix se garde comme les trois autres. */
  ok("le choix de la nappe d'air se garde d'une visite à l'autre",
    await pgNap.evaluate(async () => {
      const R = await import("/src/reglages.js");
      return R.nappe() === "air" ? "" : `réglage ${R.nappe()}`;
    }) === "");

  /* Jalon 18, lot 3 : les cours d'eau sur la carte. Sur la France entière, aucune
     lecture, et l'invitation à zoomer ; à l'échelle du département, une lecture de
     la zone visible et les trois stations, chacune avec sa hauteur et sa
     tendance. Dernier contrôle de la page : il déplace la vue. */
  const rivAvant = etat.appelsHubeau.filter(u => u.includes("observations_tr?bbox=")).length;
  await pgNap.locator("#caRivieres").evaluate(b => b.click());
  await reposer(pgNap, 2250);
  const rivFrance = { lectures: etat.appelsHubeau.filter(u => u.includes("observations_tr?bbox=")).length - rivAvant,
    mot: await pgNap.evaluate(() => document.getElementById("caMot")?.textContent || "") };
  await pgNap.locator("#caIci").evaluate(b => b.click());
  await pgNap.waitForTimeout(500);
  for (let k = 0; k < 4; k++) { await pgNap.locator("#caToile").press("+"); await pgNap.waitForTimeout(300); }
  await pgNap.waitForFunction(() => document.querySelectorAll(".ca-pv-riv:not([hidden])").length === 3, null, { timeout: 8000 }).catch(() => {});
  const rivZoom = await pgNap.evaluate(() => [...document.querySelectorAll(".ca-pv-riv:not([hidden])")].map(e => `${e.textContent}`
    + (e.querySelector(".ca-t-haut") ? " haut" : e.querySelector(".ca-t-bas") ? " bas" : "")).sort().join(" | "));
  const rivMention = await pgNap.evaluate(() => /Cours d'eau Hub'eau/.test(document.getElementById("caCredit")?.textContent || ""));
  await pgNap.locator("#caRivieres").evaluate(b => b.click());
  ok("les cours d'eau ne se lisent qu'en zoomant, et chaque station dit sa hauteur et sa tendance",
    rivFrance.lectures === 0 && /Zoomez/.test(rivFrance.mot)
    && rivZoom === "0,31 m | 0,47 m bas | 0,84 m haut" && rivMention, JSON.stringify({ rivFrance, rivZoom, rivMention }));

  await ctxNap.close();

  /* Une carte qui s'ouvre sur la nappe d'air la peint sans qu'on y touche. Le
     premier tracé lit les sources des couches allumées, et cette lecture-là est
     la sienne : le défaut a existé, la nappe restant vide jusqu'à ce qu'on
     rouvre le panneau, et aucune garde ne le voyait puisque toutes finissaient
     par appuyer sur son bouton. */
  etat.appelsGrilleAir.length = 0;
  const [ctxAirDepart, pgAirDepart] = await ouvrirCarte({ ...FAIN, nappe: "air" }, 0);
  ok("une carte qui s'ouvre sur la nappe d'air la peint d'elle-même",
    await pgAirDepart.evaluate(async () => {
      const cv = document.getElementById("caToile");
      const C = await import("/src/carte.js");
      const ctx = cv.getContext("2d");
      const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, 46.8, 2.4,
        cv.clientWidth, cv.clientHeight);
      const d = ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data;
      const ecart = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]);
      return ecart > 12 ? "" : `le centre du pays reste gris, écart ${ecart}`;
    }) === "");
  ok("elle ne lit sa grille qu'une fois en s'ouvrant",
    etat.appelsGrilleAir.length === 1, `${etat.appelsGrilleAir.length} appels`);
  await ctxAirDepart.close();

  /* Un réglage écrit par la version d'avant ne porte qu'un booléen de pluie. Il se
     reprend : pluie éteinte veut dire aucune nappe. */
  etat.appelsGrille.length = 0;
  etat.appelsGrilleAir.length = 0;
  const [ctxAncienRadar, pgAncienRadar] = await ouvrirCarte({ ...FAIN, radar: false }, 0);
  ok("un ancien réglage de pluie se reprend en choix de nappe",
    await pgAncienRadar.evaluate(() =>
      document.getElementById("caPluie").getAttribute("aria-checked") === "false"
      && document.getElementById("caSansNappe").getAttribute("aria-checked") === "true"));
  await ctxAncienRadar.close();

  /* Le réglage de la version d'ensuite écrivait `nappe: "pluie"`. Il se reprend
     aussi : la pluie s'allume et la nappe reste absente. */
  const [ctxAncienNappe, pgAncienNappe] = await ouvrirCarte({ ...FAIN, nappe: "pluie" }, 0);
  ok("un réglage qui nommait la pluie comme nappe se reprend en superposition",
    await pgAncienNappe.evaluate(() =>
      document.getElementById("caPluie").getAttribute("aria-checked") === "true"
      && document.getElementById("caSansNappe").getAttribute("aria-checked") === "true"));
  await ctxAncienNappe.close();

  /* ---------- La foudre sur la carte ----------

     L'imageur de foudre du Meteosat de troisième génération, servi par
     EUMETSAT en tuiles de Mercator. Le contrat, relevé sur les adresses émises :
     le dernier pas publié et non l'heure courante, six pas de cinq minutes posés
     l'un sur l'autre, des tuiles bornées au zoom six, rien tant que la couche est
     éteinte, et la chronologie de la pluie qui entraîne la foudre. */
  etat.appelsFoudre.length = 0;
  etat.foudreTeinte = true;
  const [ctxFou, pgFou] = await ouvrirCarte(FAIN, 0);
  const tempsFoudre = () => etat.appelsFoudre
    .filter(u => /request=GetMap/i.test(u))
    .map(u => Date.parse(decodeURIComponent(/[?&]time=([^&]+)/.exec(u)[1])));
  const pasFoudre = () => [...new Set(tempsFoudre())].sort((a, b) => a - b);
  /* Le message d'une garde ne doit pas faire tomber la suite : sans tuile
     demandée, `Math.max` rend moins l'infini et la mise en forme de l'heure
     lève. Le cas arrive dès que la couche ne peint plus, ce qu'une garde
     voisine éprouve. */
  const dernierPasDit = () => {
    const p = pasFoudre();
    return p.length ? heureService(Math.max(...p)) : "aucune tuile demandée";
  };

  ok("la foudre est allumée au départ, comme la vigilance",
    await pgFou.evaluate(() =>
      document.getElementById("caFoudre").getAttribute("aria-checked") === "true"));

  ok("elle lit les capacités de la couche seule, non celles du service entier",
    etat.appelsFoudre.some(u => /\/geoserver\/mtg_fd\/li_afa\/ows\?.*GetCapabilities/i.test(u))
    && !etat.appelsFoudre.some(u => /\/geoserver\/ows\?.*GetCapabilities/i.test(u)),
    etat.appelsFoudre.filter(u => /GetCapabilities/i.test(u)).join(" "));

  ok("elle demande le dernier pas publié et non l'heure courante",
    pasFoudre().length > 0 && Math.max(...pasFoudre()) === FOUDRE_DERNIER,
    `dernier demandé ${dernierPasDit()}, publié ${heureService(FOUDRE_DERNIER)}`);

  ok("elle pose six pas de cinq minutes, trente minutes de foudre",
    (() => {
      const p = pasFoudre();
      if (p.length !== 6) return false;
      for (let k = 1; k < 6; k++) if (p[k] - p[k - 1] !== FOUDRE_PAS) return false;
      return true;
    })(), pasFoudre().map(heureService).join(" "));

  /* Cinq points au cœur de grands départements, loin des limites et de leur
     gaine : Landes, Gironde, Marne, Allier, Aveyron. Un trait peut en effleurer
     un, non quatre. */
  const foudrePeinte = await pgFou.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    await dodo(600);
    const cv = document.getElementById("caToile");
    const C = await import("/src/carte.js");
    const ctx = cv.getContext("2d");
    const lieux = [[44.0, -0.9], [44.9, -0.6], [48.9, 4.2], [46.4, 3.2], [44.3, 2.6]];
    const lus = lieux.map(([la, lo]) => {
      const p = C.surEcran({ lat: 46.4, lon: 2.2, z: 5.13 }, la, lo, cv.clientWidth, cv.clientHeight);
      return [...ctx.getImageData(Math.round(p.x * 2), Math.round(p.y * 2), 1, 1).data].slice(0, 3);
    });
    return { rouges: lus.filter(d => d[0] > 180 && d[1] < 80 && d[2] < 80).length, lus };
  });
  ok("le pas le plus récent est peint par-dessus les autres",
    foudrePeinte.rouges >= 4, JSON.stringify(foudrePeinte.lus));

  ok("les tuiles se demandent en projection de Mercator, au pas de temps du service",
    etat.appelsFoudre.filter(u => /GetMap/i.test(u)).every(u =>
      /crs=EPSG:3857/.test(u) && /layers=mtg_fd:li_afa/.test(u)
      && /width=256&height=256/.test(u) && /time=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/.test(u)),
    etat.appelsFoudre.find(u => /GetMap/i.test(u)) || "aucune tuile");

  /* Le pixel de la source fait deux kilomètres, ce qu'une tuile du zoom six porte
     déjà : au delà, la tuile s'agrandit au lieu de se redemander. La largeur
     d'une tuile du zoom six est le tour du monde divisé par soixante-quatre. */
  etat.appelsFoudre.length = 0;
  await pgFou.locator("#caToile").press("+"); await pgFou.waitForTimeout(150);
  await pgFou.locator("#caToile").press("+"); await pgFou.waitForTimeout(150);
  await pgFou.locator("#caToile").press("+"); await pgFou.waitForTimeout(600);
  ok("les tuiles de foudre s'arrêtent au zoom six",
    (() => {
      const u = etat.appelsFoudre.filter(x => /GetMap/i.test(x));
      if (!u.length) return false;
      const tour = 2 * Math.PI * 6378137;
      return u.every(x => {
        const b = /bbox=([^&]+)/.exec(x)[1].split(",").map(Number);
        return Math.abs((b[2] - b[0]) - tour / 64) < 1;
      });
    })(), etat.appelsFoudre.find(x => /GetMap/i.test(x)) || "aucune tuile au zoom huit");

  ok("la mention nomme EUMETSAT tant que la foudre est allumée",
    await pgFou.evaluate(() => {
      const c = document.getElementById("caCredit");
      return /Foudre/.test(c.textContent) && c.querySelector('a[href*="eumetsat.int"]') !== null;
    }));

  ok("la légende de la foudre paraît avec la couche",
    await pgFou.evaluate(() => !document.getElementById("caLegFoudre").hidden));

  /* La chronologie de la pluie entraîne la foudre : une image de pluie plus
     ancienne montre la foudre de son heure, au pas de cinq minutes le plus
     proche, jamais au delà du dernier pas publié. */
  etat.appelsFoudre.length = 0;
  const foudreEntrainee = await pgFou.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    const p = document.getElementById("caPiste");
    p.focus();
    for (let k = 0; k < 6; k++) {
      p.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    }
    await dodo(500);
    const F = await import("/src/foudre.js");
    return { image: Number(document.getElementById("caPiste").getAttribute("aria-valuenow")),
      PAS: F.PAS };
  });
  ok("la chronologie de la pluie entraîne la foudre au pas le plus proche",
    (() => {
      const p = pasFoudre();
      if (!p.length) return false;
      /* Six images en arrière : soixante minutes avant la dernière observée,
         laquelle porte l'heure figée arrondie à la dizaine. */
      const image = Math.floor(FIGE / 600000) * 600000 - 6 * 600000;
      const attendu = Math.min(Math.round(image / FOUDRE_PAS) * FOUDRE_PAS, FOUDRE_DERNIER);
      return Math.max(...p) === attendu;
    })(), `demandé jusqu'à ${dernierPasDit()}, image ${foudreEntrainee.image}`);

  /* L'interrupteur. Éteinte, la couche ne peint plus, la mention et la légende
     la quittent, et une carte qui s'ouvre éteinte ne demande rien au service. */
  const foudreEteinte = await pgFou.evaluate(async () => {
    const dodo = m => new Promise(r => setTimeout(r, m));
    document.getElementById("caCouches").click(); await dodo(200);
    document.getElementById("caFoudre").click(); await dodo(400);
    const c = document.getElementById("caCredit");
    return {
      coche: document.getElementById("caFoudre").getAttribute("aria-checked"),
      mention: /Foudre/.test(c.textContent),
      legende: !document.getElementById("caLegFoudre").hidden,
    };
  });
  ok("la foudre éteinte quitte la mention et la légende",
    foudreEteinte.coche === "false" && !foudreEteinte.mention && !foudreEteinte.legende,
    JSON.stringify(foudreEteinte));
  await ctxFou.close();
  etat.foudreTeinte = false;

  etat.appelsFoudre.length = 0;
  const [ctxFouOff, pgFouOff] = await ouvrirCarte({ ...FAIN, foudrecarte: false }, 0);
  await pgFouOff.waitForTimeout(400);
  ok("une carte qui s'ouvre la foudre éteinte ne demande rien au service",
    etat.appelsFoudre.length === 0, `${etat.appelsFoudre.length} appels`);
  ok("et son réglage est retenu d'une ouverture à l'autre",
    await pgFouOff.evaluate(() =>
      document.getElementById("caFoudre").getAttribute("aria-checked") === "false"));
  await ctxFouOff.close();

  /* ---------- Les nuages sur la carte ----------

     L'imagerie infrarouge du Meteosat de troisième génération. Elle est retenue
     parce qu'elle voit la nuit, ce que le visible ne fait pas : mesuré à deux
     heures du matin, le visible rend une image noire. La tuile arrive opaque et
     se rend transparente à son arrivée, faute de quoi elle couvrirait la carte. */
  etat.appelsNuages.length = 0;
  const [ctxNu, pgNu] = await ouvrirCarte({ ...FAIN, nuagescarte: true }, 0);
  await pgNu.waitForTimeout(700);

  ok("les nuages sont éteints au départ, sauf réglage contraire",
    await pgNu.evaluate(() => {
      const r = JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}");
      return r.nuagescarte === true;
    }));

  ok("la couche demande le dernier pas publié, au pas de dix minutes",
    (() => {
      const t = etat.appelsNuages.filter(u => /GetMap/i.test(u))
        .map(u => Date.parse(decodeURIComponent(/[?&]time=([^&]+)/.exec(u)[1])));
      return t.length > 0 && t.every(x => x === NUAGES_DERNIER);
    })(), etat.appelsNuages.filter(u => /GetMap/i.test(u)).length + " tuiles");

  ok("elle lit les capacités de la couche seule",
    etat.appelsNuages.some(u => /mtg_fd\/ir105_hrfi\/ows\?.*GetCapabilities/i.test(u)));

  /* Le contrat de la mise en transparence, éprouvé sur la tuile même : le ciel
     dégagé, sombre en infrarouge, doit disparaître, et le sommet du nuage, clair,
     rester. Une tuile posée telle quelle couvrirait la carte entière. */
  const nuTransp = await pgNu.evaluate(async () => {
    const N = await import("/src/nuages.js");
    const d = new Uint8ClampedArray([30, 30, 30, 255, 230, 230, 230, 255, 140, 140, 140, 255]);
    N.transparence(d);
    return [d[3], d[7], d[11]];
  });
  ok("le ciel dégagé s'efface et le nuage reste",
    nuTransp[0] === 0 && nuTransp[1] === 255 && nuTransp[2] > 100 && nuTransp[2] < 255,
    nuTransp.join(" / "));

  /* La tuile d'imagerie est grise, le fond de carte est teinté : si la couche
     était posée opaque, la vue entière deviendrait neutre. Un point unique ne
     suffit pas à le dire, sa place dans la tuile n'étant pas garantie ; la
     mesure se fait sur une grille. */
  ok("la carte laisse voir son fond là où le ciel est dégagé",
    await pgNu.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      /* Sans cette mise à nu, la nappe de pluie couvre la vue par-dessus les
         nuages et la mesure ne dirait rien de la couche éprouvée. */
      document.getElementById("caCouches").click(); await dodo(200);
      document.getElementById("caSansNappe").click(); await dodo(700);
      document.getElementById("caCouches").click(); await dodo(200);
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      let teintes = 0, vus = 0;
      for (let y = 40; y < cv.height - 40; y += 40) {
        for (let x = 40; x < cv.width - 40; x += 40) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          vus++;
          if (Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) > 8) teintes++;
        }
      }
      return vus > 20 && teintes / vus > 0.25 ? "" : `${teintes} teintés sur ${vus}`;
    }) === "");

  /* Les deux couches du même service se disent d'un seul tenant, « Foudre et
     nuages », d'où la lecture sans égard à la casse. */
  ok("la mention nomme EUMETSAT tant que les nuages sont allumés",
    await pgNu.evaluate(() => {
      const c = document.getElementById("caCredit");
      return /nuages/i.test(c.textContent)
        && c.querySelector('a[href*="eumetsat.int"]') !== null;
    }));

  /* Les nuages se posent sous la pluie : la pluie tombe de la masse nuageuse et
     doit rester lisible par-dessus elle. La pluie de la charge est colorée et
     couvre la vue ; le sommet du nuage est un gris clair et neutre. Posée
     par-dessus, la couche de nuages blanchirait la moitié de la vue, celle où sa
     tuile est opaque. La mesure compte donc les points gris clairs : trois points
     ne suffisaient pas, la tuile laissant passer la couleur là où le ciel est
     dégagé. */
  ok("les nuages se posent sous la pluie, non par-dessus",
    await pgNu.evaluate(async () => {
      const dodo = m => new Promise(r => setTimeout(r, m));
      /* La pluie est allumée au départ et sa tuile est un interrupteur : la
         toucher l'éteindrait. Le panneau se referme pour dégager la vue. */
      document.getElementById("caCouches").click(); await dodo(200);
      document.getElementById("caToile").dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true }));
      await dodo(900);
      const cv = document.getElementById("caToile");
      const ctx = cv.getContext("2d");
      let gris = 0, vus = 0;
      for (let y = 40; y < cv.height - 40; y += 30) {
        for (let x = 40; x < cv.width - 40; x += 30) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          vus++;
          const neutre = Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) < 12;
          if (neutre && (d[0] + d[1] + d[2]) / 3 > 170) gris++;
        }
      }
      return vus > 20 && gris / vus < 0.12 ? "" : `${gris} gris clairs sur ${vus}`;
    }) === "");
  await ctxNu.close();

  etat.appelsNuages.length = 0;
  const [ctxNuOff, pgNuOff] = await ouvrirCarte(FAIN, 0);
  await pgNuOff.waitForTimeout(500);
  ok("une carte qui s'ouvre les nuages éteints ne demande rien au service",
    etat.appelsNuages.length === 0, `${etat.appelsNuages.length} appels`);
  await ctxNuOff.close();

  /* ---------- Le ciel étoilé, les calculs ----------

     Le module place les étoiles et les figures des constellations sur la voûte
     telle qu'on la voit depuis la commune. Les positions se vérifient contre le
     ciel réel : le 20 septembre 2026 à vingt-deux heures depuis Paris, le
     triangle d'été est au sud et la Grande Ourse au nord. */
};
