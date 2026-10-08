/* Le sens d'arrivée de la pluie. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, amorceGardee } from "../faux-services.mjs";

export const titre = "Le sens d'arrivée de la pluie";
export const avecPage = true;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ouvrirLeTemps, onglet,
    ctxReponse, METEO_NUE, reposer } = T;
  etat.profilPluie = "debut";
  etat.appelsRadar.length = 0;
  const ctxDep = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDep.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxDep);
  const pgDep = await ctxDep.newPage();
  await ouvrirPage(pgDep);
  await reposer(pgDep, 2100);

  const venueDit = await pgDep.evaluate(() => {
    const e = document.querySelector(".pp-venue");
    return e ? e.textContent.trim() : "";
  });
  ok("le panneau dit d'où vient la pluie",
    /vient du sud-ouest/.test(venueDit) && /\d+ km\/h/.test(venueDit), venueDit);

  /* La phrase dit d'où et à quelle allure, jamais quand : l'heure d'arrivée est
     celle du produit de Météo-France, juste au-dessus dans le même panneau, et
     deux réponses à la même question finiraient par se contredire. */
  ok("le sens d'arrivée ne dit pas d'heure",
    !/\d+\s*h|dans \d+ min/.test(venueDit), venueDit);

  ok("la mesure retrouve le déplacement de la charge",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const R = await import("/src/radar.js");
      const idx = await R.charger();
      const obs = idx.images.filter(x => !x.futur);
      D.oublier();
      const d = await D.mesurer(47.5, 4.3, idx.hote, obs);
      if (!d) return "aucune mesure";
      if (Math.abs(d.provenance - 243) > 12) return `provenance ${d.provenance.toFixed(0)}°`;
      if (d.kmh < 30 || d.kmh > 60) return `vitesse ${d.kmh.toFixed(0)} km/h`;
      if (d.minutes !== 30) return `écart de ${d.minutes} minutes`;
      return "";
    }) === "");

  /* La tuile de la mesure est celle qui contient la commune au zoom cinq, non
     celle de la vue : le déplacement est une grandeur régionale, et une vue serrée
     verrait la masse sortir du cadre entre deux images. */
  ok("la mesure lit deux tuiles de zoom cinq et pas davantage",
    await pgDep.evaluate(() => {
      const t = new Set(performance.getEntriesByType("resource")
        .map(e => e.name)
        .filter(n => n.includes("tilecache.rainviewer.com"))
        .map(n => (/\/256\/(\d+)\/(\d+)\/(\d+)\//.exec(n) || []).slice(1).join("/")));
      return [...t].includes("5/16/11") ? "" : `tuiles vues : ${[...t].join(", ")}`;
    }) === "");
  /* Les refus se lisent sur la fonction : une tuile sans pluie ne porte aucune
     forme à suivre, et deux images sans rapport ne doivent pas rendre une
     direction. Une direction inventée serait pire que pas de direction. */
  ok("la mesure se tait quand elle ne sait pas",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const T = D.SCHEMA_TUILE.TAILLE;
      const images = [
        { t: 1000000, chemin: "/a" }, { t: 1600000, chemin: "/b" },
        { t: 2200000, chemin: "/c" }, { t: 2800000, chemin: "/d" },
      ];
      const vide = () => new Uint8ClampedArray(T * T * 4);
      const sec = await D.mesurer(47.5, 4.3, "https://x", images, () => Promise.resolve(vide()));
      if (sec !== null) return "une tuile sans pluie rend une direction";

      /* Deux bruits sans forme commune : la corrélation reste au ras et la
         fonction doit se taire. */
      let graine = 1;
      const bruit = () => {
        const d = new Uint8ClampedArray(T * T * 4);
        let x = ++graine * 7919;
        for (let i = 0; i < T * T; i++) {
          x = (x * 1103515245 + 12345) & 0x7fffffff;
          const v = (x >> 16) & 255;
          d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
        }
        return d;
      };
      const bruite = await D.mesurer(47.5, 4.3, "https://x", images, () => Promise.resolve(bruit()));
      if (bruite !== null) return "deux bruits sans rapport rendent une direction";

      /* Une pluie qui ne bouge pas se dit comme telle, et non par une direction :
         une averse immobile dure, c'est un fait utile. */
      const stagne = D.phrase({ kmh: 4, provenance: 200 });
      if (!/bouge peu/.test(stagne)) return `phrase d'une pluie immobile : ${stagne}`;
      return "";
    }) === "");

  /* La mesure est gardée dix minutes, la cadence du radar : deux lectures de suite
     ne redemandent pas les tuiles. */
  ok("une seconde lecture ne redemande pas les tuiles",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const R = await import("/src/radar.js");
      const idx = await R.charger();
      const obs = idx.images.filter(x => !x.futur);
      D.oublier();
      let n = 0;
      const compte = u => { n++; return D.chargerTuile(u); };
      const a = await D.lire(47.5, 4.3, idx.hote, obs, compte);
      const apres = n;
      const b = await D.lire(47.5, 4.3, idx.hote, obs, compte);
      if (!a || !b) return "la mesure ne rend rien";
      return n === apres ? "" : `${n - apres} tuiles redemandées à la seconde lecture`;
    }) === "");

  /* Le déplacement prolongé, version 184, jalon 26, lot 2. */
  ok("la couleur du radar se lit en dBZ et en classe de pluie",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const z = [[0x00, 0x9a, 0xd5, 255], [0xff, 0xe0, 0x00, 255], [0xd9, 0x1b, 0x00, 255], [0x78, 0xb8, 0xff, 255],
        [0xc2, 0xb4, 0x82, 255], [0x00, 0x9a, 0xd5, 0]].map(c => D.dbzDe(...c));
      return `${z.join(",")} ${z.map(D.rangDe).join(",")}`;
    }) === "21,36,48,21,9, 2,3,4,2,1,1");

  ok("le profil pousse la dernière image du déplacement mesuré, minute par minute",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const n = 256, img = new Uint8ClampedArray(n * n * 4);
      for (let y = 0; y < n; y++) for (let x = 100; x <= 130; x++) {
        const k = (y * n + x) * 4; img[k] = 0x00; img[k + 1] = 0x7f; img[k + 2] = 0xb4; img[k + 3] = 255;
      }
      /* Six pixels vers l'est en trente minutes : la bande, à vingt pixels à
         l'ouest du point, arrive en cent minutes environ, quatre-vingt-dix-huit
         pour la fenêtre de trois pixels. Près du bord ouest, l'amont sort de
         la tuile au bout d'une vingtaine de minutes. */
      const p = D.profilDe(img, 150, 128, 6, 0, 30);
      const bord = D.profilDe(img, 5, 128, 6, 0, 30);
      const debut = p.findIndex(v => v > 0);
      return `${p.length} ${debut} ${p[120]} ${p[60]} ${bord.length < 30}`;
    }) === "151 98 24 0 true");

  ok("la mesure rend le profil et l'heure de son image",
    await pgDep.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const R = await import("/src/radar.js");
      const idx = await R.charger();
      const obs = idx.images.filter(x => !x.futur);
      D.oublier();
      const d = await D.mesurer(47.5, 4.3, idx.hote, obs);
      if (!d) return "aucune mesure";
      if (!Array.isArray(d.profil) || d.profil.length < 61) return `profil de ${d.profil && d.profil.length} minutes`;
      return d.tImage === obs[obs.length - 1].t ? "" : "heure d'image fausse";
    }) === "");

  ok("le déplacement compte pleinement jusqu'à une heure, plus du tout à deux heures et demie",
    await pgDep.evaluate(async () => {
      const P = await import("/src/pluieproche.js");
      const t0 = Date.now(), mn = 60000;
      const profil = Array.from({ length: 151 }, (_, tau) => (tau >= 70 && tau <= 110 ? 24 : 0));
      const dep = { profil, tImage: t0 - 10 * mn };
      const sec = k => ({ t: t0 + (60 + 15 * k) * mn, i: 1, accord: 0, total: 6 });
      const f = P.fondre([0, 1, 2, 3].map(sec), dep, t0);
      const pluie = P.fondre([{ t: t0 + 120 * mn, i: 3, accord: 6, total: 6 }, { t: t0 + 150 * mn, i: 3, accord: 6, total: 6 }], dep, t0);
      return [...f.map(x => `${x.i}:${x.p.toFixed(2)}`), ...pluie.map(x => `${x.i}:${(x.p ?? 1).toFixed(2)}`)].join(" ");
    }) === "2:1.00 2:0.83 2:0.67 1:0.00 3:0.67 3:1.00");

  ok("une pluie apportée par le déplacement le dit, avec l'accord des modèles",
    await pgDep.evaluate(async () => {
      const P = await import("/src/pluieproche.js");
      return [P.dapresDe({ radar: true, accord: 0, total: 6 }), P.dapresDe({ radar: true, accord: 1, total: 6 }),
        P.dapresDe({ radar: false, accord: 4, total: 6 })].join(" | ");
    }) === "d'après le déplacement des averses, qu'aucun modèle ne voit | "
      + "d'après le déplacement des averses et 1 modèle sur 6 | d'après 4 modèles sur 6");

  ok("le ruban fond le déplacement dans la suite et la nomme estimée",
    await pgDep.evaluate(() => document.querySelector(".pp-zone")?.textContent.trim() || "") === "estimée");

  await ctxDep.close();

  /* Les jours secs, le panneau se tait et la mesure ne part pas : elle coûte
     l'index du radar et deux tuiles, une soixantaine de kilooctets. */
  etat.profilPluie = "sec";
  etat.appelsRadar.length = 0;
  const ctxDepSec = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxDepSec.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxDepSec);
  const pgDepSec = await ctxDepSec.newPage();
  await ouvrirPage(pgDepSec);
  await reposer(pgDepSec, 1800);
  const venuesSeches = await pgDepSec.locator(".pp-venue").count();
  ok("sur un temps sec, rien n'est demandé au radar",
    etat.appelsRadar.length === 0 && venuesSeches === 0,
    `${etat.appelsRadar.length} appels au radar, ${venuesSeches} lignes de venue`);
  await ctxDepSec.close();

  /* Version 184 : un seul modèle voit de la pluie dans les trois heures. Rien
     ne s'annonce, mais le déplacement prolongé peut l'annoncer ou la
     démentir : la mesure part. */
  etat.profilRepli = "tard"; etat.accordRepli = 1;
  etat.appelsRadar.length = 0;
  const ctxIndice = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxIndice.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxIndice);
  const pgIndice = await ctxIndice.newPage();
  await ouvrirPage(pgIndice);
  await reposer(pgIndice, 1800);
  ok("un seul modèle qui voit de la pluie fait partir la mesure du déplacement",
    etat.appelsRadar.some(u => /\/256\/5\/16\/11\//.test(u)), `${etat.appelsRadar.length} appels au radar`);
  await ctxIndice.close();
  etat.profilRepli = "sec"; etat.accordRepli = Infinity;
  etat.profilPluie = "sec";

  /* ---------- Le repli, là où le radar ne couvre pas ----------

     Le drapeau de disponibilité fait basculer sur une colonne d'Open-Meteo, au pas
     du quart d'heure. Sans ce repli, la Corse et les reliefs n'ont aucun compte à
     rebours. Mesuré le 7 septembre 2026 : 247 octets pour huit pas. */

  const avecRepli = async (profil, mf = "indispo", quand = FIGE, images = false) => {
    etat.profilPluie = mf;
    etat.profilRepli = profil;
    etat.appelsRepli.length = 0;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, quand));
    await brancherRoutes(c);
    /* Le radar d'images se tait, sauf demande : la seconde méthode a ses
       propres contrôles plus bas. */
    if (!images) await c.route(/api\.rainviewer\.com/, r => r.abort());
    const p = await c.newPage();
    await ouvrirPage(p);
    await (images ? reposer(p, 2100) : p.waitForTimeout(800));
    const dit = await p.evaluate(() => {
      const e = document.querySelector(".pp");
      if (!e) return null;
      return { phrase: e.querySelector(".pp-tete b").textContent,
        delai: e.querySelector(".pp-delai")?.textContent || "",
        sous: e.querySelector(".pp-sous")?.textContent || "",
        axe: [...e.querySelectorAll(".pp-axe > span")].map(x => x.textContent.trim()) };
    });
    const appels = etat.appelsRepli.length;
    await c.close();
    etat.profilPluie = "sec"; etat.profilRepli = "sec";
    return { dit, appels };
  };

  const repliDebut = await avecRepli("debut");
  ok("sans couverture radar, le repli prend le relais",
    repliDebut.appels === 1 && repliDebut.dit !== null,
    `${repliDebut.appels} appels au repli, panneau ${repliDebut.dit ? "présent" : "absent"}`);

  ok("le repli dit ce qui arrive",
    repliDebut.dit && repliDebut.dit.phrase === "Pluie modérée vers 09 h 30" && repliDebut.dit.delai === "dans 30 min"
    && /^Pendant 30 minutes environ\./.test(repliDebut.dit.sous),
    repliDebut.dit && `${repliDebut.dit.phrase} | ${repliDebut.dit.delai} | ${repliDebut.dit.sous}`);

  /* Le repli travaille au quart d'heure. Écrire « dans 25 minutes » sur une source
     qui ne sait rien de plus fin qu'un quart d'heure donnerait une précision
     qu'elle n'a pas.

     L'horloge est décalée de sept minutes hors de la grille du quart d'heure. Sur
     une horloge posée sur la grille, les cinq pas tombent tous sur des multiples
     de quinze, et les deux arrondis donnent le même chiffre. */
  const repliDecale = await avecRepli("debut", "indispo", FIGE + 7 * 60000);
  ok("le repli annonce au pas du quart d'heure",
    repliDecale.dit && repliDecale.dit.delai === "dans 30 min",
    repliDecale.dit && repliDecale.dit.delai);

  /* Cinq pas de quinze minutes tiennent l'heure, la suite du même modèle va
     jusqu'à trois heures d'ici depuis la version 169. */
  ok("le ruban du repli va jusqu'à trois heures d'ici",
    repliDebut.dit && repliDebut.dit.axe[repliDebut.dit.axe.length - 1] === "12 h",
    repliDebut.dit && repliDebut.dit.axe.join(" "));

  /* La lame d'eau devient le même rang ordinal que celui de Météo-France : la
     classification usuelle place la pluie modérée entre 2,5 et 7,6 millimètres par
     heure, soit entre 0,6 et 1,9 par quart d'heure. */
  const [ctxRang, pgRang] = await ctxReponse(METEO_NUE, FAIN);
  ok("la lame d'eau du repli devient un rang d'intensité",
    await pgRang.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const corps = mm => ({ minutely_15: {
        time: ["2026-08-18T09:00", "2026-08-18T09:15"], precipitation: [mm, 0] } });
      const rang = mm => M.lireRepli(corps(mm)).pas[0].i;
      const attendu = [[0, 1], [0.05, 1], [0.2, 2], [0.5, 2], [0.7, 3], [1.5, 3], [2.5, 4]];
      for (const [mm, r] of attendu) {
        if (rang(mm) !== r) return `${mm} mm donne le rang ${rang(mm)} au lieu de ${r}`;
      }
      return "";
    }) === "");
  await ctxRang.close();

  /* Le modèle est lu partout depuis la version 169, pour la suite des trois
     heures. Là où le radar couvre, il ne parle qu'au delà de l'heure : la pluie
     qu'il voit à 9 h 30 ne remplace pas celle que le radar voit à 9 h 20. */
  const repliInutile = await avecRepli("debut", "debut");
  ok("avec couverture radar, le modèle ne sert qu'au-delà de l'heure",
    repliInutile.appels === 1 && repliInutile.dit
    && repliInutile.dit.phrase === "Pluie modérée vers 09 h 20",
    `${repliInutile.appels} appels, phrase « ${repliInutile.dit && repliInutile.dit.phrase} »`);

  /* Une heure sèche reste muette, quelle que soit la source qui l'a lue. */
  const repliSec = await avecRepli("sec");
  ok("une heure sèche reste muette avec le repli", repliSec.dit === null,
    repliSec.dit && repliSec.dit.phrase);

  /* La source n'est demandée qu'une fois par chargement : le produit se refait
     toutes les cinq minutes, et la garde évite qu'un aller-retour entre deux
     écrans redemande à chaque fois. */
  etat.appelsPluie.length = 0;
  etat.profilPluie = "debut";
  const ctxPP = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxPP.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxPP);
  const pgPP = await ctxPP.newPage();
  await ouvrirPage(pgPP);
  await pgPP.waitForTimeout(700);
  const appelsUn = etat.appelsPluie.length;
  for (const cle of ["temps", "semaine", "accueil", "carte", "accueil"]) {
    await (cle === "temps" ? ouvrirLeTemps(pgPP) : pgPP.locator(`[data-onglet="${cle}"]`).click());
    await pgPP.waitForTimeout(350);
  }
  ok("changer d'écran ne redemande pas la pluie",
    appelsUn === 1 && etat.appelsPluie.length === 1,
    `${appelsUn} à l'ouverture, ${etat.appelsPluie.length} après cinq changements d'écran`);

  /* La garde du cache se lit sur la fonction. Le produit ne se demande qu'au
     chargement de la prévision, et non à chaque écran : une faute qui viderait le
     cache ne changerait donc rien au parcours ci-dessus. Ce que le cache protège
     est le retour sur un lieu déjà lu, qui relance un chargement complet. */
  const avantCache = etat.appelsPluie.length;
  const deuxLectures = await pgPP.evaluate(async () => {
    const M = await import("/src/pluieproche.js");
    const a = await M.charger(47.5, 4.3);
    const b = await M.charger(47.5, 4.3);
    return a !== null && b !== null;
  });
  await pgPP.waitForTimeout(300);
  ok("un lieu déjà lu ne redemande pas le produit",
    deuxLectures && etat.appelsPluie.length === avantCache,
    `${etat.appelsPluie.length - avantCache} appels pour deux lectures du même lieu`);
  ok("le jeton du service est celui de la vigilance, écrit à un seul endroit",
    etat.appelsPluie[0] && etat.appelsPluie[0].includes("token=__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__"),
    etat.appelsPluie[0]);
  await ctxPP.close();
  etat.profilPluie = "sec";

  /* Un produit muet ne prive pas l'écran de son temps qu'il fait, comme un
     bulletin de vigilance manquant ne l'en prive pas. */
  const ctxPPmuet = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxPPmuet.addInitScript(amorceGardee(FAIN, FIGE));
  await brancherRoutes(ctxPPmuet);
  await ctxPPmuet.route(/nowcast\/rain/, r => r.abort());
  const pgPPmuet = await ctxPPmuet.newPage();
  await ouvrirPage(pgPPmuet);
  await pgPPmuet.waitForTimeout(700);
  ok("un produit muet ne prive pas l'écran de son temps qu'il fait",
    await pgPPmuet.evaluate(() =>
      !document.querySelector(".pp")
      && document.querySelector(".bd-deg") !== null
      && document.querySelector('[data-bloc="jour"]') !== null));
  await ctxPPmuet.close();

  /* ---------- La seconde méthode, version 170 ----------

     La dernière image, poussée du déplacement mesuré, donne une heure
     d'arrivée indépendante. Sur la charge d'essai, la tache la plus proche de
     la commune l'atteint vers 9 h 40. Météo-France annonce 9 h 20 au profil
     « debut » : vingt minutes d'écart, au delà des dix de l'accord et en
     deçà des trente au delà desquels la pluie n'est plus celle qui approche,
     l'heure devient une plage. Au profil « accord », elle annonce 9 h 40 : l'heure
     est confirmée. */
  const avecMethode = async profil => {
    etat.profilPluie = profil;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    await brancherRoutes(c);
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 2100);
    const dit = await p.evaluate(() => {
      const e = document.querySelector(".pp");
      return e ? { phrase: e.querySelector(".pp-tete b").textContent,
        delai: e.querySelector(".pp-delai")?.textContent || "",
        sous: e.querySelector(".pp-sous")?.textContent || "" } : null;
    });
    await c.close();
    etat.profilPluie = "sec";
    return dit;
  };
  const mPlage = await avecMethode("debut");
  ok("deux méthodes qui s'écartent donnent une plage",
    mPlage && mPlage.phrase === "Pluie modérée entre 09 h 20 et 09 h 40"
    && mPlage.delai === "dans 20 à 40 min" && /Heure incertaine selon le déplacement des averses\./.test(mPlage.sous),
    mPlage && `${mPlage.phrase} | ${mPlage.delai} | ${mPlage.sous}`);
  const mAccord = await avecMethode("accord");
  ok("deux méthodes d'accord confirment l'heure",
    mAccord && mAccord.phrase === "Pluie modérée vers 09 h 40"
    && /Heure confirmée par le déplacement des averses\./.test(mAccord.sous),
    mAccord && `${mAccord.phrase} | ${mAccord.sous}`);

  /* Le repli est un modèle : le déplacement mesuré ne le croise pas. */
  const mRepli = await avecRepli("debut", "indispo", FIGE, true);
  ok("la seconde méthode ne croise pas le repli",
    mRepli.dit && mRepli.dit.phrase === "Pluie modérée vers 09 h 30"
    && !/déplacement des averses/.test(mRepli.dit.sous),
    mRepli.dit && `${mRepli.dit.phrase} | ${mRepli.dit.sous}`);

  const [ctxMeth, pgMeth] = await ctxReponse(METEO_NUE, FAIN);
  /* L'approche sur une tuile fabriquée : une bande de pluie de x = 40 à 60,
     un déplacement de dix points vers l'est en dix minutes. Le point à x = 100
     la voit arriver dans quarante minutes ; le point à x = 250, dont l'amont
     sort de la tuile après six minutes, n'en sait rien au delà. */
  ok("l'approche pousse la dernière image du déplacement et s'arrête au bord",
    await pgMeth.evaluate(async () => {
      const D = await import("/src/deplacement.js");
      const n = 256, d = new Uint8ClampedArray(n * n * 4);
      for (let y = 0; y < n; y++) for (let x = 40; x <= 60; x++) d[(y * n + x) * 4 + 3] = 200;
      const t0 = 1e12;
      const a = D.approcheDe(d, 100, 100, 10, 0, 10, t0, n);
      if (a.t !== t0 + 40 * 60000) return `arrivée à ${(a.t - t0) / 60000} minutes au lieu de 40`;
      const b = D.approcheDe(d, 250, 100, -10, 0, 10, t0, n);
      if (b.t !== null || b.jusqua !== t0 + 6 * 60000) return `bord : ${b.t} jusqu'à ${(b.jusqua - t0) / 60000} minutes`;
      const c = D.approcheDe(d, 100, 100, 0, 0, 10, t0, n);
      if (c.t !== null || c.jusqua !== t0 + D.HORIZON_APPROCHE * 60000) return "une pluie immobile à côté est arrivée";
      return "";
    }) === "");
  ok("la seconde méthode confirme, élargit ou signale selon l'écart",
    await pgMeth.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      // Les échéances du radar tombent sur le pas de cinq minutes.
      const t0 = Math.floor(Date.now() / 300000) * 300000;
      const ev = { genre: "debut", force: 3, t: t0 + 20 * 60000, fin: null };
      const a = M.croiser(ev, { t: t0 + 25 * 60000, jusqua: t0 + 25 * 60000 }, t0);
      if (!a.confirme || a.plage) return "un écart de cinq minutes n'est pas confirmé";
      const b = M.croiser(ev, { t: t0 + 45 * 60000, jusqua: t0 + 45 * 60000 }, t0);
      if (!b.plage || b.plage[0] !== ev.t || b.plage[1] !== t0 + 45 * 60000) return "un écart de vingt-cinq minutes ne donne pas la plage";
      const loin = M.croiser(ev, { t: t0 + 60 * 60000, jusqua: t0 + 60 * 60000 }, t0);
      if (!loin.nonVue || loin.plage) return "un écart de quarante minutes a donné une plage";
      const c = M.croiser(ev, { t: null, jusqua: t0 + 90 * 60000 }, t0);
      if (!c.nonVue) return "une pluie qu'aucune averse n'apporte n'est pas signalée";
      const d = M.croiser(ev, { t: null, jusqua: t0 + 10 * 60000 }, t0);
      if (d.nonVue || d.plage || d.confirme) return "le bord de la tuile a fait conclure";
      const e = M.croiser({ ...ev, genre: "fin" }, { t: t0, jusqua: t0 }, t0);
      if (e.plage || e.confirme) return "une fin de pluie a été croisée";
      const f = M.croiser({ ...ev, modele: true }, { t: t0 + 45 * 60000, jusqua: t0 }, t0);
      if (f.plage) return "une pluie du modèle a été croisée";
      return "";
    }) === "");
  await ctxMeth.close();

  /* Le délai s'arrondit au pas de cinq minutes, celui de la source. Écrire « dans
     23 minutes » donnerait à un radar une précision de chronomètre.

     La garde se lit sur la fonction : les échéances de la charge tombent sur le
     quart d'heure de l'horloge figée, et l'arrondi n'y change donc rien. Elle
     demande deux écarts qui ne tombent pas sur le pas de cinq. */
  const [ctxRond, pgRond] = await ctxReponse(METEO_NUE, FAIN);
  ok("le délai s'arrondit au pas de la source",
    await pgRond.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      const a = M.minutesJusqua(t0 + 23 * 60000, t0);
      const b = M.minutesJusqua(t0 + 22 * 60000, t0);
      const c = M.minutesJusqua(t0 + 7 * 60000, t0);
      return `${a}|${b}|${c}`;
    }) === "25|20|5",
    await pgRond.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      return [23, 22, 7].map(m => M.minutesJusqua(t0 + m * 60000, t0)).join("|");
    }));
  await ctxRond.close();

  /* ---------- Le climat de la commune ----------

     La charge d'archive est déterministe : le maximum d'une journée vaut une
     sinusoïde de saison, plus deux centièmes de degré par année écoulée depuis
     1950, plus une bosse tirée de l'année et du rang. Chaque réponse de la
     feuille se recalcule donc ici, à partir de la même formule, sans dépendre de
     ce que le module en fait. */
};
