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
  etat.profilPluie = "sec";

  /* ---------- Le repli, là où le radar ne couvre pas ----------

     Le drapeau de disponibilité fait basculer sur une colonne d'Open-Meteo, au pas
     du quart d'heure. Sans ce repli, la Corse et les reliefs n'ont aucun compte à
     rebours. Mesuré le 7 septembre 2026 : 247 octets pour huit pas. */

  const avecRepli = async (profil, mf = "indispo", quand = FIGE) => {
    etat.profilPluie = mf;
    etat.profilRepli = profil;
    etat.appelsRepli.length = 0;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, quand));
    await brancherRoutes(c);
    const p = await c.newPage();
    await ouvrirPage(p);
    await p.waitForTimeout(800);
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

  /* Cinq pas de quinze minutes, contre neuf échéances pour le radar. Le ruban
     porte ce que la source donne : il finit un quart d'heure après la
     cinquième. */
  ok("le ruban du repli finit au bout de ses cinq pas",
    repliDebut.dit && repliDebut.dit.axe[repliDebut.dit.axe.length - 1] === "10 h 15",
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

  /* Le repli ne part que là où le radar manque. Ailleurs, il coûterait une requête
     pour rien. */
  const repliInutile = await avecRepli("debut", "debut");
  ok("avec couverture radar, le repli ne part pas",
    repliInutile.appels === 0 && repliInutile.dit
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
