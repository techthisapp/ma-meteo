/* La pluie dans l'heure. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import { FIGE, FAIN, METEO, amorceGardee } from "../faux-services.mjs";

export const titre = "La pluie dans l'heure";
export const avecPage = false;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ctxReponse, METEO_NUE } = T;
  /* Le produit « pluie dans l'heure » de Météo-France, sur le service qui porte
     déjà la vigilance. Il devait être l'extrapolation de RainViewer, lue au pixel
     dans les tuiles ; ce champ était vide aux trois relevés des 5 et 6 septembre,
     et une fonction ne se bâtit pas sur ce qu'une source ne sert pas. */
  const avecPluie = async (profil, voisins = null) => {
    etat.profilPluie = profil;
    etat.profilVoisins = voisins;
    etat.appelsVoisins.length = 0;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    await brancherRoutes(c);
    const p = await c.newPage();
    await ouvrirPage(p);
    await p.waitForTimeout(700);
    const dit = await p.evaluate(() => {
      const e = document.querySelector(".pp");
      if (!e) return null;
      return {
        phrase: e.querySelector(".pp-tete b").textContent,
        delai: e.querySelector(".pp-delai")?.textContent || "",
        sous: e.querySelector(".pp-sous")?.textContent || "",
        morceaux: [...e.querySelectorAll(".pp-s")].map(b => ({
          de: parseFloat(b.style.getPropertyValue("--de")),
          l: parseFloat(b.style.getPropertyValue("--l")),
          genre: b.dataset.genre, rang: Number(b.dataset.rang),
        })),
        legende: [...e.querySelectorAll(".pp-leg")].map(x => x.textContent.trim()),
        axe: [...e.querySelectorAll(".pp-axe > span")].map(x => x.textContent.trim()),
        carte: !!e.querySelector("[data-pluie-carte]"),
        lu: e.querySelector(".pp-g").getAttribute("aria-label"),
        /* Ce qui reste dans la première vue quand la vigilance et la pluie
           proche paraissent ensemble. */
        vue: (() => {
          const b = x => (x ? Math.round(x.getBoundingClientRect().bottom) : null);
          const o = document.getElementById("onglets");
          return {
            deg: b(document.querySelector("#ecran .bd-deg")),
            vg: b(document.querySelector("#ecran .vg")),
            graphe: b(e.querySelector(".pp-g")),
            pli: o ? Math.round(o.getBoundingClientRect().top) : null,
          };
        })(),
        /* La place du panneau dans l'écran : après la vigilance, avant le bloc du
           jour. C'est la seule chose de l'écran qui se démente en vingt minutes. */
        apres: (() => {
          const l = [...document.querySelectorAll(".ecran-corps > .section")];
          const k = l.indexOf(e);
          return k > 0 ? (l[k - 1].classList.contains("vg") ? "vigilance" : l[k - 1].dataset.bloc)
            : "rien";
        })(),
        avant: (() => {
          const l = [...document.querySelectorAll(".ecran-corps > .section")];
          const k = l.indexOf(e);
          return k >= 0 && l[k + 1] ? l[k + 1].dataset.bloc : null;
        })(),
      };
    });
    const voisinsLus = etat.appelsVoisins.map(u => {
      const q = new URL(u).searchParams;
      return [q.get("lat"), q.get("lon")];
    });
    await c.close();
    etat.profilPluie = "sec";
    etat.profilVoisins = null;
    return dit && { ...dit, voisinsLus };
  };

  const ppSec = await avecPluie("sec");
  ok("une heure entièrement sèche ne dit rien", ppSec === null,
    ppSec && ppSec.phrase);

  const ppDebut = await avecPluie("debut");
  /* Depuis la version 168, le titre dit l'heure, le délai se lit à droite et
     la durée dessous. */
  ok("une pluie qui commence se dit avec son heure, son délai et sa force",
    ppDebut && ppDebut.phrase === "Pluie modérée vers 09 h 20" && ppDebut.delai === "dans 20 min"
    && /^Pendant 20 minutes environ\./.test(ppDebut.sous),
    ppDebut && `${ppDebut.phrase} | ${ppDebut.delai} | ${ppDebut.sous}`);
  /* La force annoncée est la plus forte de l'épisode, non celle de sa première
     échéance : une averse qui commence faible et devient modérée se dit modérée. */
  ok("la force annoncée est celle de tout l'épisode",
    ppDebut && /modérée/.test(ppDebut.phrase), ppDebut && ppDebut.phrase);

  /* Les deux panneaux d'horloge courte tiennent ensemble dans la première vue,
     avec le grand chiffre. Ce qui en sort, ce sont les quatre mesures du jour :
     elles résument une journée, quand la vigilance et la pluie de vingt minutes
     sont deux faits qui se démentent dans l'heure. Mesuré le 6 septembre 2026 sur
     une vigilance orange à deux phénomènes : le graphe finit cent soixante-seize
     points au-dessus de la barre d'onglets, les mesures quatre-vingt-seize points
     en dessous. La garde de la vigilance seule reste entière et sert toujours :
     sa charge est une heure sèche, et un panneau bavard la ferait tomber. */
  ok("la vigilance, la pluie proche et le grand chiffre tiennent dans la première vue",
    ppDebut && ppDebut.vue.deg < ppDebut.vue.pli
    && ppDebut.vue.vg < ppDebut.vue.pli
    && ppDebut.vue.graphe < ppDebut.vue.pli,
    ppDebut && `chiffre ${ppDebut.vue.deg}, vigilance ${ppDebut.vue.vg}, `
      + `graphe ${ppDebut.vue.graphe}, pli ${ppDebut.vue.pli}`);

  ok("le panneau vient après la vigilance et avant le bloc du jour",
    ppDebut && ppDebut.apres === "vigilance" && ppDebut.avant === "jour",
    ppDebut && `précédé de ${ppDebut.apres}, suivi de ${ppDebut.avant}`);

  /* Le ruban, version 168. Il part de maintenant, 9 h, et finit au bout de
     l'heure couverte : la dernière échéance, 10 h, vaut autant que la
     précédente, soit 10 h 10, soixante-dix minutes. Chaque échéance couvre le
     temps jusqu'à la suivante : la pluie faible de 9 h 20 tient jusqu'à 9 h 25,
     la modérée de 9 h 25 jusqu'à 9 h 40, l'échéance sèche suivante. Les
     échéances ne sont pas également espacées, cinq minutes puis dix, et des
     morceaux à intervalle constant mentiraient sur la durée. */
  /* La tolérance vaut une douzaine de secondes : l'horloge de la page avance
     pendant le chargement, d'une seconde environ sur les machines de GitHub. */
  const pc = m => Math.round((m / 70) * 10000) / 100;
  const proche = (a, b) => Math.abs(a - b) < 0.3;
  const eau = ppDebut ? ppDebut.morceaux.filter(m => m.genre === "eau") : [];
  ok("le ruban pose chaque morceau de pluie à son heure, de maintenant au bout de l'heure couverte",
    eau.length === 2
    && proche(eau[0].de, pc(20)) && proche(eau[0].l, pc(5))
    && proche(eau[1].de, pc(25)) && proche(eau[1].l, pc(15))
    && ppDebut.axe[0] === "maint." && ppDebut.axe[ppDebut.axe.length - 1] === "10 h 10",
    ppDebut && `${eau.map(m => `${m.de}+${m.l}`).join(" ")} | ${ppDebut.axe.join(" ")}`);

  ok("seules les échéances mouillées portent l'eau, dans la nuance de leur force",
    ppDebut && ppDebut.morceaux.map(m => `${m.genre}${m.rang}`).join(" ") === "eau2 eau3"
    && ppDebut.legende.join(" ") === "faible modérée",
    ppDebut && `${ppDebut.morceaux.map(m => `${m.genre}${m.rang}`).join(" ")} | ${ppDebut.legende.join(" ")}`);

  /* Les repères de l'axe tombent sur les quarts d'heure, loin des deux bouts. */
  ok("l'axe du ruban porte les quarts d'heure entre maintenant et la fin",
    ppDebut && ppDebut.axe.join(" ") === "maint. 09 h 15 09 h 30 09 h 45 10 h 10",
    ppDebut && ppDebut.axe.join(" "));

  /* Le voisinage, version 168. Quatre points à trois kilomètres, arrondis au
     centième comme le point lui-même. */
  ok("le voisinage lit quatre points à trois kilomètres, au centième de degré",
    ppDebut && ppDebut.voisinsLus.length === 4
    && ppDebut.voisinsLus.map(v => v.join(",")).sort().join(" ")
      === ["47.47,4.3", "47.5,4.26", "47.5,4.34", "47.53,4.3"].join(" "),
    ppDebut && ppDebut.voisinsLus.map(v => v.join(",")).join(" "));

  const ppProche = await avecPluie("sec", "debut");
  ok("une averse autour d'un point sec se dit à quelques kilomètres",
    ppProche && ppProche.phrase === "Pluie modérée à quelques kilomètres"
    && ppProche.morceaux.length > 0 && ppProche.morceaux.every(m => m.genre === "autour")
    && ppProche.legende.join(" ") === "alentour",
    ppProche && `${ppProche.phrase} | ${ppProche.morceaux.map(m => m.genre).join(" ")} | ${ppProche.legende}`);

  /* Un point mouillé garde son annonce ; les voisins ne hachurent que là où il
     est sec. */
  const ppMele = await avecPluie("debut", "sansfin");
  ok("autour d'une pluie annoncée, les voisins ne hachurent que le sec",
    ppMele && ppMele.phrase === "Pluie modérée vers 09 h 20"
    && ppMele.morceaux.some(m => m.genre === "autour")
    && ppMele.morceaux.filter(m => m.genre === "eau").length === 2,
    ppMele && `${ppMele.phrase} | ${ppMele.morceaux.map(m => `${m.genre}${m.rang}`).join(" ")}`);

  ok("l'encart mène à la carte", ppDebut && ppDebut.carte === true);

  ok("le graphe se lit sans le voir",
    ppDebut && /pluie modérée de \d\d[ :]/i.test(ppDebut.lu), ppDebut && ppDebut.lu);

  const ppEnCours = await avecPluie("encours");
  ok("une pluie en cours se dit par sa fin",
    ppEnCours && ppEnCours.phrase === "Pluie faible jusque vers 09 h 15" && ppEnCours.delai === "encore 15 min",
    ppEnCours && `${ppEnCours.phrase} | ${ppEnCours.delai}`);

  const ppSansFin = await avecPluie("sansfin");
  ok("une pluie sans accalmie ne s'invente pas de fin",
    ppSansFin && ppSansFin.phrase === "Pluie modérée, sans accalmie dans l'heure",
    ppSansFin && ppSansFin.phrase);

  /* Le drapeau de disponibilité fait foi. Mesuré le 6 septembre 2026 : Ajaccio,
     Briançon et Gaillard rendent neuf échéances toutes à « Temps sec » avec le
     drapeau à zéro, le radar ne couvrant pas ces reliefs.

     La garde se lit sur la fonction et non sur l'écran, et c'est voulu. Un produit
     indisponible rend du temps sec, l'encart se tait sur une heure sèche, et une
     faute qui ignorerait le drapeau ne changerait donc rien de visible sur les cas
     observés. Ce que le drapeau protège est le contrat du module : ne rien
     conclure d'une lecture qu'il ne couvre pas, quelles que soient les valeurs
     qu'elle porte. Une charge indisponible portant de la pluie n'a pas été
     observée et ne se fabrique donc pas en réponse de service ; elle se pose ici,
     directement sur la fonction, là où elle ne prétend rien de la source. */
  const ppIndispo = await avecPluie("indispo");
  ok("un produit indisponible ne dit rien à l'écran", ppIndispo === null,
    ppIndispo && ppIndispo.phrase);

  const [ctxDrapeau, pgDrapeau] = await ctxReponse(METEO_NUE, FAIN);
  ok("une lecture non couverte ne conclut rien, quelles que soient ses valeurs",
    await pgDrapeau.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      const pas = [0, 5, 10, 15, 20, 25, 30, 40, 50]
        .map((m, k) => ({ t: t0 + m * 60000, i: k < 2 ? 1 : 3 }));
      const couvert = M.evenement({ dispo: true, pas }, t0);
      const nu = M.evenement({ dispo: false, pas }, t0);
      if (!couvert) return "la même lecture couverte ne dit rien non plus";
      return nu === null ? "" : `non couverte : ${M.phrase(nu, t0)}`;
    }) === "");
  await ctxDrapeau.close();

  /* Le rang zéro n'est pas du temps sec : c'est l'absence de valeur. Une averse
     suivie d'échéances muettes ne s'arrête pas, on ignore quand elle s'arrête. */
  const ppMuet = await avecPluie("muet");
  ok("une échéance sans valeur n'invente pas une fin de pluie",
    ppMuet && ppMuet.phrase === "Pluie faible, sans accalmie dans l'heure",
    ppMuet && ppMuet.phrase);

  /* Un trou avant la pluie : la source ne dit rien de ce qui se passe entre les
     deux, et une averse annoncée derrière un trou serait une averse dont on ignore
     si elle a déjà commencé. La lecture s'arrête au trou. */
  const ppSecMuet = await avecPluie("secmuet");
  ok("une échéance sans valeur arrête la lecture avant la pluie qui suit",
    ppSecMuet === null, ppSecMuet && ppSecMuet.phrase);

  /* ---------- Le sens d'arrivée de la pluie ----------

     Le service radar publie son champ extrapolé vide, relevé les 5, 6, 7 et 8
     septembre 2026 : rien ne se prévoit à partir des images. Ce qui se mesure est
     le passé, le déplacement de la masse entre deux images observées.

     La charge d'essai porte des taches qui se déplacent de deux points vers l'est
     et un vers le nord par pas de dix minutes, sur la tuile de zoom cinq qui
     contient la commune. Sur les trois pas que la mesure compare, cela fait une
     provenance de 243 degrés à environ quarante kilomètres par heure, ce qui est
     le cas réel relevé le 8 septembre. */

  /* ---------- Le lien vers la carte, version 168 ----------

     L'encart mène à la carte, couche de pluie allumée même si on l'avait
     éteinte : la pluie qui arrive se regarde autour de soi. */
  etat.profilPluie = "debut";
  const ctxLien = await nav.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
  });
  await ctxLien.addInitScript(amorceGardee({ ...FAIN, pluiecarte: false }, FIGE));
  await brancherRoutes(ctxLien);
  const pgLien = await ctxLien.newPage();
  await ouvrirPage(pgLien);
  await pgLien.waitForTimeout(700);
  await pgLien.locator("[data-pluie-carte]").click();
  await pgLien.waitForTimeout(500);
  const lien = await pgLien.evaluate(() => ({
    onglet: document.querySelector('[data-onglet][aria-current="page"]')?.dataset.onglet || "",
    pluie: JSON.parse(localStorage.getItem("mameteo.reglages.v1") || "{}").pluiecarte,
    interrupteur: document.querySelector("#caPluie")?.getAttribute("aria-checked") || "",
  }));
  ok("le lien de l'encart ouvre la carte, la pluie allumée",
    lien.onglet === "carte" && lien.pluie === true && lien.interrupteur === "true",
    `onglet ${lien.onglet}, réglage ${lien.pluie}, interrupteur ${lien.interrupteur}`);
  await ctxLien.close();
  etat.profilPluie = "sec";

  /* ---------- Le rappel de parapluie accordé au radar, version 168 ----------

     La série horaire annonçait « 09 h à 13 h » quand le radar voyait le sec
     jusqu'à 9 h 55. Dans l'heure qu'il couvre, le radar prime : il retarde le
     début, il ne l'avance jamais, et une salve qu'il voit entièrement sèche
     tombe. */
  /* À l'écran : de la pluie posée de 9 h à 13 h dans la série horaire, et le
     radar qui voit le sec jusqu'à 9 h 20. La pastille de la barre de tête suit
     le radar. */
  const pastille = async profil => {
    etat.profilPluie = profil;
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(FAIN, FIGE));
    await brancherRoutes(c);
    await c.route(/api\.open-meteo\.com/, route => {
      const u = route.request().url();
      if (new URL(u).host !== "api.open-meteo.com" || !u.includes("hourly=")
        || /minutely_15|snow_depth|soil_moisture|start_date=|current=/.test(u)) {
        route.fallback(); return;
      }
      const d = JSON.parse(JSON.stringify(METEO));
      for (let k = 0; k < d.hourly.time.length; k++) {
        if (!/^2026-08-18T(09|1[012])/.test(d.hourly.time[k])) continue;
        d.hourly.precipitation[k] = 1.2;
        d.hourly.precipitation_probability[k] = 80;
        d.hourly.wind_gusts_10m[k] = 20;
      }
      route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ hourly: d.hourly }) });
    });
    const p = await c.newPage();
    await ouvrirPage(p);
    await p.waitForTimeout(900);
    const t = await p.evaluate(() => {
      const b = document.getElementById("navJeton");
      return b && !b.hidden ? document.getElementById("navJetonTxt").textContent : "";
    });
    await c.close();
    etat.profilPluie = "sec";
    return t;
  };
  /* Trois cas : la pluie tombe déjà, le radar ne change rien ; elle arrive à
     9 h 20 ; l'heure entière est sèche, jusqu'à 10 h 10. */
  const pastPluie = await pastille("encours");
  const pastRadar = await pastille("debut");
  const pastSec = await pastille("sec");
  ok("la pastille du parapluie suit le radar dans l'heure",
    pastPluie === "09 h à 13 h" && pastRadar === "09 h 20 à 13 h" && pastSec === "10 h 10 à 13 h",
    `pluie en cours « ${pastPluie} », pluie à 9 h 20 « ${pastRadar} », heure sèche « ${pastSec} »`);

  const [ctxAcc, pgAcc] = await ctxReponse(METEO_NUE, FAIN);
  ok("le rappel de parapluie prend le début que le radar voit",
    await pgAcc.evaluate(async () => {
      const P = await import("/src/parapluie.js");
      const H = await import("/src/horloge.js");
      const a = H.instantParis("2026-08-18T09:55");
      const j = { jour: "2026-08-18", salves: [[9, 13]], h0: 9, h1: 13, objet: "parapluie" };
      const r = P.accorder(j, a);
      if (!r || P.fenetreTxt(r.h0, r.h1) !== "09 h 55 à 13 h") return `début ${r && P.fenetreTxt(r.h0, r.h1)}`;
      const tot = P.accorder({ ...j, salves: [[10, 13]], h0: 10 }, a);
      if (!tot || tot.h0 !== 10) return "une pluie plus tardive que le sec a été avancée";
      const court = P.accorder({ ...j, salves: [[9, 10]], h1: 10 }, H.instantParis("2026-08-18T10:05"));
      if (court !== null) return "une salve entièrement sèche au radar est restée";
      const demain = P.accorder({ ...j, jour: "2026-08-19" }, a);
      if (demain.h0 !== 9) return "un jeton d'un autre jour a bougé";
      return "";
    }) === "");
  ok("le radar dit jusqu'à quand le point est sec",
    await pgAcc.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      const pas = (...i) => [5, 10, 15, 20, 25, 30, 40, 50, 60]
        .map((m, k) => ({ t: t0 + m * 60000, i: i[k] }));
      const a = M.secJusqua({ dispo: true, source: "meteofrance", pas: pas(1, 1, 1, 2, 3, 3, 1, 1, 1) }, t0);
      if (a !== t0 + 20 * 60000) return `sec jusqu'à ${(a - t0) / 60000} minutes au lieu de 20`;
      const b = M.secJusqua({ dispo: true, source: "meteofrance", pas: pas(2, 2, 1, 1, 1, 1, 1, 1, 1) }, t0);
      if (b !== null) return "une pluie en cours donne un sec";
      const c = M.secJusqua({ dispo: true, source: "meteofrance", pas: pas(1, 1, 1, 1, 1, 1, 1, 1, 1) }, t0);
      if (c !== t0 + 70 * 60000) return `heure sèche jusqu'à ${(c - t0) / 60000} minutes au lieu de 70`;
      return "";
    }) === "");
  /* Le repli est un modèle : il ne corrige pas la série horaire. */
  ok("le repli n'accorde pas le rappel de parapluie",
    await pgAcc.evaluate(async () => {
      const M = await import("/src/pluieproche.js");
      const t0 = Date.now();
      const pas = [15, 30, 45, 60, 75].map(m => ({ t: t0 + m * 60000, i: 1 }));
      const r = M.secJusqua({ dispo: true, source: "repli", pasMinutes: 15, pas }, t0);
      return r === null ? "" : `sec jusqu'à ${(r - t0) / 60000} minutes`;
    }) === "");
  await ctxAcc.close();
};
