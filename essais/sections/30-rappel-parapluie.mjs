/* Le rappel de parapluie. Section de la suite des contrôles, sortie de essais/controle.mjs
   le 2 octobre 2026 ; elle part d'un état neuf préparé par essais/banc.mjs. */
import {
  METEO, FIGE, FAIN, servirBeauTemps, repliCorps, amorceGardee,
  grilleCorps,
} from "../faux-services.mjs";

export const titre = "Le rappel de parapluie";
export const avecPage = true;

export default async T => {
  const { nav, etat, ok, brancherRoutes, ouvrirPage, ouvrirLeTemps, txtDe, onglet, reposer } = T;
  /* Les heures réglées disent quand prévenir, non où chercher la pluie. Chaque
     alerte répond de la pluie attendue jusqu'à la suivante, la dernière jusqu'à
     minuit ; la tranche qui va de minuit à la première alerte n'est couverte par
     personne, on n'y sort pas.

     La charge d'essai est mouillée par plages, pour éprouver chaque cas. Les
     rafales des heures mouillées sont posées avec elles : celles de la charge
     dépassent le seuil de retournement l'après-midi, et tout serait capuche. */
  const meteoPluie = (raf, motif) => () => {
    const d = JSON.parse(JSON.stringify(METEO));
    const h = d.hourly;
    for (let k = 0; k < h.time.length; k++) {
      if (!motif.test(h.time[k])) continue;
      h.precipitation[k] = 1.2;
      h.precipitation_probability[k] = 80;
      h.wind_gusts_10m[k] = raf;
    }
    return d;
  };

  // L'après-midi du 18 août, quatorze et quinze heures : le cas de la consigne.
  const APRESMIDI = /^2026-08-18T1[45]/;

  const ctxJeton = async (patch, quand, reglages) => {
    const c = await nav.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
      locale: "fr-FR", timezoneId: "Europe/Paris", isMobile: true, hasTouch: true,
    });
    await c.addInitScript(amorceGardee(reglages || FAIN, quand || FIGE));
    await brancherRoutes(c);
    await c.route(/https:\/\/api\.open-meteo\.com/, route => {
      const u = route.request().url();
      const d = patch();
      /* Le repli de la pluie dans l'heure passe par le même hôte que la prévision.
         Il se reconnaît à sa colonne, demandée nulle part ailleurs. */
      if (u.includes("minutely_15")) {
        etat.appelsRepli.push(u);
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(repliCorps(etat.profilRepli, FIGE, u)) });
        return;
      }
      if (u.includes("sunshine_duration")) { servirBeauTemps(u, route); return; }
      /* La grille des nappes de la carte se reconnaît à ses colonnes : la
         direction du vent n'est demandée nulle part ailleurs. */
      if (u.includes("current=") && u.includes("wind_direction_10m")) {
        etat.appelsGrille.push(u);
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify(grilleCorps(u)) });
        return;
      }
      if (u.includes("current=")) {
        route.fulfill({ status: 200, contentType: "application/json", body: "[]" }); return;
      }
      if (u.includes("models=meteofrance_arome") || u.includes("hourly=")) {
        route.fulfill({ status: 200, contentType: "application/json",
          body: JSON.stringify({ hourly: d.hourly }) }); return;
      }
      delete d.hourly;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    });
    const p = await c.newPage();
    await ouvrirPage(p);
    await reposer(p, 2100);
    return [c, p];
  };

  /* L'appui passe par une aide qui rend la main sur un élément absent, au lieu de
     lever : une faute rétablie doit faire tomber les contrôles qu'elle concerne,
     non interrompre la suite avant les autres. */
  const clic = async (p, sel) => {
    if (!(await p.locator(sel).count()) || !(await p.locator(sel).isVisible())) return false;
    await p.locator(sel).click();
    return true;
  };

  /* La nuit. À six heures, une pluie de six heures tombe entre minuit et la
     première alerte : personne n'en répond, et prévenir n'y donnerait aucune
     occasion de prendre un parapluie. */
  const [ctxNuit, pgNuit] = await ctxJeton(
    meteoPluie(30, /^2026-08-18T0[56]/), "2026-08-18T06:00:00+02:00");
  ok("une pluie tombée avant la première alerte ne fait rien paraître",
    await pgNuit.locator("#navJeton").isHidden());
  await ctxNuit.close();

  /* La même heure, la pluie posée l'après-midi. L'alerte du matin en répond, bien
     qu'elle soit à sept heures et demie et la pluie à quatorze heures : c'est le
     cas que la consigne nomme. Le rappel se pose alors à l'heure d'alerte, encore
     devant soi. */
  const [ctxMatin, pgMatin] = await ctxJeton(
    meteoPluie(30, APRESMIDI), "2026-08-18T06:00:00+02:00");
  ok("une pluie de l'après-midi est annoncée dès avant la première alerte",
    await pgMatin.locator("#navJeton").isVisible());
  const ICS_MATIN = await pgMatin.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    return Pl.ics(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)), "Fain-lès-Moutiers");
  });
  ok("le rappel se pose à l'heure d'alerte tant qu'elle est devant soi",
    ICS_MATIN.includes("DTSTART:20260818T073000"),
    (ICS_MATIN.match(/DTSTART:\S+/) || [""])[0]);
  ok("et sa description nomme les heures de la pluie, non celles de l'alerte",
    /DESCRIPTION:Pluie de 14 h à 16 h/.test(ICS_MATIN),
    (ICS_MATIN.match(/DESCRIPTION:.*/) || [""])[0]);
  await ctxMatin.close();

  /* Neuf heures du matin, la même pluie. L'alerte de sept heures et demie est
     passée, mais l'application n'a pas de notification à pousser : ouvrir
     l'écran est l'alerte, et le jeton doit y être. */
  const [ctxPluie, pgPluie] = await ctxJeton(meteoPluie(30, APRESMIDI));
  ok("le jeton est là quand la période d'alerte est en cours",
    await pgPluie.locator("#navJeton").isVisible());
  ok("le jeton nomme les heures de la pluie",
    (await pgPluie.locator("#navJetonTxt").innerText()).trim() === "14 h à 16 h",
    await pgPluie.locator("#navJetonTxt").innerText());
  ok("il annonce un parapluie quand les rafales restent sous le seuil",
    /^Parapluie, pluie de 14 h à 16 h/.test(await pgPluie.getAttribute("#navJeton", "aria-label")),
    await pgPluie.getAttribute("#navJeton", "aria-label"));

  /* La barre de tête garde sa hauteur, et le jeton tient tout entier dedans : le
     risque nommé dans la consigne est qu'il pousse le nom de commune dehors. */
  ok("la barre de tête garde sa hauteur et le jeton tient dedans",
    await pgPluie.evaluate(() => {
      const barre = document.querySelector(".nav-corps").getBoundingClientRect();
      const j = document.getElementById("navJeton").getBoundingClientRect();
      const n = document.getElementById("navLieuNom").getBoundingClientRect();
      const haut = parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue("--nav-haut"));
      return Math.round(barre.height) === Math.round(haut) && j.top >= barre.top - 0.5
        && j.bottom <= barre.bottom + 0.5 && j.width > 60 && n.width > 40
        && n.right <= j.left + 0.5;
    }));

  ok("le jeton garde sa place sur les cinq écrans", await (async () => {
    const vus = [];
    for (const cle of ["accueil", "temps", "semaine", "ciel", "carte"]) {
      await (cle === "temps" ? ouvrirLeTemps(pgPluie) : pgPluie.locator(`[data-onglet="${cle}"]`).click());
      await pgPluie.waitForTimeout(400);
      const b = await pgPluie.locator("#navJeton").boundingBox();
      vus.push(b ? `${Math.round(b.x)},${Math.round(b.y)}` : "absent");
    }
    return new Set(vus).size === 1 && !vus.includes("absent");
  })());

  /* Le jeton se refait à chaque rendu, sur les cinq écrans et non sur le seul
     accueil : la barre de tête est commune, et un jeton pris ailleurs ne doit pas
     y rester posé. La place est rendue ensuite pour la suite des contrôles. */
  await pgPluie.evaluate(async () => {
    const R = await import("/src/reglages.js");
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    R.prendreJeton(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)).cle);
  });
  await pgPluie.locator('[data-onglet="semaine"]').click();
  await pgPluie.waitForTimeout(400);
  ok("un jeton pris se retire aussi depuis un écran qui n'est pas l'accueil",
    await pgPluie.locator("#navJeton").isHidden());
  await pgPluie.evaluate(() => localStorage.setItem("mameteo.reglages.v1",
    JSON.stringify({ ...JSON.parse(localStorage.getItem("mameteo.reglages.v1")),
      jetonsPris: [] })));
  await pgPluie.reload({ waitUntil: "networkidle" });
  await reposer(pgPluie, 2100);

  /* Le fichier d'agenda. C'est le seul mécanisme qui donne une vraie alerte sans
     service dorsal. L'heure d'alerte étant passée, le rappel se pose au début de
     la pluie : un rappel à sept heures et demie pour une journée entamée ne
     servirait à rien. */
  const ICS = await pgPluie.evaluate(async () => {
    const Pl = await import("/src/parapluie.js");
    const Pr = await import("/src/previsions.js");
    const R = await import("/src/reglages.js");
    return Pl.ics(Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT)), "Fain-lès-Moutiers");
  });
  ok("le fichier d'agenda porte un calendrier complet",
    ICS.startsWith("BEGIN:VCALENDAR\r\n") && ICS.trimEnd().endsWith("END:VCALENDAR")
    && (ICS.match(/BEGIN:VEVENT/g) || []).length === 1, ICS.slice(0, 40));
  ok("l'heure d'alerte passée, le rappel se pose au début de la pluie",
    ICS.includes("DTSTART:20260818T140000") && ICS.includes("DTEND:20260818T143000"),
    (ICS.match(/DT(START|END):\S+/g) || []).join(" "));
  ok("son alarme tombe quinze minutes avant l'évènement",
    ICS.includes("BEGIN:VALARM") && /TRIGGER:-PT15M/.test(ICS),
    (ICS.match(/TRIGGER:\S+/g) || []).join(" "));
  ok("il nomme l'objet et la commune",
    /SUMMARY:Parapluie à Fain-lès-Moutiers/.test(ICS),
    (ICS.match(/SUMMARY:.*/) || [""])[0]);
  ok("ses fins de ligne sont celles de la norme",
    await pgPluie.evaluate(t => /[^\r]\n/.test(t) ? "un saut de ligne seul" : "", ICS) === "");
  /* Le repli des lignes longues. Aucun nom de commune de France n'y mène, le plus
     long tenant sous le compte : le contrôle l'éprouve donc sur un nom assez long
     pour l'atteindre, plutôt que de porter un repli que rien ne vérifie. */
  ok("une ligne longue se replie et se déplie sur son texte",
    await pgPluie.evaluate(async () => {
      const Pl = await import("/src/parapluie.js");
      const Pr = await import("/src/previsions.js");
      const R = await import("/src/reglages.js");
      const j = Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
      const long = "Saint-Rémy-en-Bouzemont-Saint-Genest-et-Isson-lès-Deux-Églises";
      const t = Pl.ics(j, long);
      const e = new TextEncoder();
      const trop = t.split("\r\n").filter(l => e.encode(l).length > 75);
      if (trop.length) return `ligne de ${e.encode(trop[0]).length} octets`;
      const deplie = t.replace(/\r\n /g, "");
      return deplie.includes(`SUMMARY:Parapluie à ${long}`)
        ? "" : "le dépliage ne rend pas le titre";
    }) === "");

  /* La réponse du matin porte l'objet à côté de la tenue. Un conseil de vêtement
     qui ne dit pas de prendre un parapluie est incomplet : c'est la même question,
     celle de ce qu'on emporte. */
  await pgPluie.locator('[data-onglet="accueil"]').click();
  await pgPluie.waitForTimeout(400);
  ok("l'encart porte l'objet, puis la tenue, dans cet ordre",
    await pgPluie.evaluate(() => {
      const l = [...document.querySelectorAll(".pt-rep .pt-l")];
      if (l.length !== 2) return `${l.length} lignes`;
      if (!/^(Parapluie|Capuche),/.test(l[0].textContent.trim())) return l[0].textContent;
      if (!/ressentis|puis /.test(l[1].textContent)) return l[1].textContent;
      return "";
    }) === "", await txtDe(pgPluie, ".pt-rep"));
  ok("chaque ligne de l'encart mène là où elle appartient",
    await pgPluie.evaluate(() =>
      [...document.querySelectorAll(".pt-rep .pt-l")].map(x => x.dataset.feuille).join(","))
      === "parapluie,ressenti",
    await pgPluie.evaluate(() =>
      [...document.querySelectorAll(".pt-rep .pt-l")].map(x => x.dataset.feuille).join(",")));

  /* La feuille et la prise. La prise est gardée sous la date et l'instant
     d'alerte : prendre le jeton du matin ne doit pas faire taire celui du soir,
     et un rechargement ne doit pas le rendre. */
  await clic(pgPluie, "#navJeton");
  await pgPluie.waitForTimeout(450);
  ok("l'appui sur le jeton ouvre sa feuille",
    (await pgPluie.locator("#feuille-titre").innerText()).startsWith("Parapluie"),
    await pgPluie.locator("#feuille-titre").innerText());
  ok("la feuille porte les deux mécanismes, l'agenda et la prise",
    await pgPluie.locator("#plAgenda").count() === 1
    && await pgPluie.locator("#plPris").count() === 1);
  ok("elle dit pourquoi le rappel ne se pose pas à l'heure d'alerte",
    /* Derrière le « i » depuis le jalon 20 : le texte entier, non le rendu. */
    /heure d'alerte est passée/.test(await pgPluie.locator(".feuille-corps").textContent()),
    await pgPluie.locator(".feuille-corps").textContent());
  await clic(pgPluie, "#plPris");
  await pgPluie.waitForTimeout(500);
  ok("le jeton disparaît après un appui", await pgPluie.locator("#navJeton").isHidden());
  /* La prise vaut pour les deux endroits : l'objet quitte aussi l'encart, sans
     quoi l'application redemanderait de prendre ce qui est déjà pris. */
  ok("et l'objet quitte aussi l'encart de la réponse",
    await pgPluie.evaluate(() =>
      [...document.querySelectorAll(".pt-rep .pt-l")].every(x => x.dataset.feuille !== "parapluie")),
    await txtDe(pgPluie, ".pt-rep"));
  await pgPluie.reload({ waitUntil: "networkidle" });
  await reposer(pgPluie, 2100);
  ok("et ne revient pas au rechargement", await pgPluie.locator("#navJeton").isHidden());
  ok("la prise est gardée par sa date et son instant d'alerte",
    (await pgPluie.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).jetonsPris)).includes("2026-08-18|7.5"),
    await pgPluie.evaluate(() =>
      JSON.stringify(JSON.parse(localStorage.getItem("mameteo.reglages.v1")).jetonsPris)));

  /* Les heures d'alerte se règlent, et le rappel les suit. Une première alerte
     posée après la pluie laisse celle-ci dans la tranche que personne ne couvre :
     le jeton se tait. */
  await pgPluie.evaluate(() => localStorage.setItem("mameteo.reglages.v1",
    JSON.stringify({ ...JSON.parse(localStorage.getItem("mameteo.reglages.v1")),
      jetonsPris: [], alertes: [16, 20] })));
  await pgPluie.reload({ waitUntil: "networkidle" });
  await reposer(pgPluie, 2100);
  ok("une première alerte posée après la pluie fait taire le jeton",
    await pgPluie.locator("#navJeton").isHidden());
  await pgPluie.locator("#btnReglages").click();
  await pgPluie.waitForTimeout(450);
  ok("les réglages portent deux instants d'alerte, non quatre bornes",
    await pgPluie.locator(".rg-h").count() === 2,
    String(await pgPluie.locator(".rg-h").count()));
  ok("les instants affichés sont ceux qui sont enregistrés",
    await pgPluie.evaluate(() =>
      [...document.querySelectorAll(".rg-h")].map(s => s.value).join(",")) === "16,20",
    await pgPluie.evaluate(() =>
      [...document.querySelectorAll(".rg-h")].map(s => s.value).join(",")));
  /* Chaque rangée dit la période dont son alerte répond. La dernière s'arrête à
     minuit : c'est la règle même du rappel, elle doit se lire dans le réglage. */
  ok("chaque alerte dit la période qu'elle couvre, la dernière jusqu'à minuit",
    (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").allInnerTexts())
      .join(" | ") === "couvre 16 h à 20 h | couvre 20 h à minuit",
    (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").allInnerTexts()).join(" | "));
  /* Une seconde alerte qui précèderait la première est refusée, et le menu revient
     à la valeur en vigueur plutôt que de montrer un état que rien n'enregistre. */
  await pgPluie.selectOption('.rg-h[data-alerte="1"]', "9");
  await pgPluie.waitForTimeout(350);
  ok("une seconde alerte antérieure à la première est refusée",
    await pgPluie.evaluate(() =>
      document.querySelector('.rg-h[data-alerte="1"]').value) === "20"
    && JSON.stringify(await pgPluie.evaluate(() =>
      JSON.parse(localStorage.getItem("mameteo.reglages.v1")).alertes)) === "[16,20]",
    await pgPluie.evaluate(() =>
      JSON.stringify(JSON.parse(localStorage.getItem("mameteo.reglages.v1")).alertes)));
  /* Une alerte ramenée avant la pluie la reprend en charge, et le jeton reparaît
     sans que la feuille se ferme. */
  await pgPluie.selectOption('.rg-h[data-alerte="0"]', "7.5");
  await pgPluie.waitForTimeout(450);
  ok("une alerte ramenée avant la pluie fait reparaître le jeton",
    await pgPluie.locator("#navJeton").isVisible());
  ok("et la feuille dit aussitôt la période nouvelle",
    (await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").first().innerText())
      === "couvre 07 h 30 à 20 h",
    await pgPluie.locator(".rg-fen").locator("xpath=../span[1]/span").first().innerText());
  /* La section du rappel automatique sur iPhone est retirée, décision de
     Jérôme du 3 octobre 2026. */
  ok("les réglages n'ont plus de section du rappel automatique sur iPhone",
    await pgPluie.locator(".rg-recette").count() === 0
    && !(await pgPluie.locator("#feuille-corps").innerText()).includes("Rappel automatique"));
  await ctxPluie.close();

  /* Le vent. Un parapluie ne tient pas au delà du seuil de retournement, et
     l'annoncer alors serait un mauvais conseil. */
  const [ctxCapuche, pgCapuche] = await ctxJeton(meteoPluie(55, APRESMIDI));
  ok("un vent au delà du seuil fait écrire capuche et non parapluie",
    /^Capuche, pluie de/.test(await pgCapuche.getAttribute("#navJeton", "aria-label")),
    await pgCapuche.getAttribute("#navJeton", "aria-label"));
  await clic(pgCapuche, "#navJeton");
  await pgCapuche.waitForTimeout(450);
  ok("sa feuille dit pourquoi le parapluie ne convient pas",
    /rafale, un parapluie se retourne/.test(await pgCapuche.locator(".feuille-corps").innerText()),
    await pgCapuche.locator(".feuille-corps").innerText());
  ok("le seuil de retournement est celui de la règle des rafales",
    await pgCapuche.evaluate(async () => {
      const Pl = await import("/src/parapluie.js");
      const C = await import("/src/conseils.js");
      return Pl.RETOURNEMENT === C.SEUILS.rafale;
    }));
  await ctxCapuche.close();

  /* Deux averses séparées dans la même période. Les fondre en une seule plage
     ferait annoncer cinq heures de pluie là où il en tombe deux. Le jeton porte la
     première, la feuille les porte toutes. */
  const [ctxDeux, pgDeux] = await ctxJeton(meteoPluie(30, /^2026-08-18T(10|14)/));
  ok("le jeton porte la première averse de la période",
    (await pgDeux.locator("#navJetonTxt").innerText()).trim() === "10 h à 11 h",
    await pgDeux.locator("#navJetonTxt").innerText());
  await clic(pgDeux, "#navJeton");
  await pgDeux.waitForTimeout(450);
  ok("la feuille nomme les deux averses, non la plage qui les enjambe",
    (await pgDeux.locator(".feuille-corps").innerText()).includes("10 h à 11 h et 14 h à 15 h"),
    await pgDeux.locator(".feuille-corps").innerText());
  await ctxDeux.close();

  /* L'heure passée, la période courant encore. À midi, la pluie de dix heures est
     derrière et l'alerte du matin répond toujours de l'après-midi : annoncer un
     parapluie pour une averse tombée n'aide personne. C'est la seule condition qui
     écarte une heure, et elle porte aussi les périodes entièrement passées, qui
     n'ont plus une seule heure à venir. */
  const [ctxDerriere, pgDerriere] = await ctxJeton(
    meteoPluie(30, /^2026-08-18T10/), "2026-08-18T12:00:00+02:00");
  ok("une pluie déjà tombée ne fait rien paraître",
    await pgDerriere.locator("#navJeton").isHidden());
  await ctxDerriere.close();

  /* La soirée. La dernière alerte répond jusqu'à minuit : une pluie de vingt-trois
     heures est à elle. */
  const [ctxSoir, pgSoir] = await ctxJeton(
    meteoPluie(30, /^2026-08-18T2[23]/), "2026-08-18T21:00:00+02:00");
  ok("la dernière alerte répond de la pluie du soir",
    await pgSoir.locator("#navJeton").isVisible());
  ok("son jeton porte l'instant de la dernière alerte",
    await pgSoir.evaluate(async () => {
      const Pl = await import("/src/parapluie.js");
      const Pr = await import("/src/previsions.js");
      const R = await import("/src/reglages.js");
      return Pl.jeton(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT))?.cle;
    }) === "2026-08-18|17");
  await ctxSoir.close();

  /* Le lendemain. La dernière alerte s'arrête à minuit : une pluie du lendemain
     matin relève de l'alerte du lendemain, non de celle de ce soir. */
  const [ctxDemain, pgDemain] = await ctxJeton(
    meteoPluie(30, /^2026-08-19T0[89]/), "2026-08-18T21:00:00+02:00");
  ok("une pluie du lendemain matin ne s'annonce pas la veille au soir",
    await pgDemain.locator("#navJeton").isHidden());
  /* Elle figure en revanche dans le lot de l'horizon, que la feuille propose de
     poser d'un coup : ce qui ne mérite pas un jeton ce soir mérite un rappel. */
  ok("elle figure dans les rappels de l'horizon",
    await pgDemain.evaluate(async () => {
      const Pl = await import("/src/parapluie.js");
      const Pr = await import("/src/previsions.js");
      const R = await import("/src/reglages.js");
      const t = Pl.periodesPluvieuses(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
      /* La pluie du lendemain matin est dans le lot, et rien du soir même n'y
         figure : la soirée du 18 est sèche et sa période ne porte aucun rappel. */
      return t.some(x => x.cle === "2026-08-19|7.5") && !t.some(x => x.jour === "2026-08-18")
        ? "" : JSON.stringify(t.map(x => x.cle));
    }) === "");
  /* La pluie de nuit de la charge d'essai, trois à cinq heures le 19 août, ne
     relève d'aucune alerte et ne doit produire aucun rappel. */
  ok("aucune pluie de nuit n'entre dans les rappels de l'horizon",
    await pgDemain.evaluate(async () => {
      const Pl = await import("/src/parapluie.js");
      const Pr = await import("/src/previsions.js");
      const R = await import("/src/reglages.js");
      const t = Pl.periodesPluvieuses(Pr.serieHorizon(), R.alertes(Pl.ALERTES_DEFAUT));
      const tot = t.filter(x => x.salves.some(([a]) => a < 7));
      return tot.length ? JSON.stringify(tot[0]) : "";
    }) === "");
  await ctxDemain.close();

  /* La reprise de l'ancien réglage. La première version du rappel gardait deux
     plages de sortie ; le début de chaque plage est bien le moment où l'on
     sortait, et il devient l'instant d'alerte. */
  const [ctxRepris, pgRepris] = await ctxJeton(meteoPluie(30, APRESMIDI), FIGE,
    { ...FAIN, sorties: [[7.5, 9], [17, 19]] });
  ok("un réglage de plages de sortie se reprend en instants d'alerte",
    await pgRepris.evaluate(async () => {
      const R = await import("/src/reglages.js");
      const g = R.lire();
      return JSON.stringify(g.alertes) === "[7.5,17]" && g.sorties === undefined
        ? "" : JSON.stringify({ alertes: g.alertes, sorties: g.sorties });
    }) === "", await pgRepris.evaluate(async () => {
      const R = await import("/src/reglages.js");
      return JSON.stringify(R.lire().alertes);
    }));
  await ctxRepris.close();
  /* ---------- Le ressenti et le silence de la réponse ---------- */
};
